# RAG_Ureap — Implementation Roadmap Index

> A research-grade experimental framework for comparing **RAG-based** and **non-RAG-based** long-context handling techniques in Large Language Models, across multiple real-world domains.

This `/docs` directory holds the **full implementation roadmap** that precedes any code in this repository. Each file is a self-contained section of the roadmap; together they form the design specification for a publishable research project.

---

## Top-Level Living Documents (Repository Root)

These files at the **repository root** are the handoff and tracking layer. New agents should read them **before** opening anything in `docs/`:

| File | Purpose | Edit Frequency |
|---|---|---|
| [../README.md](../README.md) | Master handoff document — entry point for any new contributor / agent | Rare (structural changes only) |
| [../PROGRESS.md](../PROGRESS.md) | Live state: current phase, what's done, what's next | **Every session** |
| [../PHASES.md](../PHASES.md) | Full 15-phase lifecycle plan with checklists | When phase scope changes |
| [../DECISIONS.md](../DECISIONS.md) | Architectural decision log (ADR-lite) | On each material decision |
| [../FINDINGS.md](../FINDINGS.md) | Interim experimental conclusions | After significant experiments |
| [../EXPERIMENT_LOG.md](../EXPERIMENT_LOG.md) | Chronological run ledger | After every run |

The files in this `docs/` directory below are **static design specifications** that change rarely after Phase 0.

---

## Reading Order

| # | Document | Purpose |
|---|---|---|
| 00 | [00_INDEX.md](00_INDEX.md) | This file — table of contents and navigation |
| 01 | [01_RESEARCH_ANALYSIS.md](01_RESEARCH_ANALYSIS.md) | Deep analysis of `research.md`, identified gaps, additional techniques to add |
| 02 | [02_PROJECT_ARCHITECTURE.md](02_PROJECT_ARCHITECTURE.md) | High-level system architecture, folder structure, module boundaries |
| 03 | [03_BACKEND_DESIGN.md](03_BACKEND_DESIGN.md) | Python backend: framework choice, services, APIs, configuration |
| 04 | [04_FRONTEND_DESIGN.md](04_FRONTEND_DESIGN.md) | UI/dashboard architecture, comparison views, experiment runner UX |
| 05 | [05_RAG_APPROACHES.md](05_RAG_APPROACHES.md) | Implementation specs for each RAG technique (Naive, Hybrid, Graph, RAPTOR, HyDE, MemoRAG, Agentic, Self-RAG, Adaptive, Multi-Query, Parent-Child, Hierarchical, Compression-based) |
| 06 | [06_NONRAG_APPROACHES.md](06_NONRAG_APPROACHES.md) | Implementation specs for non-RAG techniques (Full-context, KV compression, Sliding-window, Memory-augmented, Prompt compression, Recursive summarization, State-space, Caching, Routing) |
| 07 | [07_DATASETS.md](07_DATASETS.md) | Per-domain corpora (legal, medical, education, finance, research, code, general), synthesis pipelines, ground-truth construction |
| 08 | [08_BENCHMARKING.md](08_BENCHMARKING.md) | Benchmark suites, test taxonomies (needle-in-haystack, multi-hop, adversarial, hallucination, stress, retrieval-quality, reasoning-quality), reproducibility |
| 09 | [09_EVALUATION.md](09_EVALUATION.md) | Metrics: accuracy, faithfulness, latency, cost, memory, hallucination rate, retrieval precision/recall, end-to-end quality |
| 10 | [10_HYBRID_PROPOSALS.md](10_HYBRID_PROPOSALS.md) | Proposed novel hybrid architectures combining the best of RAG + non-RAG |
| 11 | [11_OBSERVABILITY.md](11_OBSERVABILITY.md) | Logging, tracing, run manifests, dashboards, experiment ledger |
| 12 | [12_PAPER_WORKFLOW.md](12_PAPER_WORKFLOW.md) | Research paper structure, figure generation, statistical reporting, reproducibility package |
| 13 | [13_TOOLS_AND_REPOS.md](13_TOOLS_AND_REPOS.md) | Recommended frameworks, repos to clone/study, datasets to pull |
| 14 | [14_ROADMAP.md](14_ROADMAP.md) | Phased delivery timeline with milestones |

---

## Project Goals (Charter)

