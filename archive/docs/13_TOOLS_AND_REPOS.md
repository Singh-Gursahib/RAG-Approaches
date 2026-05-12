# 13 — Tools, Frameworks, & Reference Repositories

> Curated list of external dependencies, reference implementations, and repos worth cloning / studying for each technique. Distinguishes **runtime dependencies** (we ship with these), **reference implementations** (we re-implement against our interface but compare against), and **datasets / benchmarks** (we pull from these).

---

## 1. Runtime Dependencies (Shipped With Repo)

These appear in `pyproject.toml`. Versions pinned via `uv.lock`.

### 1.1 Core

| Package | Purpose | License |
|---|---|---|
| `python` 3.11+ | Language | PSF |
| `fastapi` | API framework | MIT |
| `uvicorn` | ASGI server | BSD |
| `pydantic` 2.x | Validation | MIT |
| `hydra-core` | Configuration | MIT |
| `typer` | CLI | MIT |
| `structlog` | JSON logging | Apache 2.0 |
| `psutil` | Memory telemetry | BSD |
| `tracemalloc` (stdlib) | Memory tracking | PSF |

### 1.2 LLM / Embedding Clients

| Package | Purpose |
|---|---|
| `google-genai` (Gemini SDK) | Primary generator |
| `ollama` (Python client) | Local embeddings + optional gen |
| `openai` | Optional judge model |
| `cohere` | Optional reranker |
| `tiktoken` | Token counting |

### 1.3 Retrieval / Storage

| Package | Purpose |
|---|---|
| `qdrant-client` | Vector store |
| `neo4j` | Graph store (GraphRAG) |
| `networkx` | In-memory graph prototype |
| `rank_bm25` | BM25 (alongside Qdrant native) |
| `sentence-transformers` | Cross-encoder reranker |

### 1.4 Evaluation

| Package | Purpose |
|---|---|
| `ragas` | Faithfulness / answer relevance metrics |
| `bert_score` | BERTScore-F1 |
| `scipy` | Bootstrap CI, Wilcoxon, Holm |
| `numpy`, `pandas`, `pyarrow` | Aggregation |

### 1.5 Frontend

| Package | Purpose |
|---|---|
| `streamlit` | MVP dashboard |
| (Next.js) | Final dashboard, separate `frontend/web/` |

### 1.6 Dev / Test

| Package | Purpose |
|---|---|
| `pytest` | Test framework |
| `pytest-asyncio` | Async tests |
| `import-linter` | Module-boundary enforcement |
| `ruff` | Lint + format |
| `mypy` | Type checking |
| `pre-commit` | Hook runner |

---

## 2. Reference Implementations (For Comparison Or Inspiration)

These repos are studied and selectively borrowed from but **not** depended on at runtime — we re-implement to fit our interfaces.

| Technique | Reference Repo | What we take from it |
|---|---|---|
| Naive / Hybrid RAG | `langchain-ai/langchain`, `run-llama/llama_index` | Reranker chains, parser conventions |
| GraphRAG | `microsoft/graphrag` | Community-detection prompts, indexing pipeline shape |
| LightRAG (alt) | `HKUDS/LightRAG` | Lightweight graph alternative; ablation candidate |
| RAPTOR | `parthsarthi03/raptor` | Cluster-summarize loop |
| HyDE | `texttron/hyde` | Prompt template |
| MemoRAG | `qhjqhj00/MemoRAG` | Memory-token + clue generation |
| Self-RAG | `AkariAsai/self-rag` | Reflection token taxonomy |
| Adaptive RAG | `starsuzi/Adaptive-RAG` | Router classifier design |
| Agentic / LangGraph | `langchain-ai/langgraph` | State-machine pattern |
| Letta (MemGPT) | `letta-ai/letta` | Tiered memory, eviction logic |
| LLMLingua / LongLLMLingua | `microsoft/LLMLingua` | Compression model + API |
| ColBERT (late interaction, P2) | `stanford-futuredata/ColBERT` | Token-level retrieval (optional) |

