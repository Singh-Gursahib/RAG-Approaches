# 02 — Project Architecture

> Concrete folder structure, module boundaries, runtime architecture, and data flow. This document is the contract every later phase implements against.

---

## 1. Design Principles

1. **Pluggable interfaces over inheritance.** Every replaceable component is a Protocol/ABC: `Embedder`, `Retriever`, `Reranker`, `Generator`, `Technique`, `Evaluator`, `DomainAdapter`, `ChunkStrategy`. Concrete implementations register themselves into a string-keyed registry.
2. **Configuration as source of truth.** A run is fully defined by a Hydra config tree. Code reads config; config is what gets snapshotted into `runs/<id>/manifest.json`. Code mutations should be rare; config mutations are the experimentation surface.
3. **Domain logic at the edges.** Domains are adapters, not branches. A new domain adds files in `domains/<x>/` and a new entry in `configs/domains/<x>.yaml`. It never touches `techniques/`.
4. **One technique = one subpackage.** Every technique lives under `techniques/rag/<name>/` or `techniques/non_rag/<name>/` with its own README, prompt templates, and tests. Cross-technique helpers live in `core/` or `utils/`.
5. **Side-effect isolation.** External services (vector DB, graph DB, LLM APIs) are accessed only through `core/services/` adapters. This makes mocking trivial and keeps technique code framework-agnostic.
6. **Run as artifact.** Every invocation that touches an LLM produces a `runs/<id>/` folder. There are no "ephemeral" experiments.

---

## 2. Folder Structure (Final Target)

