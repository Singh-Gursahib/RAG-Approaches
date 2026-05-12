# PROGRESS.md — Live Status

> Updated at the start and end of every phase. Canonical answer to "where are we?"

---

## Current Phase

**Phase 9 — Full Experimental Sweep & Analysis** *(✅ complete; awaiting `Go Phase 10`)*

> See [IMPLEMENTATION_PLAN.md §7](IMPLEMENTATION_PLAN.md) for the full 10-phase plan.

---

## Next Action

Await user `Go Phase 10`. Phase 10 produces the first draft of the research paper (LaTeX + figures + reproducibility tarball script) drawing on:
- `paper/tables/sweep_headline.csv` — multi-seed aggregate
- `paper/figures/{pareto_cost_quality,forest_em,forest_f1,per_probe_em,win_loss}.pdf` — 5 paper-ready PDFs
- `FINDINGS.md` — 5 numbered findings ready to lift into prose
- `paper/outline.md` — section structure

**Phase 9 headline (sorted by F1):**

| Approach | EM | F1 ± std | Cost |
|---|---|---|---|
| sliding_window† | 0.735 | **0.896** | $0.0972 |
| full_context | 0.667 ± 0.017 | **0.881 ± 0.012** | $0.0912 |
| hyde | 0.667 ± 0.017 | 0.838 ± 0.012 | $0.0186 |
| naive | 0.667 ± 0.017 | 0.836 ± 0.012 | $0.0122 |
| rerank | 0.667 ± 0.017 | 0.833 ± 0.009 | $0.0123 |
| hybrid | 0.627 ± 0.017 | 0.797 ± 0.010 | $0.0122 |
| recursive_summary | 0.206 ± 0.000 | 0.206 ± 0.000 | $0.0068 |

†sliding_window has 1 usable T=0.3 seed (2 archived after API monthly cap triggered).

Cumulative spend: **$0.8929 / $5.00 (17.9%)**.

**Key Phase 7 result:** With Holm-corrected paired Wilcoxon at N=34, **only `recursive_summary` is statistically separable** (Holm-adjusted p ≤ 0.003 vs every other approach). The other 6 approaches are statistically indistinguishable on EM — bootstrap 95% CIs overlap substantially (EM CI widths ≈ ±0.15). This is honest signal for the paper: rank order from point estimates ≠ defensible statistical claims at this N. Phase 9's 3-seed sweep widens the data.

**Full 7-approach headline** (F1, sorted):

| Rank | Approach | EM | F1 | Cost |
|---|---|---|---|---|
| 1 | sliding_window | **0.706** | **0.901** | $0.0972 |
| 2 | full_context | 0.676 | 0.886 | $0.0911 |
| 3 | rerank | 0.647 | 0.836 | $0.0123 |
| 4 | naive | 0.647 | 0.823 | $0.0122 |
| 5 | hyde | 0.647 | 0.798 | $0.0193 |
| 6 | hybrid | 0.618 | 0.794 | $0.0122 |
| 7 | recursive_summary | 0.206 | 0.221 | $0.0068 |

Hallucination = 1.000 across all 7. Sanity = 1.000 except recursive_summary (0.250). Cumulative spend: **$0.2594 / $5.00 (5.2%)**.

---

## Phase Status

| # | Phase | Status |
|---|---|---|
| 1 | Foundation & Cleanup | ✅ Done |
| 2 | Corpus & Eval Set Authoring | ✅ Done |
| 3 | Indexing Infrastructure | ✅ Done |
| 4 | Baseline RAG + Runner + Eval | ✅ Done |
| 5 | Advanced RAG (Hybrid / HyDE / Reranker) | ✅ Done |
| 6 | Non-RAG (Full-Context / Recursive / Sliding) | ✅ Done |
| 7 | Evaluation Hardening | ✅ Done |
| 8 | Next.js Dashboard | ✅ Done |
| 9 | Full Experimental Sweep & Analysis | ✅ Done |
| 10 | Paper Draft & Repro Package | ⚪ Pending |

Legend: ✅ Done · 🟡 In Progress · 🟠 Blocked · ⚪ Pending · 🔴 Failed

---

## Configuration Locked

- **LLM:** `gemini-3-flash-preview` (all generation, all approaches).
- **API key:** loaded from `.env` as `GOOGLE_API_KEY`.
- **Total budget cap:** **$5 USD** across the entire project.
- **Dataset:** hand-authored ~34-question eval set + small synthetic corpus (built in Phase 2). No external benchmarks.
- **Embeddings:** local (`sentence-transformers/all-MiniLM-L6-v2`) → free.
- **Reranker:** local (`bge-reranker-base`) → free.

---

## Activity Log