For each, we record at integration time:
- The exact commit SHA referenced.
- Which design choice we adopted.
- Why we deviated where we deviated.

These notes go into `DECISIONS.md` as ADRs.

---

## 3. Datasets & Benchmarks To Pull

Per `07_DATASETS.md`, we acquire from:

| Source | Domain | Acquisition |
|---|---|---|
| CourtListener API | Legal | Programmatic; rate-limited |
| EUR-Lex bulk download | Legal | Public XML dumps |
| CUAD | Legal | HuggingFace `theatticusproject/cuad-qa` |
| PubMed Central OA | Medical | NCBI bulk FTP |
| MedQA / MedMCQA | Medical | HuggingFace |
| PubMedQA | Medical | HuggingFace |
| MIMIC-III demo | Medical (optional) | PhysioNet (DUA-free demo subset) |
| OpenStax | Education | Direct download |
| MIT OpenCourseWare | Education | Selective (CC-BY-NC-SA flag) |
| Project Gutenberg | Education | Public domain |
| SEC EDGAR | Finance | SEC bulk data |
| FinanceBench | Finance | HuggingFace `PatronusAI/financebench` |
| TAT-QA | Finance | GitHub release |
| arXiv | Research | Daily metadata snapshot |
| Semantic Scholar | Research | API |
| HotpotQA | Research / general | HuggingFace |
| 2WikiMultiHopQA | Research / general | HuggingFace |
| The Stack (subset) | Code | HuggingFace `bigcode/the-stack` |
| HumanEval | Code | HuggingFace |
| SWE-bench | Code | HuggingFace |
| Wikipedia | General | Bulk dump |
| Natural Questions | General | HuggingFace |
| TriviaQA | General | HuggingFace |
| MS MARCO | General | Microsoft release |

A `scripts/fetch_<domain>.py` per domain handles acquisition + license-check + manifest writing.

---

## 4. Models — Cloud

| Model | Role | Why |
|---|---|---|
| `gemini-1.5-pro` / `gemini-2-pro` | Primary generator (long-context) | 1M-token window, high quality |
| `gemini-1.5-flash` / `gemini-2-flash` | Cost-sensitive paths (rewrites, routing) | 5–10× cheaper |
| `gemini-2-pro` | Judge | Default faithfulness judge |
| `gpt-4o` | Cross-judge | Family-bias mitigation |
| `cohere-rerank-3` | Optional reranker | Strong rerank; ablation against bge |

---

## 5. Models — Local (via Ollama)

| Model | Role | Notes |
|---|---|---|
| `nomic-embed-text` | Default embedder | dim=768, max=8192 tokens |
| `bge-m3` (via Ollama or HF) | Embedder swap | Multilingual, longer context |
| `bge-reranker-v2-m3` | Default reranker | Cross-encoder, CPU-friendly |
| `llama-3.x-8b-instruct` | Optional local generator | Ablation only |
| `qwen2.5-7b` | Optional local generator | Ablation only |

`scripts/pull_ollama_models.sh` pulls the required set on first install.

---

## 6. Tools For Specific Techniques

### Indexing-heavy

- **GraphRAG indexing.** Reuse Microsoft GraphRAG's prompt suite (entity extraction, community summarization). Run via our minimal re-implementation; optional config switch to use upstream library for ablation parity check.
- **RAPTOR.** Use `umap-learn` for dimensionality reduction, `scikit-learn` GMM for clustering. LLM summarizer is Gemini Flash.
- **MemoRAG.** Reference impl uses bge-m3 + a small LM; we use `nomic` embeddings and Gemini Flash as the memory model. Cache memory artifact.

### Agentic

- **LangGraph** for state machines. We pin a specific version and avoid upstream churn.
- **No autonomous tool creation.** All tools are explicitly typed and registered.

### Compression

- **LLMLingua-2** via its pip package. Models hosted on HuggingFace; cached locally on first use.
- For LongLLMLingua: same package, query-aware mode.

