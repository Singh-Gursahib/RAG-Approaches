# PHASES.md — 15-Phase Lifecycle Plan

> The full project broken into discrete, trackable phases. Each phase has: a goal, a checklist, exit criteria, and the artifacts it produces. Mark `[x]` when a task completes, `[~]` for in-progress, `[ ]` for pending.

**How to use this file:**
- The current phase is recorded in [PROGRESS.md](PROGRESS.md) under `## Current Phase`.
- A phase is **complete** only when **all** of its checklist items are `[x]` AND its **exit criteria** are met.
- New tasks discovered mid-phase are added with `[ ]` and dated.
- Do not jump phases. If a downstream phase blocks an upstream one, document it in `DECISIONS.md` and adjust this file.

---

## Phase Overview

| # | Phase | Status | Outputs |
|---|---|---|---|
| 0 | Research & Planning | **In Progress** | All design docs in `docs/`, this file, `README.md`, tracking files |
| 1 | Repo Scaffolding & Core Infrastructure | Pending | `src/ragureap/core/`, configs, Docker, base interfaces |
| 2 | Data Ingestion & Domain Adapters | Pending | `src/ragureap/domains/`, ingestion pipelines, raw + processed data |
| 3 | Baseline Techniques (P0) | Pending | Naive RAG, Full-Context, Recursive Summarization implementations |
| 4 | Advanced Retrieval Techniques | Pending | Hybrid, Parent-Child, Multi-Query, HyDE, Hierarchical, Compression |
| 5 | Structured RAG (Tree / Graph / Memory) | Pending | RAPTOR, GraphRAG, MemoRAG |
| 6 | Agentic & Adaptive Techniques | Pending | Self-RAG, Agentic RAG (LangGraph), Adaptive RAG router |
| 7 | Advanced Non-RAG Techniques | Pending | Sliding-Window Reasoning, Prompt Compression, Context Caching, Memory-Augmented, Multi-Agent Memory, Long-Context Native baseline |
| 8 | Evaluation Framework | Pending | Metrics, judge model harness, RAGAS integration, statistical tests |
| 9 | Benchmark Suite & Adversarial Tests | Pending | Test banks, ground-truth Q&A, needle-in-haystack, multi-hop, hallucination, stress, adversarial |
| 10 | Frontend Dashboard | Pending | Streamlit MVP → Next.js dashboard |
| 11 | Hybrid Architecture Experiments | Pending | 6 novel hybrid implementations + ablations |
| 12 | Cross-Domain Experiments & Pareto Analysis | Pending | Per-domain leaderboards, cost/quality Pareto plots |
| 13 | Paper Drafting & Reproducibility Package | Pending | LaTeX draft, figures, appendix, reproducibility tarball |
| 14 | Polish & Public Release | Pending | License, public README, demo video, archived paper |

---

## Phase 0 — Research & Planning

**Goal:** Produce a complete, internally consistent design specification and tracking system before any implementation code is written.

**Exit criteria:**
- All 15 design documents in `docs/` exist and are consistent with each other.
- `README.md`, `PROGRESS.md`, `PHASES.md`, `DECISIONS.md`, `FINDINGS.md`, `EXPERIMENT_LOG.md` initialized.
- User has reviewed and **explicitly approved** the plan.

**Checklist:**
- [x] Read and analyze `research.md`.
- [x] Identify gaps and consolidate technique master list (`docs/01_RESEARCH_ANALYSIS.md`).
- [x] Write `docs/00_INDEX.md`.
- [x] Write `README.md` (master handoff doc).
- [x] Write `PHASES.md` (this file).
- [ ] Write `PROGRESS.md` initial state.
- [ ] Write `DECISIONS.md` with seed decisions.
- [ ] Write `FINDINGS.md` and `EXPERIMENT_LOG.md` skeletons.
- [ ] Write `docs/02_PROJECT_ARCHITECTURE.md`.
- [ ] Write `docs/03_BACKEND_DESIGN.md`.
- [ ] Write `docs/04_FRONTEND_DESIGN.md`.
- [ ] Write `docs/05_RAG_APPROACHES.md`.
- [ ] Write `docs/06_NONRAG_APPROACHES.md`.
- [ ] Write `docs/07_DATASETS.md`.
- [ ] Write `docs/08_BENCHMARKING.md`.
- [ ] Write `docs/09_EVALUATION.md`.
- [ ] Write `docs/10_HYBRID_PROPOSALS.md`.
- [ ] Write `docs/11_OBSERVABILITY.md`.
- [ ] Write `docs/12_PAPER_WORKFLOW.md`.
- [ ] Write `docs/13_TOOLS_AND_REPOS.md`.
- [ ] Write `docs/14_ROADMAP.md`.
- [ ] Collect open decisions from user (API keys, compute envelope, dataset access, frontend ambition, paper venue).
- [ ] User approval to proceed to Phase 1.

