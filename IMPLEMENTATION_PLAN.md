# IMPLEMENTATION_PLAN.md — Lean 10-Phase Plan

> **This file supersedes [PHASES.md](PHASES.md).** PHASES.md is preserved as historical context only — do not follow it. The 15-phase / 21-technique / 7-domain scope was deliberately reduced to a tractable, paper-yielding research project.
>
> **Workflow contract.** The user says `Go Phase N`. The agent executes the entire phase, commits artifacts, updates [PROGRESS.md](PROGRESS.md), and reports back with the exit-criteria check. Then the user says `Go Phase N+1`. Phases are linear; do not skip.

---

## 1. Project Goal (Restated, Tight)

Compare **4 RAG approaches** and **3 non-RAG approaches** on the **same benchmark** with the **same metrics** and the **same cost model**, then produce:

1. A reproducible experimental codebase.
2. A results table + Pareto plot (quality vs. cost vs. latency).
3. A first-draft research paper backed by those results.

That's it. No 7-domain sweep. No 21 techniques. No graph databases. No agent loops.

---

## 2. Approaches Selected (and Why)

### RAG (4)

| # | Approach | Why included | Implementation cost |
|---|---|---|---|
| R1 | **Naive Vector RAG** (embed → top-k → generate) | Floor baseline. Every other RAG variant must beat this to justify itself. | Tiny |
| R2 | **Hybrid RAG** (BM25 + dense, RRF fusion) | Strongest "simple" RAG in literature. Tests whether lexical signal adds value over pure embeddings. | Small |
| R3 | **HyDE** (generate hypothetical answer → embed it → retrieve) | Tests whether query-rewriting at embedding time beats raw-query retrieval. Cheap to add. | Small |
| R4 | **Cross-Encoder Reranker** (vector top-N → bge-reranker → top-k) | Tests whether late-stage relevance scoring beats one-shot retrieval. Standard production pattern. | Small |

### Non-RAG (3)

| # | Approach | Why included | Implementation cost |
|---|---|---|---|
| N1 | **Full-Context Injection** | Upper bound when the corpus fits. Tests whether RAG is even necessary at this scale. | Trivial |
| N2 | **Recursive Summarization** (map → reduce → answer) | Tests information compression when corpus exceeds context. Cheap, classic technique. | Small |
| N3 | **Sliding-Window Reasoning** (chunk-by-chunk answer + aggregate) | Tests local-reasoning + aggregation vs. retrieval. Different failure modes than recursive summary. | Small |

### Explicitly Dropped (vs. old plan)

GraphRAG, RAPTOR, MemoRAG, Self-RAG, Agentic RAG, Adaptive RAG, Parent-Child, Multi-Query, Hierarchical, Contextual Compression, Prompt Compression (LLMLingua-2), Context Caching, MemGPT, Multi-Agent Memory, Long-Context Native, and all 6 hybrids. If results are interesting, these become future-work bullets in the paper.

---

## 3. Dataset Strategy — Hand-Crafted Test Set

We **do not** use HotpotQA or any external benchmark. The full sweep budget is **$5 hard cap**, so we author a small, controlled test set we know cold. The agent writes the questions + gold answers up front; later the user grades the model's outputs; then the agent re-verifies via grep / direct inspection of the source corpus.

### Composition (~30–40 questions across 4 probe types)

| Probe type | # Qs | What it tests | How we build it |
|---|---|---|---|
| **Needle-in-haystack** | 8 | Can the approach retrieve a single specific fact buried in a long document of distractors? | Insert distinctive sentences ("The hidden token is `MULBERRY-7Q`.") at varying depths in a synthetic ~5–8K-token doc. |
| **Multi-hop reasoning** | 8 | Can the approach combine 2–3 facts spread across the corpus? | Author small fact graphs ("X is in Y; Y is in Z; therefore X is in Z?") spread across separate chunks. |
| **Distractor robustness** | 8 | Does the approach get fooled by chunks that look topical but don't contain the answer? | Pair gold chunks with near-duplicate distractors that share keywords but contradict or omit the answer. |
| **Out-of-corpus / hallucination probe** | 6 | Does the approach correctly say "not in the corpus" rather than fabricate? | Questions whose answer is verifiably absent. Gold answer is "I don't know" or a structured refusal. |
| **Sanity baseline** | 4 | Trivially answerable; floor check. | Single-fact, single-chunk Qs. |

