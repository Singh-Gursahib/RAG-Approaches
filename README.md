# RAG_Ureap

> **A lightweight, reproducible comparison of 4 RAG and 3 non-RAG long-context strategies on a hand-authored test set — culminating in a short research paper.**

---

## 📌 Canonical Plan

The active plan is [**IMPLEMENTATION_PLAN.md**](IMPLEMENTATION_PLAN.md) — 10 phases, 7 approaches, $5 budget cap, `gemini-3-flash-preview` for all generation.

The older 15-phase / 21-technique research-grade plan is **archived** under [`archive/`](archive/) and should not be followed. It's preserved only as background reading.

---

## ⚡ For Future Agents / Contributors — Read This First

Before editing code, read in order:

1. **This `README.md`** — pointer + quickstart.
2. **[IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)** — canonical 10-phase plan with per-phase exit criteria.
3. **[PROGRESS.md](PROGRESS.md)** — current phase + next action.
4. **[DECISIONS.md](DECISIONS.md)** — design log.
5. **[FINDINGS.md](FINDINGS.md)** and **[EXPERIMENT_LOG.md](EXPERIMENT_LOG.md)** — results so far.

Workflow: user says `Go Phase N` → agent executes the phase end-to-end → updates PROGRESS / DECISIONS / EXPERIMENT_LOG / FINDINGS → reports exit-criteria status → waits.

---

## What This Project Is About

Modern LLMs have ballooning context windows (up to 10M tokens), but bigger windows do not solve the engineering problem of *delivering the right information to the model at the right time*. The community has produced **dozens of RAG variants** (GraphRAG, RAPTOR, HyDE, Self-RAG, Adaptive RAG, MemoRAG…) and **non-RAG long-context techniques** (full-context injection, KV cache compression, sliding-window attention, prompt compression, memory-augmented agents, recursive summarization). They are rarely benchmarked **against each other**, on the **same domain**, with the **same metrics**, under the **same cost model**.

This project closes that gap.

### Objectives

1. **Implement** 21+ techniques (13 RAG-based + 8 non-RAG) under a unified, swappable interface.
2. **Benchmark** them on 7 domains (legal, medical, education, finance, research, code, general).
3. **Propose & evaluate** 6 novel **hybrid architectures** that combine the best of multiple techniques.
4. **Produce** a decision framework — a defensible, evidence-backed "use X when Y" lookup.
5. **Publish** a research paper with reproducible artifacts.

---

## Approaches Being Explored

Full per-technique specs live in [docs/05_RAG_APPROACHES.md](docs/05_RAG_APPROACHES.md) and [docs/06_NONRAG_APPROACHES.md](docs/06_NONRAG_APPROACHES.md). Summary:

### RAG-based (13)

Naive Vector RAG · Hybrid RAG (BM25 + dense + RRF + rerank) · Parent-Child Retrieval · Multi-Query Retrieval · HyDE · Hierarchical RAG · RAPTOR · GraphRAG · MemoRAG · Self-RAG · Agentic RAG · Adaptive RAG · Contextual Compression RAG

### Non-RAG (8)

Full-Context Injection · Recursive Summarization · Sliding-Window Reasoning · Prompt Compression (LLMLingua-2) · Context Caching (Gemini explicit cache) · Memory-Augmented (MemGPT-style) · Multi-Agent Memory · Long-Context Native (Gemini 1.5/2 Pro reference)

### Hybrid Proposals (6 — the research contribution)

GraphRAG + Adaptive Router · RAPTOR + Multi-Query + Reranker · MemoRAG + Agentic Loop · Recursive Summarization + RAG fallback · Hybrid RAG + Context Caching · Domain Router → Per-Domain Best Stack

---

## Architecture (High Level)

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js / Streamlit)           │
│      Experiment runner · Comparison views · Pareto plots    │
└──────────────────────────┬──────────────────────────────────┘
                           │ REST / SSE
┌──────────────────────────▼──────────────────────────────────┐
│                    FastAPI experiment-runner                │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                    src/ragureap/ (core package)             │
│                                                             │
│   core/      ─ Interfaces, registry, config (Hydra)         │
│   techniques/─ One subpackage per RAG/non-RAG technique     │
│   domains/   ─ Per-domain dataset + prompt adapters         │
│   evaluation/─ Metrics, judge models, statistical tests     │
│   benchmarks/─ Benchmark suite definitions                  │
│   pipelines/ ─ Ingest · Index · Query · Compare             │
└──────┬──────────────────┬──────────────────┬────────────────┘
       │                  │                  │
       ▼                  ▼                  ▼
   Vector store      Graph store        LLM providers
   (Qdrant)          (Neo4j /           (Gemini API,
                      NetworkX)          Ollama local)

  Run artifacts → runs/<run_id>/ (manifest.json + outputs.jsonl + metrics.json)
