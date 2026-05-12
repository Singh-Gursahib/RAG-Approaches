# 03 — Backend Design

> Concrete API design, core abstractions, configuration model, run-recording contract, and external-service adapters. Reading order: core abstractions → services → pipelines → API → CLI.

---

## 1. Core Abstractions

All abstractions live in `src/ragureap/core/interfaces.py` as `typing.Protocol`s (structural typing — implementations don't have to inherit). Where helpful, a thin ABC wrapper exists in `core/base.py`.

### 1.1 `Document` and `Chunk`

```python
# core/types.py
@dataclass(frozen=True)
class Document:
    doc_id: str            # Stable ID, hash of content + path
    source: str            # Filesystem path or URL
    domain: str            # legal, medical, …
    text: str              # Cleaned plain text
    metadata: dict[str, Any]   # title, author, date, section IDs

@dataclass(frozen=True)
class Chunk:
    chunk_id: str          # Stable ID, hash of (doc_id, span)
    doc_id: str
    text: str
    span: tuple[int, int]  # Character offsets in source doc
    metadata: dict[str, Any]   # parent_id, level, hierarchy_path, …
    embedding: np.ndarray | None = None
```

Chunks carry a `parent_id` and `level` to support Parent-Child and Hierarchical RAG without a parallel data model.

### 1.2 `Embedder`

```python
class Embedder(Protocol):
    name: str                       # e.g., "ollama:nomic-embed-text"
    dim: int
    max_input_tokens: int

    def embed_documents(self, texts: list[str]) -> np.ndarray: ...
    def embed_query(self, text: str) -> np.ndarray: ...
```

### 1.3 `Retriever`

```python
class Retriever(Protocol):
    def retrieve(self, query: str, k: int, **kwargs) -> list[RetrievedChunk]: ...

@dataclass
class RetrievedChunk:
    chunk: Chunk
    score: float
    rank: int
    retriever: str   # name of retriever that produced it
```

### 1.4 `Reranker`

```python
class Reranker(Protocol):
    def rerank(self, query: str, candidates: list[RetrievedChunk], top_k: int) -> list[RetrievedChunk]: ...
```

### 1.5 `Generator`

```python
class Generator(Protocol):
    name: str
    max_context_tokens: int

    def generate(
        self, prompt: str, *,
        system: str | None = None,
        temperature: float = 0.0,
        seed: int | None = None,
        max_tokens: int | None = None,
        cache_key: str | None = None,   # for context caching
        stream: bool = False,
    ) -> GenerationResult: ...

@dataclass
class GenerationResult:
    text: str
    tokens_in: int
    tokens_out: int
    latency_ms: float
    cost_usd: float
    raw: dict   # provider-specific payload (for debugging only)
```

### 1.6 `Technique`

```python
class Technique(Protocol):
    name: str
    family: Literal["rag", "non_rag"]

    def index(self, docs: Iterable[Document], *, ctx: IndexContext) -> IndexHandle: ...
    def run(self, query: str, *, ctx: RunContext) -> TechniqueResult: ...

@dataclass
class TechniqueResult:
    answer: str
    retrieved: list[RetrievedChunk]   # may be empty for non-RAG
    intermediate: dict[str, Any]      # planner steps, reflection tokens, etc.
    generation: GenerationResult
    cost_usd: float
    latency_ms: float
```

A `Technique` is intentionally **stateless across queries** — index handles are passed in via `RunContext`. This makes parallel benchmarking straightforward.

### 1.7 `DomainAdapter`

```python
class DomainAdapter(Protocol):
    name: str
    raw_dir: Path
    benchmark_path: Path

    def load_documents(self) -> Iterable[Document]: ...
    def load_benchmark(self, suite: str) -> Iterable[Question]: ...
    def prompts(self) -> PromptPack: ...   # system prompts, answer-style guides
```

### 1.8 `Evaluator`

```python
class Evaluator(Protocol):
    name: str
    requires_ground_truth: bool
    requires_judge: bool

    def evaluate(
        self,
        questions: list[Question],
        results: list[TechniqueResult],
        *,
        ctx: EvalContext,
    ) -> dict[str, float]: ...
```

---

## 2. Registry

```python
# core/registry.py
_REGISTRY: dict[str, type] = {}

def register(key: str):
    def deco(cls):
        if key in _REGISTRY:
            raise ValueError(f"Duplicate registry key: {key}")
        _REGISTRY[key] = cls
        return cls
    return deco

def get(key: str) -> type:
    return _REGISTRY[key]
```

Convention: keys are `family.name`. E.g.:
- `rag.naive`, `rag.graph_rag`, `rag.adaptive`
- `non_rag.full_context`, `non_rag.context_cache`
- `embedder.nomic`, `embedder.bge_m3`
- `generator.gemini_pro`, `generator.gemini_flash`
- `reranker.bge_v2`, `reranker.cohere_v3`
- `judge.gemini_pro`, `judge.gpt4o`

A single `__init__.py` in each package eagerly imports submodules so registrations happen at startup.

---

## 3. Configuration (Hydra)

### 3.1 Composition

Root config selects defaults; experiment configs override:

```yaml
# configs/config.yaml
defaults:
  - domain: legal
  - embedder: nomic
  - generator: gemini_pro
  - reranker: bge_v2
  - judge: gemini_pro
  - technique: naive_rag
  - benchmark: smoke
  - _self_

run:
  seed: 42
  out_dir: ${hydra:runtime.cwd}/runs
  tag: ${technique.name}-${domain.name}-${run.seed}
```

### 3.2 Validation

All configs validated via Pydantic dataclasses (`core/config.py`). Invalid configs fail loudly at startup, never mid-run.

### 3.3 Materialization

Before any technique runs, the resolved config is:
1. Hashed (sha256 of canonical JSON).
2. Snapshotted as `runs/<id>/config.snapshot.yaml`.
3. Manifest records `config_hash` for replay.

---

## 4. Run Recorder Contract

`core/recorder.py` exposes `RunRecorder`:

```python
class RunRecorder:
    def __init__(self, run_id: str, out_dir: Path): ...

    def open(self) -> None: ...          # mkdir, write manifest
    def write_manifest(self, manifest: dict) -> None: ...
    def append_input(self, q: Question) -> None: ...
    def append_output(self, q_id: str, result: TechniqueResult) -> None: ...
    def append_log(self, level: str, event: str, **fields) -> None: ...
    def write_metrics(self, metrics: dict) -> None: ...
    def close(self) -> None: ...
```

All writes are line-delimited JSON for streaming friendliness. The recorder is **the only writer** to a run folder; nothing else writes there. This invariant is asserted in tests.

Manifest schema:

```json
{
  "run_id": "20260612-1402-graph_rag-legal-1",
  "created_at": "2026-06-12T14:02:00Z",
  "git_sha": "abcdef1",
  "code_version": "0.1.0",
  "technique": {"name": "graph_rag", "config_hash": "..."},
  "domain": {"name": "legal", "dataset_hash": "..."},
  "embedder": {"name": "ollama:nomic-embed-text", "version": "v1.5"},
  "generator": {"name": "gemini-1.5-pro", "version": "2026-04-30"},
  "reranker": {"name": "bge-reranker-v2-m3", "version": "..."},
  "judge": {"name": "gemini-2-pro", "version": "..."},
  "seed": 1,
  "config_hash": "...",
  "config_snapshot": "config.snapshot.yaml",
  "tags": ["legal-baselines-v1"]
}
```

---

## 5. External Services

### 5.1 LLM providers

`core/services/llm/gemini.py` wraps the Gemini SDK with:
- Token counting (input + output).
- Latency stopwatch.
- Cost calculator using a per-model price table (`core/pricing.py`).
- Optional explicit cache support (for `context_cache` technique).
- Automatic retry on 429 with exponential backoff (capped at 3 retries).
- `seed=` and `temperature=0` enforced in deterministic mode.

The same shape exists for Ollama (no cost, but latency + token counts) and OpenAI (judge only).

### 5.2 Embedding providers

`OllamaEmbedder` is the default (`nomic-embed-text`, dim=768, max=8192 tokens). `BgeM3Embedder` and `GeminiEmbedder` are alternatives. All three implement the same `Embedder` Protocol.

Embedding caching: every `embed_documents` call hashes (model_id + text) and caches results in a SQLite file at `data/processed/.embedding_cache.sqlite`. Re-indexing is fast.

### 5.3 Vector store

`QdrantStore` (default) provides:
- `upsert(collection, ids, vectors, payloads)`
- `search(collection, vector, k, filter)`
- `hybrid_search(collection, query_text, vector, k)` — uses Qdrant's BM25 sparse + dense fusion.

Collections are named `{domain}__{technique}__{embedder}__{chunker_hash}`.

### 5.4 Graph store

`Neo4jStore` for GraphRAG; `NetworkXStore` for prototyping. Same interface: `upsert_nodes`, `upsert_edges`, `query_cypher` (Neo4j-only), `local_search(entity, depth)`, `community_search(community_id)`.

### 5.5 Reranker

`CrossEncoderReranker` wraps `bge-reranker-v2-m3` via sentence-transformers (CPU-friendly). `CohereReranker` wraps `rerank-3` via the Cohere API. Both expose `rerank(query, candidates, top_k)`.

---

## 6. Pipelines

### 6.1 `pipelines/ingest.py`

Reads `data/raw/<domain>/`, parses to `Document`, runs the configured chunker, writes `data/processed/<domain>/chunks.jsonl` plus a dataset manifest with `dataset_hash`. Idempotent: if hash unchanged, exits early.

### 6.2 `pipelines/index.py`

Reads chunks, embeds them (using the cache), upserts into the vector / graph store under a deterministic collection name. Returns an `IndexHandle` that techniques use at query time.

### 6.3 `pipelines/query.py`

Single-query entry. Loads the technique by registry key, resolves an `IndexHandle`, calls `technique.run(query)`, returns `TechniqueResult`.

### 6.4 `pipelines/compare.py`

Loads N runs by `run_id`, joins on question ID, produces a comparison table:
- Per-question side-by-side answers.
- Aggregated metrics with CIs.
- Pareto frontier (cost vs quality, latency vs quality).

---

## 7. FastAPI Application

`src/ragureap/api/main.py`:

```python
app = FastAPI(title="RAG_Ureap experiment runner")
app.include_router(runs_router, prefix="/runs")
app.include_router(techniques_router, prefix="/techniques")
app.include_router(domains_router, prefix="/domains")
app.include_router(compare_router, prefix="/compare")
```

### 7.1 Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Liveness |
| GET | `/techniques` | List registered techniques |
| GET | `/domains` | List configured domains |
| POST | `/runs` | Launch a new run (background task) |
| GET | `/runs` | List runs (paginated, filterable) |
| GET | `/runs/{id}` | Run manifest + metrics |
| GET | `/runs/{id}/stream` | SSE stream of progress |
| GET | `/runs/{id}/outputs` | Per-question outputs (paginated) |
| POST | `/compare` | Compare N runs |

### 7.2 Request schema (POST /runs)

```python
class RunRequest(BaseModel):
    technique: str         # registry key
    domain: str
    benchmark: str = "smoke"
    seeds: list[int] = [1]
    overrides: dict[str, Any] = {}   # Hydra-style overrides
    tag: str | None = None
```

### 7.3 Background execution

`POST /runs` returns a `run_id` immediately and spawns the actual work as a `BackgroundTask`. Progress is streamed via SSE on `/runs/{id}/stream`.

For long-running batch sweeps the FastAPI is bypassed in favor of the CLI.

---

## 8. CLI (Typer)

```bash
python -m ragureap ingest --domain legal
python -m ragureap index --technique graph_rag --domain legal
python -m ragureap run --experiment configs/experiments/legal_baselines.yaml
python -m ragureap compare --runs run_001,run_002,run_003
python -m ragureap replay --run run_001
```

The CLI is the primary entry point for **batch experiments**. The FastAPI app is for **interactive UI use**.

---

## 9. Determinism

`core/seed.py` exposes `set_global_seed(seed)` which seeds `random`, `numpy`, `torch` (if installed). For Gemini, `seed` is passed through. For Ollama, `seed` is passed through where supported. For OpenAI judge calls, `seed` is set; results may still vary slightly — judge runs are themselves multi-seeded if used quantitatively.

---

## 10. Error Handling Philosophy

- **Fail loudly at config time.** Bad config → never starts.
- **Fail loudly at index time.** Bad data → never indexes.
- **Fail gracefully at query time.** A single failed query writes a `failed=true` row in `outputs.jsonl` with the exception trace; the run continues. Aggregate metrics report failure rate as a first-class column.
- **Never silently retry.** Retries are logged to `logs/retries.jsonl` with the count.

---

## 11. Performance & Concurrency

- Embedding: batched by 64 docs by default.
- Indexing: writes are async-batched to Qdrant.
- Querying: a benchmark run executes queries sequentially by default (for clean per-query latency timing) but supports `--concurrency N` for throughput-mode runs.
- Cost ceilings: each run config can specify `max_cost_usd`; the recorder aborts the run cleanly when reached, marking it `aborted`.

---

## 12. Security & Secrets

- All API keys via env vars (`GOOGLE_API_KEY`, `OPENAI_API_KEY`, `COHERE_API_KEY`).
- `.env.example` committed; `.env` gitignored.
- No keys ever written to manifests, logs, or run folders.
- A small precommit hook scans for accidental secret leaks.

---

## 13. What Phase 1 Will Build

A subset of the above:
- `core/` (interfaces, registry, config, recorder, logging, services skeletons).
- `pipelines/ingest.py` skeleton.
- FastAPI `/health` only.
- CLI skeleton.
- Docker compose.
- Pytest scaffolding.

Everything else is filled by later phases.