The repository is **not** "another RAG app." Its goals, in priority order:

1. **Comparative experimentation** — implement the major RAG and non-RAG long-context strategies under a unified, swappable interface so they can be compared apples-to-apples.
2. **Domain-aware benchmarking** — run the same techniques across **legal, medical, education, finance, research, code, and general-purpose QA** corpora and quantify per-domain trade-offs.
3. **Hybrid architecture research** — propose, build, and evaluate **novel hybrids** (e.g., GraphRAG + KV compression + agentic routing) that combine strengths of multiple approaches.
4. **Decision framework** — produce a defensible, evidence-backed answer to: *"What is the best long-context strategy for a given use case?"*
5. **Research-paper foundation** — design the framework from day one to produce publishable artifacts (reproducible results, statistical rigor, clear ablations).

---

## Guiding Principles

- **Pluggable everything.** Embedders, retrievers, rerankers, generators, evaluators are interfaces. Swapping `nomic-embed-text` for `bge-m3` should be a config change, not a code change.
- **Run-as-artifact.** Every experiment run produces a manifest (config + git SHA + dataset hash + raw outputs + metrics) under `runs/` so any result is reproducible offline.
- **Cost honesty.** Every technique reports tokens-in / tokens-out / wall-clock latency / GPU-seconds (where applicable). No "the answer was good" without "...at $X / Y ms."
- **Domain neutrality at the core.** Domain logic lives in dataset adapters and prompt packs, not in technique implementations. A new domain = new adapter, not new code paths.
- **Statistical rigor.** Multiple seeds, bootstrapped confidence intervals, paired tests when comparing techniques on the same queries.
- **Avoid framework lock-in.** Use LangChain / LlamaIndex / Haystack opportunistically (for rerankers, parsers) but the core orchestration is our own — frameworks change quarterly; the experimental ledger must outlast them.

---

## Tech Stack (Finalized in 02 / 03 / 04)

- **Backend:** Python 3.11+, FastAPI for the experiment-runner API.
- **LLM inference:** Gemini (cloud, primary generator), Ollama (local — `nomic-embed-text` for embeddings, optional local generators for ablation).
- **Vector store:** Qdrant (local, supports hybrid search natively) with an interface allowing swap to Chroma / pgvector.
- **Graph store:** NetworkX in-memory for prototyping; Neo4j (Docker) for GraphRAG-scale experiments.
- **Orchestration:** Hydra for config; DVC or simple JSONL run-manifests for experiment tracking; Weights & Biases optional.
- **Frontend:** Next.js + Tailwind + shadcn/ui dashboard. Streamlit fallback for quick internal pages.
- **Testing/Eval:** Pytest, RAGAS for retrieval/generation metrics, custom harness for our own metrics.

---

## What Lives Where (Preview of `02_PROJECT_ARCHITECTURE.md`)

```
RAG_Ureap/
├── docs/                  # This roadmap
├── research.md            # Original literature review
├── src/ragureap/          # Main Python package
│   ├── core/              # Interfaces, registry, config
│   ├── techniques/        # One subpackage per RAG/non-RAG technique
│   ├── domains/           # Domain adapters (legal, medical, ...)
│   ├── evaluation/        # Metrics, evaluators, statistical tests
│   ├── benchmarks/        # Benchmark suite definitions
│   ├── pipelines/         # Ingestion, indexing, query, comparison
│   └── api/               # FastAPI app
├── data/
│   ├── raw/               # Source documents (gitignored)
│   ├── processed/         # Chunked, indexed artifacts
│   └── benchmarks/        # Ground-truth Q&A sets
├── runs/                  # Per-experiment manifests + outputs
├── frontend/              # Next.js dashboard
├── notebooks/             # Exploration, paper figures
├── scripts/               # CLI entry points
└── tests/
```

---

## Status & Next Steps

This index is the entry point. The numbered docs are written progressively (~400 lines per turn) — they will be filled in over the next several responses. After all roadmap files are complete, scaffolding (`src/`, `frontend/`, configs) will begin **only after explicit user approval** of the plan.

**Currently complete:** 00_INDEX, 01_RESEARCH_ANALYSIS.
**Next:** 02_PROJECT_ARCHITECTURE.

---

*Last updated: 2026-05-09*