```

Full details in [docs/02_PROJECT_ARCHITECTURE.md](docs/02_PROJECT_ARCHITECTURE.md).

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Language (backend) | Python 3.11+ | Ecosystem fit |
| Web framework | FastAPI | Async, typed, OpenAPI built-in |
| Embeddings | **Ollama + `nomic-embed-text`** (primary), plus `bge-m3` swap | Local, free, fast cold-start |
| Generator (cloud) | **Gemini** (1.5 Pro / 2.0 Flash for long-context, Pro for judge) | Long context, cost-effective |
| Generator (local, optional) | Ollama-hosted model | Ablation, reproducibility |
| Vector store | Qdrant (Docker) | Hybrid search native, fast, OSS |
| Graph store | NetworkX → Neo4j (Docker) | Prototype → scale |
| Reranker | Cross-encoder (`bge-reranker-v2-m3`); Cohere `rerank-3` swap | Quality + swap option |
| Config | Hydra | Composable experiment configs |
| Eval | RAGAS + custom harness | Faithfulness, recall, custom metrics |
| Frontend (MVP) | Streamlit | Fast iteration |
| Frontend (final) | Next.js 14 + Tailwind + shadcn/ui | Polished comparison dashboard |
| Tracking | JSONL run manifests + optional W&B | Offline-first, reproducible |

---

## Folder Structure (Target)

```
RAG_Ureap/
├── README.md                  ← THIS FILE — master handoff doc
├── PROGRESS.md                ← Current phase + checklist state
├── PHASES.md                  ← Full 15-phase lifecycle plan
├── DECISIONS.md               ← Architectural decision log (ADR-lite)
├── FINDINGS.md                ← Interim experimental conclusions
├── EXPERIMENT_LOG.md          ← Chronological run log
├── research.md                ← Original literature review
├── docs/                      ← Design specifications (00–14)
├── src/ragureap/              ← Main Python package
│   ├── core/                  ← Interfaces, registry, config
│   ├── techniques/            ← Technique implementations
│   │   ├── rag/               ← naive, hybrid, parent_child, …
│   │   └── non_rag/           ← full_context, recursive_summary, …
│   ├── domains/               ← legal, medical, education, …
│   ├── evaluation/            ← metrics, judges, stats
│   ├── benchmarks/            ← benchmark suite definitions
│   ├── pipelines/             ← ingest, index, query, compare
│   └── api/                   ← FastAPI app
├── data/
│   ├── raw/                   ← Source documents (gitignored)
│   ├── processed/             ← Chunked / indexed artifacts
│   └── benchmarks/            ← Ground-truth Q&A sets
├── runs/                      ← One folder per experiment run
├── frontend/                  ← Streamlit MVP, then Next.js
├── notebooks/                 ← Exploration + paper figures
├── scripts/                   ← CLI entry points
├── configs/                   ← Hydra YAML configs
└── tests/                     ← Pytest suites
```

---

## Current Status — At a Glance

> **Authoritative status lives in [PROGRESS.md](PROGRESS.md).** This block is a snapshot.

- **Current phase:** **Phase 0 — Research & Planning** (in progress)
- **Last update:** 2026-05-09
- **What is done:**
  - `research.md` literature review.
  - `docs/00_INDEX.md`, `docs/01_RESEARCH_ANALYSIS.md` written.
  - This `README.md`, `PHASES.md`, `PROGRESS.md`, `DECISIONS.md`, `FINDINGS.md`, `EXPERIMENT_LOG.md` initialized.
- **What is in flight:**
  - Remaining design docs (`docs/02` through `docs/14`).
- **What is next:**
  - Finalize design docs → user approval → **Phase 1 scaffolding**.

---

## How to Resume Work (Agent Handoff Protocol)

When a new session begins on this repo:

1. **Locate current phase.** Open `PROGRESS.md`. The phase listed under `## Current Phase` is authoritative.
2. **Verify with `git log`** if available — recent commits should align with the claimed phase.
3. **Read the corresponding section of `PHASES.md`** for the phase checklist.
4. **Pick up the first unchecked task.** Mark it `[~]` (in-progress) before starting.
5. **Update on every step:**
   - Tick `[x]` in `PHASES.md` when a task completes.
   - Append a one-line entry to `PROGRESS.md` under `## Activity Log`.
   - For design choices, add an ADR-lite entry to `DECISIONS.md`.
   - For experiment runs, append to `EXPERIMENT_LOG.md` with run id, config hash, headline metrics.
   - For interpretive insights, append to `FINDINGS.md`.
6. **End-of-session ritual:** before stopping, ensure `PROGRESS.md`'s `## Current Phase` and `## Next Action` reflect reality.

This lets a brand new agent type *"Read README, then continue from Phase N"* and pick up cleanly.

---

## Important Files (Reference Map)

| File | Purpose | Edit Frequency |
|---|---|---|
| `README.md` | Master handoff (this file) | Rare — only structural changes |
| `PROGRESS.md` | Current state, what's done/next | **Every session** |
| `PHASES.md` | 15-phase plan with checklists | When phase scope changes |
| `DECISIONS.md` | Architectural decisions | On each material decision |
| `FINDINGS.md` | Experimental conclusions | After each significant experiment |
| `EXPERIMENT_LOG.md` | Run-by-run log | After every experiment run |
| `research.md` | Original literature review | Rarely (append-only) |
| `docs/00_INDEX.md` | Index of design specs | When new design docs added |
| `docs/01_*` … `docs/14_*` | Design specifications | Rarely after Phase 0 |
| `runs/<id>/manifest.json` | Per-run reproducibility data | Auto-generated, never hand-edited |

---

## Development & Run Commands (Will Be Filled In Phase 1)

```bash
# Will be populated in Phase 1 once scaffolding lands.
# Planned commands:
make install            # Set up venv, deps, ollama models
make ingest DOMAIN=legal
make index TECHNIQUE=graph_rag DOMAIN=legal
make run EXPERIMENT=configs/experiments/legal_baselines.yaml
make compare RUNS=run_001,run_002,run_003
make ui                 # Launch Streamlit / Next.js dashboard
pytest                  # Run test suite
```

---

## License & Citation

License: TBD (recommend Apache 2.0 for academic + permissive use).
Citation: BibTeX block to be added once the paper has a title and venue.

---

## Contact / Ownership

- Project owner: **gursahib99888@gmail.com**
- AI agent collaborator: Claude (Anthropic), iterating across sessions via this repo's documentation system.

---

*This README is the handoff contract. Keep it accurate.*