---

## Phase 1 — Repository Scaffolding & Core Infrastructure

**Goal:** Empty but production-shaped repository: package layout, configuration system, base interfaces, dev environment, CI hooks. No technique logic yet.

**Exit criteria:**
- `pip install -e .` succeeds in a fresh venv.
- `pytest` runs (with placeholder tests passing).
- `docker compose up` brings up Qdrant, Neo4j, Ollama (with `nomic-embed-text` pulled).
- `python -m ragureap.api` starts FastAPI with health endpoint.

**Checklist:**
- [ ] Initialize `pyproject.toml`, `uv` or `poetry`, `.python-version`.
- [ ] Initialize `src/ragureap/` package skeleton.
- [ ] Define `core/interfaces.py`: `Embedder`, `Retriever`, `Reranker`, `Generator`, `Technique`, `Evaluator`, `DomainAdapter`, `ChunkStrategy`.
- [ ] Implement `core/registry.py` (string → class registry, decorator-based).
- [ ] Implement `core/config.py` with Hydra integration; `configs/` tree.
- [ ] Implement `core/run_manifest.py` (manifest schema + writer).
- [ ] Implement `core/logging.py` (structured logs + per-run JSONL sink).
- [ ] Add `docker-compose.yml` for Qdrant + Neo4j + Ollama.
- [ ] Add `Makefile` with `install`, `lint`, `test`, `up`, `down`, `pull-models`.
- [ ] Add `scripts/pull_ollama_models.sh` (`nomic-embed-text`, optional generators).
- [ ] Add `tests/test_smoke.py`.
- [ ] Add `.github/workflows/ci.yml` (lint + tests).
- [ ] Add `.gitignore` (data/raw, runs/, .venv, etc).
- [ ] Initialize `git` (if not already) and first scaffolding commit.

---

## Phase 2 — Data Ingestion & Domain Adapters

**Goal:** Raw + processed corpora for all 7 domains, ingestion pipelines, and per-domain prompt packs.

**Exit criteria:**
- For every domain: ≥100 docs in `data/raw/<domain>/`, processed chunks in `data/processed/<domain>/`, manifest with hash.
- One canonical `DomainAdapter` per domain.
- Re-running ingestion is idempotent.

**Checklist:**
- [ ] Ingestion CLI: `python -m ragureap.pipelines.ingest --domain legal`.
- [ ] PDF + HTML + Markdown + JSON parsers (`pipelines/parse/`).
- [ ] Pluggable chunkers: fixed-size, recursive, semantic, document-aware.
- [ ] Domain adapters:
  - [ ] `domains/legal.py` — CourtListener / EUR-Lex / sample contracts.
  - [ ] `domains/medical.py` — PubMed abstracts + clinical guidelines.
  - [ ] `domains/education.py` — open-licensed textbooks (OpenStax).
  - [ ] `domains/finance.py` — SEC EDGAR filings.
  - [ ] `domains/research.py` — arXiv abstracts + selected full papers.
  - [ ] `domains/code.py` — selected GitHub repos (small + medium).
  - [ ] `domains/general.py` — Wikipedia subset / NaturalQuestions.
- [ ] Per-domain **prompt packs** (`domains/<x>/prompts.yaml`).
- [ ] Dataset hash + manifest writer.
- [ ] `data/README.md` documenting each corpus, source, license.

---

## Phase 3 — Baseline Techniques (P0)

**Goal:** Three end-to-end techniques runnable on every domain. These are the baselines every later technique is compared against.

**Exit criteria:**
- `make run TECHNIQUE=naive_rag DOMAIN=legal` produces a complete `runs/<id>/` artifact.
- Per-technique unit tests pass.
- A trivial benchmark (10 questions per domain) runs end-to-end with reported metrics.

