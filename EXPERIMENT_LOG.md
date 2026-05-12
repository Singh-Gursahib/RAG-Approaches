# EXPERIMENT_LOG.md — Run Ledger

> One line per run. Newest at top. Format: `date · run_id · approach · split · EM · F1 · cost_usd · notes`.

| Date | Run ID | Approach | Split | EM | F1 | $ | Notes |
|---|---|---|---|---|---|---|---|
| 2026-05-12 | sweep × 21 runs at T=0.3 (full coverage) | all 7 | full (34q × 3 seeds) | see below | see below | ~$0.83 | **Phase 9 multi-seed sweep — complete.** Sliding_window seeds 1–2 re-run cleanly after API cap lift. Sweep aggregates in `paper/tables/sweep_headline.csv`. Headline (F1 mean ± std): full_context **0.881±0.012**, sliding_window **0.875±0.025**, hyde **0.838±0.012**, naive **0.836±0.012**, rerank **0.833±0.009**, hybrid **0.797±0.010**, recursive_summary **0.206±0.000**. |
| 2026-05-11 | `sliding_window_20260512_004119_9480ef` | sliding_window | full (34q) | **0.706** | **0.901** | $0.0972 | **CLEAN**. New headline best. 4 LLM calls/q (one per doc, with running-state). Needle EM 0.750 (highest). Distractor F1 0.857 (highest). p50 8.0s (slowest of all approaches besides expected). |
| 2026-05-11 | `recursive_summary_20260512_003929_c6c8c0` | recursive_summary | full (34q) | 0.206 | 0.221 | $0.0068 | **CLEAN, but catastrophic on factoid Qs**. Question-agnostic per-doc summarization stripped specific identifiers (MULBERRY-7Q, M7-RX-204-A, 12%, dates) despite explicit "preserve facts" instructions. Hallucination 1.0 holds (refusing a missing fact accidentally aligns with gold). Strong negative result for the paper. |
| 2026-05-11 | `full_context_20260512_003505_dc03cd` | full_context | full (34q) | 0.676 | 0.886 | $0.0911 | **CLEAN**. Multi-hop EM 0.625 (highest among single-call methods). Beats every RAG variant on F1. Cost ~7.5x naive due to full corpus in every prompt. Demonstrates "if corpus fits, retrieval is unnecessary at this scale". |
| 2026-05-11 | `rerank_20260512_002410_3c14e1` | rerank | full (34q) | 0.647 | 0.836 | $0.0123 | **CLEAN**. Best F1 among the 4 RAG approaches. Multi-hop F1=0.718. Hallucination + sanity perfect. Cracks `hop-04` (Accord→MERIDIAN-7 chain). |
| 2026-05-11 | `hyde_20260512_001934_8b5af6` | hyde | full (34q) | 0.647 | 0.798 | $0.0193 | **CLEAN, 34/34**. Same EM as naive at 1.6x cost (2 LLM calls/Q). Cracks `hop-01` and `hop-04` but flips `hop-03` to wrong; net zero EM gain. Distractor F1=0.667 (worst — hypothetical answer pulled embedding toward false positives). |
| 2026-05-11 | `hybrid_20260512_001727_bc93e2` | hybrid | full (34q) | 0.618 | 0.794 | $0.0122 | **CLEAN, 34/34**. Worst headline (BM25 fusion lost `hop-01` Veridian cross-doc link that pure-dense found). Hallucination + sanity perfect. Fastest p50 (2.1s). |
| 2026-05-11 | `naive_20260512_000900_094414` | naive | full (34q) | 0.647 | 0.823 | $0.0122 | **CLEAN, 34/34**. Baseline. Per-type EM: needle 0.625, multi-hop 0.500, distractor 0.375, **hallucination 1.000**, **sanity 1.000**. p50 2.1s. |
| 2026-05-11 | `naive_20260512_000129_a1acaa` | naive | full (34q) | 0.353 | 0.514 | $0.0083 | **PARTIAL** — 23/34 then free-tier quota wall. Superseded. |

---

**Cumulative spend so far:** $1.0875 / $5.00 cap (21.7%). All 21 sweep runs are clean; the earlier two contaminated sliding_window runs were re-executed once the account-level monthly cap was lifted.