```
RAG_Ureap/
├── README.md                       ← Master handoff doc
├── PROGRESS.md                     ← Live state
├── PHASES.md                       ← 15-phase plan
├── DECISIONS.md                    ← ADR-lite log
├── FINDINGS.md                     ← Interim conclusions
├── EXPERIMENT_LOG.md               ← Run ledger
├── research.md                     ← Original literature review
│
├── docs/                           ← Static design specs (00–14)
│
├── pyproject.toml                  ← Package metadata + deps
├── uv.lock                         ← Pinned deps (uv)
├── Makefile                        ← Dev commands
├── docker-compose.yml              ← Qdrant, Neo4j, Ollama
├── .env.example                    ← Sample env vars (no secrets)
├── .gitignore
│
├── src/ragureap/                   ← Main Python package
│   ├── __init__.py
│   │
│   ├── core/                       ← Foundational machinery
│   │   ├── __init__.py
│   │   ├── interfaces.py           ← Protocols: Embedder, Retriever, …
│   │   ├── registry.py             ← @register decorator + lookups
│   │   ├── config.py               ← Hydra config loading + validation
│   │   ├── run_manifest.py         ← Manifest schema + writer
│   │   ├── recorder.py             ← Per-run JSONL streams
│   │   ├── logging.py              ← Structured logger
│   │   ├── tokens.py               ← Tokenizer / counter abstractions
│   │   ├── seed.py                 ← Determinism helpers
│   │   └── services/               ← External service adapters
│   │       ├── llm/
│   │       │   ├── gemini.py
│   │       │   ├── ollama.py
│   │       │   └── openai_judge.py
│   │       ├── embedding/
│   │       │   ├── ollama_embedder.py
│   │       │   ├── bge_embedder.py
│   │       │   └── gemini_embedder.py
│   │       ├── reranker/
│   │       │   ├── cross_encoder.py
│   │       │   └── cohere.py
│   │       ├── vector/
│   │       │   ├── qdrant_store.py
│   │       │   └── chroma_store.py
│   │       └── graph/
│   │           ├── networkx_store.py
│   │           └── neo4j_store.py
│   │
│   ├── techniques/                 ← One subpackage per technique
│   │   ├── __init__.py
│   │   ├── base.py                 ← Technique ABC, run() signature
│   │   ├── rag/
│   │   │   ├── naive/
│   │   │   ├── hybrid/
│   │   │   ├── parent_child/
│   │   │   ├── multi_query/
│   │   │   ├── hyde/
│   │   │   ├── hierarchical/
│   │   │   ├── raptor/
│   │   │   ├── graph_rag/
│   │   │   ├── memo_rag/
│   │   │   ├── self_rag/
│   │   │   ├── agentic/
│   │   │   ├── adaptive/
│   │   │   └── contextual_compression/
│   │   └── non_rag/
│   │       ├── full_context/
│   │       ├── recursive_summary/
│   │       ├── sliding_window_reasoning/
│   │       ├── prompt_compression/
│   │       ├── context_cache/
│   │       ├── memgpt/
│   │       ├── multi_agent_memory/
│   │       └── long_context_native/
│   │
│   ├── domains/                    ← Per-domain adapters + prompt packs
│   │   ├── __init__.py
│   │   ├── base.py                 ← DomainAdapter ABC
│   │   ├── legal/
│   │   ├── medical/
│   │   ├── education/
│   │   ├── finance/
│   │   ├── research/
│   │   ├── code/
│   │   └── general/
│   │
│   ├── chunking/                   ← Chunkers (used by techniques)
│   │   ├── fixed.py
│   │   ├── recursive.py
│   │   ├── semantic.py
│   │   └── document_aware.py
│   │
│   ├── evaluation/
│   │   ├── __init__.py
│   │   ├── metrics/
│   │   │   ├── retrieval.py        ← precision, recall, MRR, nDCG
│   │   │   ├── generation.py       ← EM, F1, BLEURT, BERTScore
│   │   │   ├── faithfulness.py     ← claim-level grounding
│   │   │   ├── ragas_metrics.py    ← RAGAS wrappers
│   │   │   ├── hallucination.py    ← out-of-corpus + contradiction
│   │   │   ├── cost.py             ← tokens, $, latency
│   │   │   └── memory.py           ← peak RSS, GPU mem
│   │   ├── judges/
│   │   │   ├── base.py
│   │   │   ├── gemini_judge.py
│   │   │   └── openai_judge.py
│   │   └── stats/
│   │       ├── bootstrap.py        ← BCa CIs
│   │       ├── tests.py            ← Wilcoxon, Holm
│   │       └── pareto.py           ← Pareto frontier extraction
│   │
│   ├── benchmarks/
│   │   ├── __init__.py
│   │   ├── suites/                 ← Suite definitions
│   │   │   ├── needle_haystack.py
│   │   │   ├── multi_hop.py
│   │   │   ├── adversarial.py
│   │   │   ├── hallucination.py
│   │   │   ├── stress.py
│   │   │   ├── retrieval_quality.py
│   │   │   └── reasoning_quality.py
│   │   └── runner.py               ← Iterate technique × domain × seed
│   │
│   ├── pipelines/
│   │   ├── ingest.py               ← Ingest raw → processed
│   │   ├── index.py                ← Build technique-specific indices
│   │   ├── query.py                ← Single-query entry point
│   │   ├── compare.py              ← Multi-run diff + leaderboard
│   │   └── parse/                  ← PDF/HTML/Markdown/JSON parsers
│   │
│   ├── api/                        ← FastAPI app
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── routes/
│   │   │   ├── runs.py
│   │   │   ├── techniques.py
│   │   │   ├── domains.py
│   │   │   └── compare.py
│   │   └── schemas.py              ← Pydantic models
│   │
│   └── cli/                        ← Typer-based CLI
│       ├── __init__.py
│       ├── ingest.py
│       ├── index.py
│       ├── run.py
│       └── compare.py
│
├── configs/                        ← Hydra config tree
│   ├── config.yaml                 ← Root composition
│   ├── domain/
│   │   ├── legal.yaml
│   │   ├── medical.yaml
│   │   └── …
│   ├── technique/
│   │   ├── naive_rag.yaml
│   │   ├── graph_rag.yaml
│   │   └── …
│   ├── embedder/
│   │   ├── nomic.yaml
│   │   └── bge_m3.yaml
│   ├── generator/
│   │   ├── gemini_pro.yaml
│   │   ├── gemini_flash.yaml
│   │   └── ollama_local.yaml
│   ├── reranker/
│   │   ├── bge_v2.yaml
│   │   └── cohere_v3.yaml
│   ├── judge/
│   │   ├── gemini_pro.yaml
│   │   └── gpt4o.yaml
│   ├── benchmark/
│   │   ├── smoke.yaml
│   │   ├── full.yaml
│   │   └── adversarial.yaml
│   └── experiment/                 ← Composed runnable experiments
│       ├── legal_baselines.yaml
│       ├── medical_full_sweep.yaml
│       └── …
│
├── data/
│   ├── raw/                        ← Source documents (gitignored)
│   │   ├── legal/
│   │   ├── medical/
│   │   └── …
│   ├── processed/                  ← Chunks, embeddings, indices
│   └── benchmarks/                 ← Ground-truth Q&A
│       ├── legal/
│       │   ├── qa.jsonl
│       │   ├── adversarial.jsonl
│       │   └── needles.jsonl
│       └── …
│
├── runs/                           ← Per-experiment artifacts (gitignored bulk; manifest committed)
│   └── <run_id>/
│       ├── manifest.json
│       ├── config.snapshot.yaml
│       ├── inputs.jsonl
│       ├── outputs.jsonl
│       ├── metrics.json
│       └── logs/
│
├── frontend/
│   ├── streamlit_app/              ← Phase 10 MVP
│   └── web/                        ← Next.js (Phase 10 final)
│
├── notebooks/
│   ├── exploration/
│   └── figures/                    ← Paper figure-generating notebooks
│
├── scripts/
│   ├── pull_ollama_models.sh
│   ├── ingest_all_domains.sh
│   ├── smoke_bench.py
│   └── build_repro_tarball.sh
│
└── tests/
    ├── unit/
    ├── integration/
    └── conftest.py
```