**Checklist:**
- [ ] `techniques/rag/naive.py` — embed → top-k → generate.
- [ ] `techniques/non_rag/full_context.py` — load all docs, generate.
- [ ] `techniques/non_rag/recursive_summary.py` — map-reduce summarize → answer.
- [ ] Wire each technique into the registry.
- [ ] First end-to-end run on the legal domain.
- [ ] Smoke benchmark script `scripts/smoke_bench.py`.

---

## Phase 4 — Advanced Retrieval Techniques

**Goal:** All retrieval-side techniques that do **not** require structured indices (graph/tree) or agent loops.

**Exit criteria:** Each technique runs on every domain; per-technique config files exist; ablations enumerated.

**Checklist:**
- [ ] `techniques/rag/hybrid.py` — BM25 + dense + RRF + cross-encoder rerank.
- [ ] `techniques/rag/parent_child.py` — small-chunk index, large-chunk return.
- [ ] `techniques/rag/multi_query.py` — N rewrites + RRF fusion.
- [ ] `techniques/rag/hyde.py` — generated hypothetical doc embedding.
- [ ] `techniques/rag/hierarchical.py` — explicit doc/section/paragraph index.
- [ ] `techniques/rag/contextual_compression.py` — LongLLMLingua at retrieval time.
- [ ] Reranker module `core/reranker.py` (cross-encoder + Cohere swap).
- [ ] Per-technique configs in `configs/techniques/`.

---

## Phase 5 — Structured RAG (Tree / Graph / Memory)

**Goal:** Heavy-indexing techniques.

**Exit criteria:** Each runs on the legal + research + medical domains (graph-rich domains); offline indexing time is recorded; query latency is recorded.

**Checklist:**
- [ ] `techniques/rag/raptor.py` — clustering + LLM summarization tree.
- [ ] `techniques/rag/graph_rag.py` — entity/relation extraction + community summaries (use Microsoft GraphRAG OSS as reference; reimplement minimal version).
- [ ] `techniques/rag/memo_rag.py` — global memory + clue-driven retrieval.
- [ ] Graph store integration (Neo4j) for GraphRAG.
- [ ] Indexing-time / storage-cost telemetry.

---

## Phase 6 — Agentic & Adaptive Techniques

**Goal:** Multi-step / reasoning-driven techniques.

**Exit criteria:** Reproducible runs (despite stochasticity) via fixed seeds + temperature 0; bounded loop guarantees (max steps).

**Checklist:**
- [ ] `techniques/rag/self_rag.py` — reflection-token loop.
- [ ] `techniques/rag/agentic.py` — LangGraph state machine with retrieval tool.
- [ ] `techniques/rag/adaptive.py` — query router (no-retrieve / single-step / multi-step) + dispatcher.
- [ ] Loop-bound + cost-bound guards.

---

## Phase 7 — Advanced Non-RAG Techniques

**Goal:** Non-RAG long-context strategies.

**Checklist:**
- [ ] `techniques/non_rag/sliding_window_reasoning.py` — chunk-by-chunk answer aggregation.
- [ ] `techniques/non_rag/prompt_compression.py` — LLMLingua-2 wrapper.
- [ ] `techniques/non_rag/context_cache.py` — Gemini explicit cache wrapper.
- [ ] `techniques/non_rag/memgpt.py` — tiered memory + read/write tools.
- [ ] `techniques/non_rag/multi_agent_memory.py` — planner / retriever / writer / critic.
- [ ] `techniques/non_rag/long_context_native.py` — Gemini 1.5/2 Pro reference, 128K and 1M variants.

---

## Phase 8 — Evaluation Framework

**Goal:** Every metric we will report on, plus statistical infrastructure.

**Exit criteria:** Every technique × domain run automatically produces a `metrics.json`. Bootstrap CI utility, paired Wilcoxon, multiple-comparison correction all callable.

**Checklist:**
- [ ] `evaluation/metrics/` — accuracy (EM/F1), faithfulness, answer relevance, retrieval precision/recall, context utilization.
- [ ] RAGAS integration.
- [ ] Judge-model harness with `gpt-4o` / `gemini-pro` and rubric prompts.
- [ ] Hallucination rate measurement (claim-level, against retrieved or reference).
- [ ] Cost + latency + memory recorder (token counts, wall-clock, peak RSS).
- [ ] `evaluation/stats/` — bootstrap CIs, paired Wilcoxon, Holm correction.
- [ ] Per-run `metrics.json` schema.

---