> Append a one-line dated entry per work session. Most recent first.

- **2026-05-12** — **Phase 9 complete.** Multi-seed sweep at T=0.3: 21 attempted, 19 usable. 6 approaches × 3 seeds + sliding_window × 1 (seeds 1–2 hit Google's account-level monthly spending cap during the run and were archived to `archive/contaminated_runs/`). Built `scripts/sweep.py`, `scripts/aggregate_seeds.py`, `scripts/make_paper_figures.py`, enhanced `scripts/build_dashboard_data.py` to prefer sweep data. Generated 5 paper PDFs (`paper/figures/*.pdf`) and headline CSV (`paper/tables/sweep_headline.csv`). Dashboard rebuilt against sweep aggregates; all 13 routes pass production build. **Key finding:** at T=0.3 with short factoid answers, seed variance is near-zero (EM std ≤ 0.017 for all approaches, F1 std ≤ 0.012). Multi-seed sweeps mostly *validate* determinism for this regime rather than add power. Cumulative spend: **$0.8929 / $5.00 (17.9%)**.
- **2026-05-12** — **Phase 8 complete.** Built Next.js 14 dashboard at `frontend/web/` (Apple-clean light theme, generous whitespace, Fraunces display + Manrope body + JetBrains Mono numerals). 4 pages: Overview (hero + leaderboard + Pareto + per-probe radar + 6 findings), Pareto (interactive EM/F1 toggle + per-approach cards), Compare (approach selector + win/loss matrix + per-question diff), Approach detail (forest plots + probe breakdown + per-question table). Recharts for scatter/radar; hand-built CSS for forest plots + heatmap matrix. Build produces 13 static routes (first-load JS 87–209KB). New `scripts/build_dashboard_data.py` aggregates `runs/<id>/` into `frontend/web/lib/data.json` (single build-time source for all pages). `make ui` regenerates data and launches dev server. No API spend; cumulative still **$0.2594 / $5.00**.
- **2026-05-11** — **Phase 7 complete.** Built `eval/stats.py` (percentile-bootstrap CI, paired Wilcoxon signed-rank, Holm-Bonferroni correction), `analysis.py` (aggregate `runs/<id>/` artifacts; headline + per-probe tables with bootstrap CIs; pairwise significance matrices), `scripts/grade.py` (emit per-run review.md + grep-verify mode for disputed golds). 8 stats tests added; full suite 69/69. Ran analysis on existing 7 runs → headline/per_probe/pairwise CSVs saved to `paper/tables/`. **Key statistical finding:** At N=34 with Holm correction, only `recursive_summary` is significantly different from the other 6 (p ≤ 0.003); the top 6 are statistically indistinguishable. EM CI widths ≈ ±0.15. No API spend this phase; cumulative still **$0.2594 / $5.00**.
- **2026-05-11** — **Phase 6 complete.** Built `approaches/full_context.py` (corpus → single prompt), `approaches/recursive_summary.py` (per-doc detail-preserving summaries at setup, amortized; 1 answer call per question), `approaches/sliding_window.py` (4 windows = 4 docs, running-state carryover). Added 3 e2e tests with mocked LLM; full suite 61/61 passing. **Three live runs completed.** All 7 approaches now runnable. **Updated F1 leaderboard:** sliding_window 0.901 > full_context 0.886 > rerank 0.836 > naive 0.823 > hyde 0.798 > hybrid 0.794 > recursive_summary 0.221. Recursive summary catastrophically lost specific facts (MULBERRY-7Q, M7-RX-204-A, 12%, dates) despite "preserve facts" instructions — strong negative paper material. Hallucination 1.000 across all 7. Cumulative spend: **$0.2594 / $5.00 (5.2%)**.
- **2026-05-11** — **Phase 5 complete.** Built `indexing/reranker.py` (bge-reranker-base cross-encoder), `approaches/hybrid.py` (BM25+dense RRF), `approaches/hyde.py` (hypothetical-answer embedding), `approaches/rerank.py` (dense top-20 → bge-reranker top-5). Refactored Naive to share the answer prompt module so retrieval is the only variable. 4 e2e tests with mocked LLM added; full suite 58/58 passing. Three live runs completed. **Headline (F1, sorted):** rerank **0.836** · naive 0.823 · hyde 0.798 · hybrid 0.794. EM ties at 0.647 for naive/hyde/rerank; hybrid 0.618 (lost `hop-01`). Hallucination + sanity perfect across all four. Rerank wins on multi-hop F1 (0.718). HyDE costs 1.6x with no EM gain at this corpus scale. Hybrid surprisingly underperforms naive on this dataset (BM25 lexical bias hurt one cross-doc multi-hop). Cumulative spend: **$0.0643 / $5.00**.
- **2026-05-11** — **Phase 4 complete.** User provided a fresh API key with longer testing window; Naive RAG re-ran cleanly end-to-end on the full eval set: **EM 0.647 / F1 0.823 / cost $0.0122 / wall 77s**. Per-type EM: needle 0.625, multi-hop 0.500, distractor 0.375, **hallucination 1.000**, **sanity 1.000**. F1 of 0.823 confirms most "EM-wrong" answers are factually correct but verbose. Cumulative spend: **$0.0205 / $5.00**.
- **2026-05-11** — **Phase 4 code complete, run partial.** Wrote `llm/gemini.py` (Gemini wrapper with usage-metadata token accounting, rate-limit retry with exponential backoff, FutureWarning noted re: `google-generativeai` deprecation in favor of `google.genai`), `eval/cost.py` (Price table + JSONL BudgetLedger with preflight refusal at 95% of cap), `approaches/base.py` (Approach protocol, AnswerWithTrace, TraceStep), `approaches/naive.py` (embed → top-5 → single LLM call), `eval/metrics.py` (EM/F1/per-probe with hyphen-aware tokenization for identifiers, refusal-pattern detection for hallucination probes), `runner.py` (writes manifest/predictions/metrics/trace; tolerates per-question errors), `configs/approaches/naive.yaml`. Updated Makefile `run` target. 26 metric tests added; full suite 54/54 passing. First Gemini API call probe succeeded ($0.000008 for "PONG"). **First end-to-end run partial**: 23/34 completed (EM=0.353, F1=0.514, cost $0.0083) before `gemini-3-flash-preview` hit a 429 quota wall. Phase 7 will harden metrics; for now the prompt's verbose-answer tendency is the main loss vector on completed questions. Cumulative spend: $0.0083 / $5.00.
- **2026-05-11** — **Phase 3 complete.** Built indexing infrastructure: `llm/embedding.py` (lazy-loaded sentence-transformers MiniLM wrapper, cached singleton), `indexing/base.py` (Index protocol + SearchHit), `indexing/chroma_store.py` (Chroma EphemeralClient with cosine HNSW, externally-supplied embeddings), `indexing/bm25_store.py` (rank_bm25 + alphanumeric/hyphen-aware tokenizer), `indexing/fusion.py` (RRF). 12 indexing tests added; full suite is 29/29 passing. Cold first-run build (model download + index): ~50s. Warm build: 7.36s for 65 chunks (under the 10s exit criterion). Joint correctness probe: for 4 targeted queries (MULBERRY-7Q password, Forrester director, Crescent Bridge year, MERIDIAN-7 telemetry frequency), RRF-fused top-5 surfaces the literal answer 4/4. Cumulative spend: $0.00.
- **2026-05-11** — **Phase 2 complete.** Authored a 4-document synthetic corpus (~6K words / ~8K tokens) at `data/eval_corpus/`: Halden Institute, City of Veridian, MERIDIAN-7 Satellite, Auralite Accord. Documents are interconnected so multi-hop questions span 2-3 docs. Authored 34-question eval set at `tests/eval_set.jsonl` covering 5 probe types: 8 needle / 8 multi-hop / 8 distractor / 6 hallucination / 4 sanity. Implemented `data/chunk.py` (sentence-window, ~150 tokens, 30 overlap → 65 chunks over the corpus), `data/corpus.py` (loader), `data/eval_set.py` (pydantic-validated loader). All 17 tests pass. Independent grep-verification confirms all 28 non-hallucination golds exist in the cited doc, and all 6 hallucination-probe entities are absent. Cumulative spend: $0.00.
- **2026-05-11** — **Phase 1 complete.** Scaffolded package (`src/ragureap/` + subpackages), pyproject.toml, configs/base.yaml, Makefile, .env.example, .gitignore. Wrote 3 smoke tests; all pass. Installed editable via `pip install -e ".[dev]"` in `.venv/`. Verified CLI (`ragureap --version` → 0.1.0) and `make help`. Cumulative spend: $0.00.
- **2026-05-11** — Phase 0 (old 15-phase plan) deprecated. Wrote new `IMPLEMENTATION_PLAN.md` (10 phases, 7 approaches, $5 cap, gemini-3-flash-preview). Archived old `docs/`, `PHASES.md`, `PROJECT_PROPOSAL_2MONTHS.tex`, `explanation.html` to `archive/`. Started Phase 1 scaffolding.

---

## Session Handoff Notes

Phase 1 in progress. Next agent should: read `IMPLEMENTATION_PLAN.md` (canonical), check this file for current task, then continue. Do **not** follow `archive/PHASES.md`.