Total: ~34 questions, all with **author-known gold answers** stored in `tests/eval_set.jsonl`.

### Corpus design

A single **synthetic corpus** (~15–25K tokens total) we control end-to-end. Built from:

- 3–5 author-written "documents" (each 2K–5K tokens) with realistic prose + the planted facts above.
- Optionally, a few public-domain sources (Wikipedia article dumps, Project Gutenberg excerpts) for filler / distractor pressure.

This corpus is committed to the repo (it's small) under `data/eval_corpus/` so the entire experiment is hermetic and reproducible without network.

### Per-approach data shaping

| Approach | What it sees | Chunking |
|---|---|---|
| Naive / Hybrid / HyDE / Reranker | Full corpus indexed once; retrieve top-k per question | Sentence-window (~150 tokens, 30 overlap) |
| Full-Context | Entire corpus concatenated | No chunking |
| Recursive Summary | Document-level summaries → combined summary → answer | Per-document |
| Sliding-Window | One chunk at a time, carry-over running answer | Sentence-window |

### Grading workflow (the user's requirement)

1. **Write tests first** — agent authors questions + gold answers in `tests/eval_set.jsonl` *before* running any approach.
2. **Run approaches** — each writes `runs/<id>/predictions.jsonl`.
3. **Auto-grade** — exact-match + token-F1 against gold answers (deterministic, free).
4. **User spot-check** — user reviews a small sample to confirm grades look right.
5. **Agent verifies** — for any disputed answer, the agent greps the corpus and re-confirms what the gold should be. Confirmed corrections update `tests/eval_set.jsonl`.

---

## 4. Tech Stack (Lightweight)

| Layer | Choice | Rationale |
|---|---|---|
| Language | Python 3.11+ | Standard. |
| Embedding model | `sentence-transformers/all-MiniLM-L6-v2` | Fast, 384-dim, runs on CPU. No Ollama dep. |
| Reranker | `BAAI/bge-reranker-base` (via sentence-transformers) | Light cross-encoder, CPU-OK. |
| Vector store | **ChromaDB** (local, file-based) | No Docker, no server. `pip install` and go. |
| BM25 | `rank_bm25` | Pure-Python, in-memory, ~50 LOC integration. |
| Generator LLM | **`gemini-3-flash-preview`** (via `google-generativeai`) | User-specified. Single model for *all* approaches keeps the comparison clean and the cost model honest. |
| LLM-as-judge | Same model (`gemini-3-flash-preview`) | Optional faithfulness scoring on a small sample only — EM/F1 don't need a judge. Keeps spend bounded. |
| Config | Plain YAML + `pydantic-settings` | No Hydra. |
| Run log | JSONL files in `runs/<run_id>/` + DuckDB views for analysis | No W&B, no MLflow. |
| Tests | Pytest, minimal | Smoke + 1 e2e per approach. |
| UI | **Streamlit** with a custom theme | Clean, fast to iterate, deployable as a single command. |
| Plots | Plotly (interactive in UI) + matplotlib (paper figures) | Standard. |

**Hard rule:** no Docker, no Neo4j, no Qdrant, no LangGraph, no LangChain, no Ollama-required path. If a dependency adds an infra step, justify it in `DECISIONS.md` before adding it.

---

## 5. Repository Shape (Final Target)

```
RAG_Ureap/
├── README.md                    ← Updated in Phase 1 to point at this plan
├── IMPLEMENTATION_PLAN.md       ← THIS FILE (canonical)
├── PROGRESS.md                  ← Live status (updated every phase)
├── DECISIONS.md                 ← Append-only design log
├── FINDINGS.md                  ← Append-only experimental notes
├── EXPERIMENT_LOG.md            ← One line per run
├── PHASES.md                    ← Historical (do not follow)
├── pyproject.toml
├── .env.example                 ← GOOGLE_API_KEY placeholder
├── Makefile                     ← install, lint, test, ingest, run, ui
├── configs/
│   ├── base.yaml
│   └── approaches/{naive,hybrid,hyde,rerank,full_context,recursive_summary,sliding_window}.yaml
├── src/ragureap/
│   ├── __init__.py
│   ├── config.py                ← pydantic-settings + YAML loader
│   ├── data/
│   │   ├── hotpot.py            ← loader + split builder
│   │   └── chunk.py             ← sentence-window chunker
│   ├── indexing/
│   │   ├── chroma_store.py
│   │   └── bm25_store.py
│   ├── llm/
│   │   ├── gemini.py            ← single Gemini wrapper (Flash + Pro)
│   │   └── embedding.py
│   ├── approaches/
│   │   ├── base.py              ← `Approach` protocol
│   │   ├── naive.py
│   │   ├── hybrid.py
│   │   ├── hyde.py
│   │   ├── rerank.py
│   │   ├── full_context.py
│   │   ├── recursive_summary.py
│   │   └── sliding_window.py
│   ├── eval/
│   │   ├── metrics.py           ← EM, F1, retrieval recall, support-fact recall
│   │   ├── judge.py             ← LLM faithfulness rubric
│   │   ├── cost.py              ← tokens × price table → USD
│   │   └── stats.py             ← bootstrap CI, paired Wilcoxon
│   ├── runner.py                ← orchestrates a single (approach, question-set) run
│   └── analysis.py              ← aggregate runs → tables + plots
├── frontend/
│   └── app.py                   ← Streamlit dashboard
├── data/
│   ├── raw/hotpotqa/            ← gitignored
│   └── processed/               ← gitignored, hashed
├── runs/<run_id>/               ← gitignored
│   ├── manifest.json
│   ├── predictions.jsonl
│   ├── metrics.json
│   └── trace.jsonl
├── notebooks/
│   └── figures.ipynb            ← paper figure generation
├── paper/
│   ├── outline.md
│   ├── draft.md                 ← Phase 10 deliverable
│   └── figures/
└── tests/
    ├── test_smoke.py
    ├── test_chunk.py
    ├── test_metrics.py
    └── test_approaches_e2e.py
```

---

## 6. AI-First Development Conventions

These conventions exist so any future agent can pick up cleanly:

1. **One approach = one file** in `src/ragureap/approaches/`. Each implements the same `Approach` protocol (`build(corpus) -> Index`, `answer(question, index) -> AnswerWithTrace`). Swapping an approach is a one-line config change.
2. **Every run produces `runs/<run_id>/` with manifest, predictions, metrics, trace.** No exceptions. Manifest captures: git SHA, config YAML hash, dataset hash, package versions, env vars (redacted), wall-clock, total tokens.
3. **Trace is structured.** Every retrieval step / LLM call writes a row to `trace.jsonl` with `{step, input, output, tokens_in, tokens_out, latency_ms, cost_usd}`. This is what makes per-approach cost honest.
4. **Re-running is idempotent.** Same config + same dataset hash → if a `runs/<id>/` already exists with matching manifest, skip unless `--force`.
5. **All config is YAML.** No CLI flags drive experiments — only `--config path.yaml` + optional `--override key=value` for sweeps.
6. **Single update protocol:** at the end of every phase, update `PROGRESS.md`, append to `DECISIONS.md` if a design call was made, append to `FINDINGS.md` if results surprised us, append to `EXPERIMENT_LOG.md` for every run.

---

## 7. The 10 Phases

Each phase below has: **Goal · Exit criteria · Tasks · Deliverables · Estimated turnaround.** Mark `[x]` when done.

---

### Phase 1 — Foundation & Cleanup

**Goal.** A clean, installable Python package. Old planning docs preserved but de-emphasized. Repo is ready for code.

**Exit criteria.**
- `pip install -e .` succeeds in a fresh venv.
- `pytest` runs (one passing smoke test).
- `make help` lists targets.
- `README.md` top-section points at `IMPLEMENTATION_PLAN.md` as canonical.

**Tasks.**
- [ ] Write `pyproject.toml` (deps: `chromadb`, `rank-bm25`, `sentence-transformers`, `google-generativeai`, `pydantic`, `pydantic-settings`, `pyyaml`, `streamlit`, `plotly`, `pandas`, `duckdb`, `pytest`, `python-dotenv`).
- [ ] Create `src/ragureap/` package skeleton with empty `__init__.py` files matching the tree in §5.
- [ ] Create `configs/base.yaml` with placeholder fields (dataset path, embedding model, LLM model, top-k).
- [ ] Write `src/ragureap/config.py` (pydantic-settings + YAML loader).
- [ ] Write `Makefile` (`install`, `lint`, `test`, `ingest`, `run`, `ui`, `clean`).
- [ ] Write `.env.example` with `GOOGLE_API_KEY=`.
- [ ] Write `.gitignore` (`.venv/`, `data/`, `runs/`, `__pycache__/`, `.env`, `*.egg-info/`).
- [ ] Write `tests/test_smoke.py` (imports the package, asserts version exists).
- [ ] Update `README.md` header to redirect to `IMPLEMENTATION_PLAN.md`. Add a "Current Plan" callout. Do **not** rewrite the whole README.
- [ ] Update `PROGRESS.md` to reflect the new plan (mark Phase 0 as "superseded" and start Phase 1 tracking).

**Deliverables.** Installable package. Updated PROGRESS.md. Updated README pointer.

**Estimated turnaround.** Single agent session.

---

### Phase 2 — Corpus & Eval Set Authoring

**Goal.** Author the synthetic corpus + the ~34-question eval set with gold answers. Sentence-window chunker working.

**Exit criteria.**
- `data/eval_corpus/*.txt` exists (3–5 documents, ~15–25K tokens total).
- `tests/eval_set.jsonl` exists with ~34 questions, each `{id, type, question, gold_answer, source_doc, source_span}`.
- Every gold answer is verifiable by grep against the corpus (or, for hallucination probes, *not* findable — confirmed).
- Sentence-window chunker unit-tested.

**Tasks.**
- [ ] Author 3–5 corpus documents in `data/eval_corpus/` (mix of original prose + planted facts at known depths).
- [ ] Author `tests/eval_set.jsonl` covering all 5 probe types in §3.
- [ ] `src/ragureap/data/corpus.py`: load + tokenize documents.
- [ ] `src/ragureap/data/chunk.py`: sentence-window chunker (~150 tokens, 30 overlap).
- [ ] `src/ragureap/data/eval_set.py`: loader + schema validation.
- [ ] Self-verify: for every non-hallucination question, grep the corpus for the gold span; for hallucination probes, grep and confirm absence.
- [ ] `tests/test_chunk.py` + `tests/test_eval_set.py`.

**Deliverables.** Hermetic corpus + eval set. Chunker. Verification proof in `FINDINGS.md`.

**Estimated turnaround.** Single session.

---

### Phase 3 — Indexing Infrastructure

**Goal.** Embedding + Chroma + BM25 indexes built once over the full eval corpus, all behind a tidy interface.

**Exit criteria.**
- Both indexes build in <10s over the full ~20K-token corpus.
- `ChromaStore.search(query, k)` and `BM25Store.search(query, k)` return ranked `(chunk_id, score)` lists.
- Embedding model is cached on first load.
- `tests/test_indexing.py` covers build + search round-trip.

**Tasks.**
- [ ] `src/ragureap/llm/embedding.py`: thin wrapper around `sentence-transformers/all-MiniLM-L6-v2`. Lazy-loaded, cached.
- [ ] `src/ragureap/indexing/chroma_store.py`: in-memory Chroma collection per question (HotpotQA mode) + persistent collection support (corpus mode for stretch dataset).
- [ ] `src/ragureap/indexing/bm25_store.py`: `rank_bm25.BM25Okapi` wrapper with tokenization.
- [ ] `src/ragureap/indexing/fusion.py`: Reciprocal Rank Fusion (RRF) helper.
- [ ] `tests/test_indexing.py`.

**Deliverables.** Two index backends + RRF helper. All unit-tested.

**Estimated turnaround.** Single session.

---

### Phase 4 — Baseline RAG (Naive) + Runner + Eval Skeleton

**Goal.** End-to-end pipeline: load split → build index → answer questions → score → write `runs/<id>/`. Naive RAG works. EM/F1/support-fact recall computed.

**Exit criteria.**
- `make run config=configs/approaches/naive.yaml` produces `runs/<id>/` with manifest, predictions, metrics over the full ~34-question eval set.
- Reported EM > 0 (the trivial sanity Qs at minimum).
- Single run spends <$0.20 of the $5 cap.

**Tasks.**
- [ ] `src/ragureap/llm/gemini.py`: wraps `google-generativeai` with `gemini-3-flash-preview`. Tracks tokens in/out + cost per call. Retries on rate-limit. **Budget guard:** abort if cumulative USD exceeds `BUDGET_CAP` (default $5).
- [ ] `src/ragureap/approaches/base.py`: defines `Approach` protocol + `AnswerWithTrace` dataclass.
- [ ] `src/ragureap/approaches/naive.py`: embed query → Chroma top-k=5 → prompt template → generate.
- [ ] `src/ragureap/eval/metrics.py`: token-level EM, F1; per-probe-type accuracy; hallucination-probe correctness (refusal detected vs. fabrication).
- [ ] `src/ragureap/eval/cost.py`: `gemini-3-flash-preview` price table → USD per run; budget cap utility.
- [ ] `src/ragureap/runner.py`: orchestrates a single run, writes all four artifacts in `runs/<id>/`.
- [ ] `configs/approaches/naive.yaml`.
- [ ] `tests/test_metrics.py` (canned examples with known EM/F1).
- [ ] First end-to-end run on the eval set; record headline metrics in `EXPERIMENT_LOG.md`.

**Deliverables.** Working naive RAG. Runner. Metrics. First numbers.

**Estimated turnaround.** Single session.

---

### Phase 5 — Advanced RAG (Hybrid, HyDE, Reranker)

**Goal.** Three more RAG approaches, each isolated to its own file, each runnable end-to-end on the smoke set.

**Exit criteria.**
- Four RAG approach configs run cleanly: `naive`, `hybrid`, `hyde`, `rerank`.
- Each writes its own `runs/<id>/` artifact.
- Eval-set metrics for all four are in `EXPERIMENT_LOG.md`.
- All four can be invoked with `make run config=configs/approaches/<name>.yaml`.
- Combined spend across all four runs stays within $1 of the $5 cap.

**Tasks.**
- [ ] `src/ragureap/approaches/hybrid.py`: dense top-N + BM25 top-N → RRF → top-k → generate.
- [ ] `src/ragureap/approaches/hyde.py`: Gemini Flash generates a 1-paragraph hypothetical answer → embed it → Chroma top-k → generate.
- [ ] `src/ragureap/approaches/rerank.py`: dense top-20 → bge-reranker-base → top-5 → generate.
- [ ] Reranker wrapper in `src/ragureap/indexing/reranker.py`.
- [ ] Configs: `hybrid.yaml`, `hyde.yaml`, `rerank.yaml`.
- [ ] e2e test per approach in `tests/test_approaches_e2e.py` (1 question each, asserts answer non-empty + trace shape).
- [ ] Run all 4 RAG approaches on the eval set; log to `EXPERIMENT_LOG.md`.

**Deliverables.** Four working RAG approaches. Four smoke-set result rows.

**Estimated turnaround.** Single session.

---

### Phase 6 — Non-RAG Approaches

**Goal.** Three non-RAG approaches, same interface, same artifacts.

**Exit criteria.**
- Seven approaches total runnable. All seven have eval-set runs logged.
- Full-Context: passes the full corpus verbatim in the prompt (fits comfortably in `gemini-3-flash-preview`'s context window).
- Recursive Summarization: per-document summary → combined summary → answer.
- Sliding-Window: iterate chunks, carry-over running answer, return final. **Cost note:** this approach is the most expensive per question; the budget guard must catch it.

**Tasks.**
- [ ] `src/ragureap/approaches/full_context.py`.
- [ ] `src/ragureap/approaches/recursive_summary.py`.
- [ ] `src/ragureap/approaches/sliding_window.py`.
- [ ] Configs for each.
- [ ] e2e tests for each.
- [ ] Run all 3 on eval set; log.

**Deliverables.** All 7 approaches working. 7 smoke-set rows in `EXPERIMENT_LOG.md`.

**Estimated turnaround.** Single session.

---

### Phase 7 — Evaluation Hardening

**Goal.** Numbers we can trust in a short paper. Adds: per-probe-type breakdown, hallucination correctness, optional LLM-judged faithfulness on a small sample, simple bootstrap CIs. **No expensive sweep — stay under budget.**

**Exit criteria.**
- `metrics.json` per run includes: `em`, `f1`, `per_probe_type` (needle / multi-hop / distractor / hallucination / sanity), `cost_usd`, `latency_p50_ms`, `latency_p95_ms`, `tokens_in`, `tokens_out`.
- `src/ragureap/analysis.py` aggregates `runs/` into a comparison DataFrame with bootstrap 95% CIs.
- Paired comparisons between approaches return p-values via paired sign / Wilcoxon test.
- **User grading hook:** `scripts/grade.py <run_id>` opens each prediction next to its gold answer for manual review, writes `runs/<id>/grades.jsonl`. The agent then verifies disputed cases via grep and updates `tests/eval_set.jsonl` if a gold was wrong.

**Tasks.**
- [ ] Extend `metrics.py` with per-probe-type accuracy + hallucination-refusal detector (regex / keyword check for "I don't know" / "not in context" patterns).
- [ ] `src/ragureap/eval/stats.py`: bootstrap CI + paired Wilcoxon.
- [ ] `src/ragureap/analysis.py`: load all `runs/`, build comparison table.
- [ ] `scripts/grade.py`: interactive (or jsonl-emit) human grading helper.
- [ ] `tests/test_stats.py`.
- [ ] Re-run all 7 approaches on the eval set with the upgraded metrics; log. (Each run ~$0.10–0.30; total well under cap.)

**Deliverables.** Trustworthy metrics. Statistical comparison utilities.

**Estimated turnaround.** Single session.

---

### Phase 8 — Streamlit Dashboard

**Goal.** A clean, neat experiment-runner UI. Not a toy — the surface the user actually drives the project from.

**Exit criteria.**
- `make ui` launches Streamlit on `localhost:8501`.
- Three pages:
  1. **Run** — pick approach + split, launch, stream live progress, show live cost ticker.
  2. **Compare** — multi-select existing `runs/`, show side-by-side metrics table with CIs, per-question diffs, win/loss counts.
  3. **Pareto** — interactive Plotly scatter: cost (USD) × quality (F1), latency × quality. Hover reveals run id + approach + config.
- Custom theme (single accent color, distinctive font pairing — no default Streamlit aesthetic).
- Runs are launched as subprocess + tail `runs/<id>/trace.jsonl` for live updates (no websocket complexity).

**Tasks.**
- [ ] `frontend/app.py` Streamlit entry.
- [ ] `frontend/theme.toml` (or `.streamlit/config.toml`) — custom palette, typography, spacing.
- [ ] Page 1: Run launcher (select config, select split, launch button, log tail).
- [ ] Page 2: Compare (multi-select runs, diff table, per-question explorer).
- [ ] Page 3: Pareto (Plotly).
- [ ] Smoke-test: launch UI, run naive on smoke split end-to-end via the UI.

**Deliverables.** A polished, three-page dashboard the user can demo.

**Estimated turnaround.** Single session.

---

### Phase 9 — Full Experimental Sweep & Analysis

**Goal.** The numbers that go in the paper.

**Exit criteria.**
- All 7 approaches run on the eval set with **3 seeds each** (temperature 0 keeps generation deterministic; seed varies HyDE rewrites + reranker tie-breaking).
- **Cumulative spend stays under $5.** Cost gate aborts the sweep if cumulative USD exceeds 80% of cap mid-run.
- Headline table (mean ± 95% CI) for EM, F1, per-probe accuracy, hallucination correctness, cost, latency.
- Pareto plot saved as `paper/figures/pareto_cost_quality.pdf`.
- Per-approach win/loss matrix (`paper/figures/win_loss.pdf`).
- `FINDINGS.md` rewritten as a structured "what we found" section: 5–8 bullets, each backed by a specific cell in the headline table.

**Tasks.**
- [ ] Sweep driver script `scripts/sweep.py` — iterates approaches × seeds, writes runs, retries on failure, resumes safely. Hard-stops at the $5 cap.
- [ ] Cost estimator: pre-flight estimate (7 approaches × 3 seeds × ~34 Qs ≈ ~700 LLM calls — well under $5 on `gemini-3-flash-preview`).
- [ ] Run sweep.
- [ ] **User grading pass** on a 10–15 question sample for each approach, then agent re-verification via grep.
- [ ] Aggregate via `analysis.py`; export headline table to `paper/tables/headline.csv`.
- [ ] `notebooks/figures.ipynb` generates Pareto + win/loss figures, saved as PDFs.
- [ ] Update `FINDINGS.md` and `EXPERIMENT_LOG.md`.

**Deliverables.** Headline table. Pareto figure. Win/loss figure. Updated FINDINGS.

**Estimated turnaround.** One sweep run (well under 1h wall-clock) + one grading + analysis session.

---

### Phase 10 — Paper Draft & Repro Package

**Goal.** A first-draft research paper that could be circulated to collaborators. Plus a reproducibility tarball.

**Exit criteria.**
- `paper/draft.md` (~6–10 pages equivalent) covers: abstract, intro, related work (short), method (per-approach descriptions), experimental setup (dataset, splits, metrics, statistical methodology), results (headline table + Pareto + win/loss with prose), discussion (when to use which approach — the decision framework), limitations, future work (the dropped techniques become bullets here), conclusion.
- All figures in `paper/figures/` are generated from `notebooks/figures.ipynb` and re-runnable.
- `scripts/build_repro.sh` produces `repro.tar.gz` containing: code, processed splits + hash, configs, `runs/` subset (anonymized), and a top-level `RUN_THIS_FIRST.md` that explains end-to-end re-execution.
- `README.md` is updated with: project description (paper-aligned), quickstart (install + smoke run), and a "Reproducing the paper" section.

**Tasks.**
- [ ] `paper/outline.md` (section headers + 1-line plan per section).
- [ ] `paper/draft.md` — write each section, citing specific cells from `paper/tables/headline.csv`.
- [ ] Make sure every figure is regenerable; commit the notebook with cleared outputs + a `make figures` target.
- [ ] `scripts/build_repro.sh`.
- [ ] Final README pass.
- [ ] Append a closing entry to `FINDINGS.md` summarizing the paper's core claim in 2 sentences.

**Deliverables.** Paper draft. Repro tarball. Final README. Project ready to share.

**Estimated turnaround.** One drafting session + one review/polish session.

---

## 8. Phase Gate Summary

| Phase | Single sentence | Gate |
|---|---|---|
| 1 | Scaffold installs cleanly. | `pip install -e .` + `pytest` green. |
| 2 | HotpotQA loaded + chunked. | `data/processed/hotpot_dev.jsonl` exists with hash. |
| 3 | Indexes work. | Build + search round-trip unit-tested. |
| 4 | Naive RAG e2e, with metrics. | First `runs/<id>/` artifact exists. |
| 5 | 4 RAG approaches working. | 4 smoke-set rows in EXPERIMENT_LOG. |
| 6 | 7 approaches working. | 7 smoke-set rows in EXPERIMENT_LOG. |
| 7 | Metrics trustworthy. | Bootstrap CIs + Wilcoxon usable. |
| 8 | Streamlit dashboard usable. | User can run + compare from UI. |
| 9 | Headline numbers exist. | Pareto + headline table generated. |
| 10 | Paper drafted + reproducible. | `paper/draft.md` exists; `repro.tar.gz` builds. |

---

## 9. Open Inputs Needed From User (One-Time)

Confirm before Phase 1 begins:

1. **Gemini API key.** ✅ Confirmed — saved in `.env` as `GOOGLE_API_KEY`.
2. **Model.** ✅ `gemini-3-flash-preview` for *all* generation, embeddings remain local (sentence-transformers).
3. **Cost ceiling.** ✅ **$5 hard cap** for the entire project. Budget guard aborts any run that would push cumulative spend over the cap. If we hit a quota or limit issue mid-experiment, the agent reports back and the user provides additional keys.
4. **Grading.** Author tests first → run approaches → user spot-grades → agent re-verifies via grep against the source corpus.

---

## 10. Handoff Protocol (Same Shape as Before, Shorter)

Every phase: read this file, find the next unchecked phase, execute its checklist top to bottom, update `PROGRESS.md`, append to `DECISIONS.md` / `FINDINGS.md` / `EXPERIMENT_LOG.md` as relevant, then report exit-criteria status and stop.

The user's next message will be `Go Phase N+1` or course-correction.

---

*This is the contract. PHASES.md is history. Follow this file.*