## Phase 9 — Benchmark Suite & Adversarial Tests

**Goal:** A fixed, versioned set of test banks per domain.

**Exit criteria:** `benchmarks/<domain>/qa.jsonl` and `benchmarks/<domain>/adversarial.jsonl` exist and are hashed; ground-truth answers are double-checked (synth + small human spot check).

**Checklist:**
- [ ] Q&A generation pipeline (LLM-assisted, human-spot-checked).
- [ ] Needle-in-haystack at 5 depths × 7 domains.
- [ ] Multi-hop chains of length 2, 3, 4, 5.
- [ ] Hallucination tests (questions whose answer is **not** in the corpus).
- [ ] Adversarial tests: prompt injection in retrieved chunks, contradictory chunks, distractors.
- [ ] Long-context stress tests (1K → 10K → 100K → 1M tokens of distractors).
- [ ] Retrieval-quality tests (annotated relevant chunks).
- [ ] Reasoning-quality tests (chain-of-thought verification).
- [ ] 100-query human-judged sub-sample per domain.

---

## Phase 10 — Frontend Dashboard

**Goal:** Visual experiment runner, comparison views, Pareto plots.

**Exit criteria:** Streamlit MVP allows: select technique × domain, run, see metrics; Next.js version supports comparison across runs and Pareto plots.

**Checklist:**
- [ ] Streamlit MVP (`frontend/streamlit_app.py`).
- [ ] Run launcher → SSE log stream from FastAPI.
- [ ] Comparison page (multi-run side-by-side).
- [ ] Pareto plot page (cost vs quality, latency vs quality).
- [ ] Next.js scaffold (`frontend/web/`).
- [ ] Tailwind + shadcn/ui setup.
- [ ] Comparison + Pareto components.
- [ ] Run history + filtering.

---

## Phase 11 — Hybrid Architecture Experiments

**Goal:** The 6 hybrid proposals from `docs/10_HYBRID_PROPOSALS.md`, implemented and benchmarked.

**Checklist:**
- [ ] Hybrid #1 — GraphRAG + Adaptive Router.
- [ ] Hybrid #2 — RAPTOR + Multi-Query + Reranker.
- [ ] Hybrid #3 — MemoRAG + Agentic Loop.
- [ ] Hybrid #4 — Recursive Summarization + RAG fallback.
- [ ] Hybrid #5 — Hybrid RAG + Context Caching.
- [ ] Hybrid #6 — Domain Router → Per-Domain Best Stack (meta).
- [ ] Ablation matrix per hybrid.
- [ ] Cost / quality reports.

---

## Phase 12 — Cross-Domain Experiments & Pareto Analysis

**Goal:** The full-matrix experimental sweep that backs the paper.

**Checklist:**
- [ ] Run technique × domain × seed matrix (≥3 seeds per cell).
- [ ] Bootstrap CIs computed.
- [ ] Per-domain leaderboards.
- [ ] Pareto plots (cost vs quality, latency vs quality, memory vs quality).
- [ ] Per-domain "best technique" tables with statistical significance.
- [ ] `FINDINGS.md` synthesis section.

---

## Phase 13 — Paper Drafting & Reproducibility Package

**Goal:** A complete LaTeX draft + a tarball that re-runs every result.

**Checklist:**
- [ ] Paper outline (`paper/outline.md`).
- [ ] Abstract, intro, related work, method, experiments, ablations, discussion, conclusion.
- [ ] Figures from `notebooks/figures/`.
- [ ] Appendix: full hyperparameters, prompt templates, dataset cards.
- [ ] Reproducibility tarball script (`scripts/build_repro.sh`).
- [ ] Anonymized submission package.

---

## Phase 14 — Polish & Public Release

**Checklist:**
- [ ] License (Apache 2.0 recommended) + LICENSE file.
- [ ] Public README polish + demo GIFs.
- [ ] Archived release on Zenodo (DOI).
- [ ] Demo video (5–10 min walkthrough).
- [ ] Final blog post / project page.

---

## Adding New Tasks Mid-Phase

Format: `- [ ] (added 2026-MM-DD) <task description>`. Always date-stamp insertions so we can audit drift.

## Skipping or Deferring Tasks

If a task is dropped or moved, do NOT delete it; strike it through and link to the `DECISIONS.md` entry: `- [~] ~~old task~~ — deferred, see DECISIONS.md#YYYY-MM-DD-deferral-name`.