### Caching

- **Gemini explicit cache** via `google-genai`'s `client.caches.create()`. TTL configurable.
- Cache invalidation tied to dataset hash.

### Multi-Agent Memory

- **Letta** (formerly MemGPT) library, wrapped behind our `Technique` interface.
- For Multi-Agent (Hybrid #6 backbone): pure LangGraph state machine, no Letta dependency.

---

## 7. Repositories To Clone For Study (Read-Only)

A `scripts/clone_references.sh` clones these into `references/` (gitignored) for source-level inspection during implementation:

```bash
microsoft/graphrag
HKUDS/LightRAG
qhjqhj00/MemoRAG
parthsarthi03/raptor
AkariAsai/self-rag
starsuzi/Adaptive-RAG
texttron/hyde
microsoft/LLMLingua
letta-ai/letta
langchain-ai/langgraph
explodinggradients/ragas
stanford-futuredata/ColBERT  # P2
```

Each is consulted during the corresponding technique's Phase. Implementation deviations from the reference are recorded in `DECISIONS.md`.

---

## 8. Comparable Surveys & Benchmarks

For related-work positioning in the paper:

| Survey / Benchmark | Why relevant |
|---|---|
| LongBench v1 / v2 | Long-context benchmark with task suite |
| Needle-in-Haystack (Greg Kamradt) | Standard depth-recall test |
| BABILong | Long-context QA |
| L-Eval, RULER | Long-context benchmark suites |
| TREC RAG | RAG retrieval benchmarks |
| KILT | Knowledge-intensive language tasks |
| RAGAS published numbers | Cross-comparison reference |
| arXiv 2505.01146 (biomedical RAG survey) | Medical domain prior |
| arXiv 2511.07328 (Q-RAG) | Agentic RAG SOTA |

The framework includes the relevant benchmark suites where licensing allows; we use our own benchmarks for cross-domain comparability.

---

## 9. Hosting & Deployment

| Component | Default | Notes |
|---|---|---|
| Vector store | Qdrant in Docker | Local-first |
| Graph store | Neo4j community in Docker | Local-first |
| Embeddings | Ollama in Docker | Local-first |
| LLM gen | Gemini API | Cloud |
| Dashboard | Local (Streamlit / Next.js dev) | Demo deployment optional (Vercel) |

Total local footprint: ~8 GB images (Qdrant + Neo4j + Ollama + nomic-embed-text). Disk for `data/`: see `07_DATASETS.md §6`.

---

## 10. Out-of-Scope Tools (Tracked, Not Adopted)

- **Pinecone, Weaviate Cloud.** Cloud-only; we stay local-first. Switching is a config change if needed later.
- **TruLens / DeepEval.** Overlapping with RAGAS; we standardize on RAGAS for comparability.
- **MLflow.** Heavier than our needs; W&B as optional mirror is sufficient.
- **Microsoft KAG / GraphRAG SaaS.** SaaS; we use the OSS variant.

---

## 11. Versioning & Update Policy

- **Major version pins.** Hydra, Pydantic, Qdrant, FastAPI pinned to majors.
- **Quarterly review.** Refresh pins on a schedule, not opportunistically. Run smoke benchmark after each refresh.
- **API model versions.** Pin model **version** (with date suffix, e.g., `gemini-1.5-pro@2026-04-30`) so results don't drift from underneath us. New version = explicit re-run, not silent change.
- **Reference repo SHAs.** Recorded at the time we adopt patterns. Drift is fine — references don't change runtime.

---

## 12. Decision: Why We Build Our Own Orchestration

We use LangChain components selectively (rerankers, parsers, splitters) but **not** as the core orchestrator, because:
1. LangChain's APIs change quarterly. Our experimental ledger needs stability.
2. Comparability across techniques requires a unified interface, which LangChain's heterogeneous chains don't provide.
3. Run-recording / manifest discipline is custom to this project.

Recorded as **ADR-003** in `DECISIONS.md`.