---

## 3. Module Boundaries (What Imports What)

A strict acyclic dependency graph keeps the codebase coherent:

```
core/                  ← imports nothing internal
chunking/              ← imports core
domains/               ← imports core, chunking
techniques/            ← imports core, chunking, domains (only DomainAdapter ABC)
evaluation/            ← imports core (and may load runs/ artifacts)
benchmarks/            ← imports core, domains, techniques, evaluation
pipelines/             ← imports core, domains, chunking, techniques
api/, cli/             ← imports pipelines, benchmarks, evaluation
```

**Forbidden imports:**
- `core/` may not import anything from `techniques/`, `domains/`, `evaluation/`, etc.
- `techniques/` may not import other techniques (no cross-technique entanglement; shared logic moves to `core/` or `utils/`).
- `domains/` may not import `techniques/` (domains are passive data adapters).

A simple lint rule (e.g., `import-linter`) enforces this in CI.

---

## 4. Runtime Architecture

### 4.1 Local services (Docker compose)

```
+----------------------------+
|   docker-compose.yml       |
|                            |
|   qdrant     :6333         |  ← vector store
|   neo4j      :7474, :7687  |  ← graph store (GraphRAG)
|   ollama     :11434        |  ← local embeddings + optional gen
+----------------------------+
```

Brought up via `make up`; required models (`nomic-embed-text`, optional generator) are pulled by `scripts/pull_ollama_models.sh`.

### 4.2 Process model

Two long-running processes during interactive work:

1. **FastAPI experiment-runner** (`python -m ragureap.api`) — exposes `/runs`, `/techniques`, `/compare`. Frontend talks to this.
2. **Frontend** — Streamlit on `:8501` or Next.js dev server on `:3000`.

For batch experiments the FastAPI is bypassed: `python -m ragureap.cli run --experiment configs/experiments/legal_baselines.yaml` runs synchronously and writes to `runs/`.

### 4.3 Run lifecycle (single query)

```
[Frontend]  → POST /runs  (technique, domain, query, config)
            → FastAPI assigns run_id
            → spawns background task

[BackgroundTask]
  1. Resolve config → build technique pipeline via registry
  2. Initialize RunRecorder(run_id) → opens runs/<id>/
  3. Write manifest.json (config, git SHA, dataset hash, model IDs, seed)
  4. For each query in inputs:
        - call technique.run(query) → answer + intermediate artifacts
        - recorder.append_input(query)
        - recorder.append_output(answer, retrieved_chunks, …)
  5. Run evaluation.metrics on outputs vs ground truth
  6. Write metrics.json
  7. Mark run complete

[Frontend]  ← SSE stream of progress + final metrics
```

### 4.4 Indexing lifecycle

Indexing is **separate from running**: a technique's index is built once per `(technique, domain, embedder)` triple and cached under `data/processed/<domain>/<technique>/`. A SHA over the raw corpus + chunker config + embedder model is the cache key. A second run with the same triple is fast.

For GraphRAG and RAPTOR (LLM-heavy indexing), indices are also versioned by the indexing-LLM ID and a prompt hash.

---

## 5. Data Flow

```
data/raw/<domain>/*.{pdf,html,md,json}
    │
    ▼  (pipelines/parse/*)
parsed Documents (in-memory, typed)
    │
    ▼  (chunking/*)
Chunks  ── data/processed/<domain>/chunks.jsonl
    │
    ▼  (per-technique indexer)
Indices in Qdrant / Neo4j / on disk
    │
    ▼  (technique.run(query))
Retrieved/relevant context  ── runs/<id>/outputs.jsonl
    │
    ▼  (Generator)
Answer  ── runs/<id>/outputs.jsonl
    │
    ▼  (evaluation/*)
Metrics  ── runs/<id>/metrics.json
    │
    ▼  (frontend/compare)
Leaderboard / Pareto plots
```

---

## 6. Configuration Strategy (Hydra)

A run is composed from several config groups:

```yaml
# configs/experiment/legal_baselines.yaml
defaults:
  - /domain: legal
  - /embedder: nomic
  - /generator: gemini_pro
  - /reranker: bge_v2
  - /judge: gemini_pro
  - /benchmark: smoke

techniques:
  - naive_rag
  - hybrid_rag
  - graph_rag

run:
  seeds: [1, 2, 3]
  out_dir: runs
  tag: legal-baselines-v1
```

The composed config is what gets snapshotted into the run manifest.

---

## 7. Testing Strategy

- **Unit tests** (`tests/unit/`) — interface contracts, chunkers, registry, config validation, manifest schema, statistical helpers.
- **Integration tests** (`tests/integration/`) — one tiny end-to-end run (3 docs, 2 queries) per technique against fixtures, asserting that the run folder is well-formed.
- **Smoke benchmark** (`scripts/smoke_bench.py`) — 10 queries × N techniques × 1 domain. Used as a CI gate before merging technique PRs.
- **Determinism tests** — run a technique twice with the same seed and config; assert outputs hash matches (LLM calls mocked).

---

## 8. Reproducibility Guarantees

A run is reproducible when:
- Code git SHA matches.
- Dataset hash matches (corpus content + chunker config).
- Embedder model + version matches.
- Generator model + version matches.
- Seed matches.
- All prompt templates referenced by hash match.

Anyone with access to the repo + the same model APIs can re-execute `python -m ragureap.cli replay --run <run_id>` and reproduce the metrics within bootstrap CI.

---

## 9. Extension Recipes

Adding a new technique:
1. Create `src/ragureap/techniques/rag/<name>/` (or `non_rag/<name>/`).
2. Implement `Technique` interface in `technique.py`.
3. Register via `@register("rag.<name>")`.
4. Add `configs/technique/<name>.yaml`.
5. Add `tests/unit/techniques/test_<name>.py`.
6. Add an entry in `docs/05_RAG_APPROACHES.md` or `06_NONRAG_APPROACHES.md`.

Adding a new domain:
1. Create `src/ragureap/domains/<name>/`.
2. Implement `DomainAdapter`, `prompts.yaml`, `manifest.yaml`.
3. Provide raw documents in `data/raw/<name>/`.
4. Provide `data/benchmarks/<name>/qa.jsonl`.
5. Add `configs/domain/<name>.yaml`.

These recipes are part of `CONTRIBUTING.md` once Phase 1 lands.
