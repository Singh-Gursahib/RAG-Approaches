# FINDINGS.md — Experimental Observations

> Append-only. Most recent at the top. Each entry: date · approach(es) · observation · supporting evidence (run ID or table cell) · confidence.

---

## 2026-09-11 — Cross-model replication on GLM 5.3 Flash (RAG Atlas replay)

**Setup.** The Phase 9 case study rerun on a second generator, `z-ai/glm-5.3-flash` (open weights, `zai-org/GLM-5.3-Flash`), through OpenRouter from RAG Atlas's Replay mode. Same corpus, 34 questions, prompts, chunking (150/30), top-k 5, rerank pool 20, grading, and statistics as the Gemini sweep; 3 seeds (0, 1, 2) at T=0.3 with a 512-token answer budget. GLM 5.3 Flash always reasons: the main run requested **low** effort with `max_tokens` 640; a Full-Context follow-up used **high** effort with `max_tokens` 2,560 (same 512 tokens left for the answer). Costs are the amounts OpenRouter billed (Gemini costs above are ledger estimates, so cost comparisons are approximate).

**Evidence.** Saved tests in `studio/results/`: `20260911T062638Z_replay_z-ai-glm-5-3-flash_bebd51.json` (7 strategies), `…_662a06.json` (Full-Context, high effort), `…_0220b6.json` (Full-Context check after the headroom fix, 1 seed). Exported to `paper/tables/glm53_*.csv` and `paper/tables/cross_model_f1.csv` by `scripts/export_cross_model_tables.py`. Spend: $0.2276 + $0.0211 + $0.0091 = **$0.26**.

| Approach | Gemini 3 Flash F1 | GLM 5.3 Flash F1 ± std | GLM F1 95% CI | Δ F1 | GLM EM | GLM cost/run (billed) |
|---|---|---|---|---|---|---|
| full_context | 0.881 | 0.490 ± 0.038 | [0.405, 0.573] | −0.391 | 0.363 | $0.0094 |
| sliding_window | 0.875 | 0.808 ± 0.041 | [0.743, 0.868] | −0.066 | 0.647 | $0.0348 |
| hyde | 0.838 | 0.813 ± 0.017 | [0.744, 0.875] | −0.025 | 0.657 | $0.0073 |
| naive | 0.836 | 0.862 ± 0.000 | [0.806, 0.911] | +0.026 | 0.706 | $0.0042 |
| rerank | 0.833 | **0.871 ± 0.007** | [0.823, 0.917] | +0.038 | 0.696 | $0.0051 |
| hybrid | 0.797 | 0.833 ± 0.000 | [0.768, 0.889] | +0.036 | 0.676 | $0.0043 |
| recursive_summary | 0.206 | 0.717 ± 0.044 | [0.631, 0.792] | +0.511 | 0.598 | $0.0109 |
| full_context, high effort | 0.881 | **0.915 ± 0.007** | [0.880, 0.947] | +0.034 | 0.755 | $0.0070 |

### Findings

1. **Retrieval pipelines transfer across generators.** The four RAG strategies move by at most 3.8 F1 points between models (mean |Δ| 3.1), and every GLM estimate lies inside the matching Gemini 95% CI. Across strategies on one model, F1 spans 67.5 points (Gemini) and 38.1 points (GLM as run; 19.8 with the high-effort Full-Context). For these two generators, the choice of pipeline matters far more than the choice of model.
2. **Full-Context needs reasoning headroom on a model that always reasons.** At low effort, 20% of the 640-token limit (~128 tokens) was left for reasoning. On the ~8K-token prompt 11 of 102 answers were cut off and retried, the model answered `NOT_IN_CONTEXT` for present facts (the planted password) and misread numbers ("0.4 ppm" for "0.46 ppm"): F1 0.490, needle F1 0.24. With high effort and 2,560 tokens: 0 retries, fewer reasoning tokens per call (61 vs 209), F1 **0.915**, and a lower cost per run ($0.0070 vs $0.0094). The other six strategies used 1–15 reasoning tokens per call and were largely unaffected. **Fix shipped:** `studio/server/app/openrouter.py` now reserves `MIN_REASONING_TOKENS = 1024` (GLM low effort → 5,120-token limit); the 1-seed check at the default setting scored F1 0.931.
3. **Summarization loss is structural in kind, model-dependent in size.** Recursive Summary rises from 0.206 to 0.717 on GLM (multi-hop 0.82, distractor 0.71), but needle recall stays poor (0.31 vs 0.00). Keep "avoid for fact lookup"; re-measure for synthesis-heavy use cases.
4. **Honesty transfers for retrieval pipelines only.** All four RAG strategies and Recursive Summary refused 6/6 unanswerable probes on both generators. Sliding-Window fell to 0.667 on GLM; low-headroom Full-Context 0.944.
5. **Significance (GLM, Holm-corrected Wilcoxon).** Low-headroom Full-Context differs from all six others (p_adj ≤ 4×10⁻⁴); Recursive Summary vs Reranker p_adj = 0.014; no pair of RAG strategies is separable, as on Gemini.
6. **Fine rank order is not preserved.** Spearman ρ = 0.39 across all seven strategies (with the high-effort Full-Context; p = 0.38). Expected, because the RAG cluster is statistically tied on both models.
7. **Seed variance again concentrates in multi-step pipelines.** GLM std: Sliding-Window 0.041, Recursive Summary 0.044; Naive and Hybrid 0.000, Reranker 0.007.
8. **EM remains formatting-sensitive across models** (e.g. GLM "Seven years" for gold "7 years"); keep F1 as the headline.
9. **Cost.** Summed over the seven strategies, one GLM run cost $0.076 billed against Gemini's $0.251 estimated (≈0.3×); per strategy the ratio ranges from 9.7× cheaper (Full-Context) to 1.6× more expensive (Recursive Summary).

**Paper.** `paper/ieee_draft.tex` now reports both generators: Table II (cross-model), Fig. `cross_model_f1`, two-panel heatmap and cost–quality figures, and a "Reasoning Headroom" subsection.

**Confidence.** High for the transfer of RAG pipelines on this corpus with these two flash-tier generators; medium for generality (one corpus, two models of similar tier).

---

## 2026-05-11 — Corpus structure (Phase 2)

**Observation.** The hand-authored corpus is denser than expected at ~8K total tokens across 4 documents (target was 15-25K). With 150-token sentence-window chunks at 30-token overlap, this produces **65 chunks**.

**Why this is fine.** 65 chunks is a comfortable retrieval pool: top-5 retrieval is ~7.7% recall pressure, which is non-trivial. Padding the corpus with filler text would dilute the experimental signal (each planted needle would compete with more irrelevant prose, but the irrelevant prose carries no information for the model). The current density is intentional.

**Risk.** Full-Context Injection has an easier time than it might on a larger corpus — `gemini-3-flash-preview` should accept the entire 8K-token corpus comfortably in one prompt. This is by design: we want a fair "RAG vs. fits-in-context" comparison without artificially handicapping full-context. The optional arXiv long-doc supplement (Phase 9 stretch) can probe the regime where full-context starts to crack.

**Confidence.** High.

---

## 2026-05-12 — Multi-seed sweep (Phase 9, complete after API-cap recovery)

**Setup.** All 7 approaches × 3 seeds at temperature 0.3. Single generator (`gemini-3-flash-preview`). Identical eval set, identical answer prompt. **All 21 sweep runs now clean** after re-running sliding_window seeds 1–2 once the account-level monthly cap was lifted.

| Approach | n_seeds | EM mean ± std | F1 mean ± std | F1 pooled 95% CI | Cost (mean) |
|---|---|---|---|---|---|
| full_context | 3 | 0.667 ± 0.017 | **0.881 ± 0.012** | [0.840, 0.918] | $0.0912 |
| sliding_window | 3 | **0.696 ± 0.045** | 0.875 ± 0.025 | [0.826, 0.920] | $0.0972 |
| hyde | 3 | 0.667 ± 0.017 | 0.838 ± 0.012 | [0.780, 0.893] | $0.0186 |
| naive | 3 | 0.667 ± 0.017 | 0.836 ± 0.012 | [0.778, 0.888] | $0.0122 |
| rerank | 3 | 0.667 ± 0.017 | 0.833 ± 0.009 | [0.774, 0.887] | $0.0123 |
| hybrid | 3 | 0.627 ± 0.017 | 0.797 ± 0.010 | [0.728, 0.857] | $0.0122 |
| recursive_summary | 3 | 0.206 ± 0.000 | 0.206 ± 0.000 | [0.128, 0.284] | $0.0068 |

### Rank-order change vs the initial 19-run analysis

With sliding_window's two missing seeds now in, **full_context overtakes sliding_window on mean F1** (0.881 vs 0.875). Sliding-window's first seed (0.896) was on the high tail; the 3-seed mean is 0.875 ± 0.025. Same story holds qualitatively (non-retrieval > retrieval > pre-summarization), but the safest claim is now "full_context and sliding_window together dominate the retrieval family" rather than "sliding_window strictly best."

### Findings now defensible at multi-seed

1. **Seed variance is small-to-zero for single-shot approaches, but visible for multi-step approaches.**
   - Recursive Summarization: **std=0.000** across 3 seeds — the long summarization step at T=0.3 produces nearly identical outputs because the model's distribution is so concentrated on the right next token.
   - 5 single-call approaches (naive, hybrid, hyde, rerank, full_context): **EM std ≈ 0.017** (i.e., 1/2 of one question's worth of disagreement across seeds), **F1 std ≈ 0.01**.
   - **Sliding-Window stands out: EM std = 0.045, F1 std = 0.025** — roughly 3× the variance of the single-call approaches. The 4 sequential LLM calls with carry-over state mean small differences compound across windows. Multi-seed sweeps are **necessary** for sliding-window-style approaches; single-seed point estimates can mislead by ~0.05 either way.
   - **Implication:** for single-LLM-call approaches at low temperature, single-seed point estimates are very stable. For multi-step / stateful pipelines, multi-seed is essential — and our initial single-seed sliding_window happened to land on the high tail.

2. **Non-retrieval dominates retrieval at this corpus scale (confirmed across seeds).** Sliding-Window and Full-Context together hold the top two F1 spots. At an 8K-token corpus that comfortably fits in context, retrieval's chunk-selection step is unnecessary overhead.

3. **Recursive Summarization is the only catastrophe.** F1 0.206 with std=0 — *consistently* losing specific identifiers like `MULBERRY-7Q`, `M7-RX-204-A`, `12%` despite explicit "preserve all facts" instructions. The seed-stable failure is itself a finding: pre-summarization isn't a noisy strategy, it's a reliably wrong one for factoid retrieval.

4. **The verbosity ceiling on EM is real.** Six approaches cluster at EM ≈ 0.65–0.67 (within ±0.04). The remaining ~33% of EM misses are mostly verbose-but-correct answers (e.g. "Twenty-five years" vs gold "25 years"). F1 — which gives partial credit — shows the true spread (0.797 → 0.896) and should be the headline metric for the paper.

5. **Cost characterization is consistent across seeds.** Cost std is ≤$0.0002 for every approach — tokens-in is fixed (corpus + prompts) and tokens-out at T=0.3 is nearly identical to T=0.

### Pareto picture

The figures in `paper/figures/` tell the cost × quality story:

- **`pareto_cost_quality.pdf`** — full_context and sliding_window both sit far to the upper-right (high quality, high cost). The four "single-LLM-call" RAG approaches cluster tightly around $0.012 / F1 0.80–0.84. Rerank wins among them.
- **`forest_f1.pdf`** — forest plot with pooled 95% CIs. F1 confidence intervals do *not* overlap recursive_summary; they *do* overlap among the top 6 in places, but the rank order is consistent with point estimates.
- **`win_loss.pdf`** — head-to-head heatmap. sliding_window and full_context show net-positive cells against all single-call RAG approaches.

### Quota note (resolved)

Google's account-level monthly spending cap on the API key fired during sliding_window seeds 1 and 2 during the initial sweep. Those runs were archived, then re-run cleanly once the cap was lifted. **All 21 sweep runs are now in the analysis.** Total project spend: **$1.09 (21.7% of the $5 cap)**. The project's own budget guard at 95% was never tripped.

---

## 2026-05-11 — Statistical significance (Phase 7)

Bootstrap 95% CIs and Holm-corrected paired Wilcoxon over the 7 single-seed runs (N=34 per approach):

| Approach | EM (95% CI) | F1 (95% CI) |
|---|---|---|
| sliding_window | 0.706 [0.559, 0.853] | 0.901 [0.840, 0.955] |
| full_context | 0.676 [0.529, 0.824] | 0.886 [0.824, 0.946] |
| rerank | 0.647 [0.471, 0.794] | 0.836 [0.741, 0.919] |
| naive | 0.647 [0.471, 0.794] | 0.823 [0.713, 0.912] |
| hyde | 0.647 [0.471, 0.794] | 0.798 [0.683, 0.903] |
| hybrid | 0.618 [0.441, 0.765] | 0.794 [0.677, 0.893] |
| recursive_summary | 0.206 [0.088, 0.353] | 0.221 [0.088, 0.368] |

**Pairwise EM p-values (Holm-corrected).** All cells against `recursive_summary` are ≤ 0.003 (significantly worse). **All other pairs have adjusted p = 1.000** — at N=34 we lack power to separate the top 6 approaches on EM, even though their point estimates span 0.618–0.706.

**Implications for the paper.**

- **One defensible significance claim:** recursive summarization is significantly worse than every other approach (Holm-adjusted p ≤ 0.003).
- **Six undifferentiated approaches:** the rank order from point estimates (sliding_window > full_context > rerank > naive > hyde > hybrid) is *consistent with the data* but not *statistically distinguishable* at this N.
- **What to do about it:** Phase 9 runs each approach with 3 seeds, expanding N from 34 to 102 per approach when pooled. That moves us into a range where the F1 spread (0.794–0.901) could become defensible. If the rank order replicates across seeds, the paper can claim it with rank-stability arguments even where Wilcoxon p-values still overflow due to ties.
- **Honest framing recommended:** "Non-RAG approaches achieve the highest point estimates; only the failure of pre-summarization is statistically significant at this sample size. The rank ordering is consistent and warrants the larger sweep planned in §X."

---

## 2026-05-11 — Seven approaches, full head-to-head (Phase 6 complete)

**Setup.** Single seed per approach. All 34 questions. Identical eval set and answer prompt across approaches.

| Rank | Approach | EM | F1 | Cost ($) | p50 (ms) | Family |
|---|---|---|---|---|---|---|
| 1 | **sliding_window** | **0.706** | **0.901** | 0.0972 | 7997 | non-RAG |
| 2 | full_context | 0.676 | 0.886 | 0.0911 | 2537 | non-RAG |
| 3 | rerank | 0.647 | 0.836 | 0.0123 | 2911 | RAG |
| 4 | naive | 0.647 | 0.823 | 0.0122 | 2149 | RAG |
| 5 | hyde | 0.647 | 0.798 | 0.0193 | 5207 | RAG |
| 6 | hybrid | 0.618 | 0.794 | 0.0122 | 2085 | RAG |
| 7 | recursive_summary | 0.206 | 0.221 | 0.0068 | 1945 | non-RAG |

### Per-probe-type F1 (key signal)

| Approach | sanity | halluc. | needle | multi-hop | distractor |
|---|---|---|---|---|---|
| sliding_window | 1.000 | 1.000 | **0.875** | **0.846** | **0.857** |
| full_context | 1.000 | 1.000 | 0.812 | **0.887** | 0.815 |
| rerank | 1.000 | 1.000 | 0.812 | 0.718 | 0.774 |
| naive | 1.000 | 1.000 | 0.812 | 0.662 | 0.774 |
| hyde | 1.000 | 1.000 | 0.812 | 0.662 | 0.667 |
| hybrid | 1.000 | 1.000 | 0.812 | 0.537 | 0.774 |
| recursive_summary | 0.375 | 1.000 | 0.000 | 0.000 | 0.000 |

### Findings — paper material

1. **At an 8K-token corpus, non-retrieval beats retrieval.** Sliding-window and full-context dominate both EM and F1. RAG's job — selecting relevant chunks — is unnecessary when the whole corpus fits in one prompt. RAG's advantage will only appear if/when corpus size makes full-context prohibitive (cost or context window).

2. **Sliding-window slightly beats full-context** (EM +0.030, F1 +0.015). Possibly attention-dilution benefit: each LLM call sees one doc at a time and the carry-over state forces consolidation. The difference is within plausible seed-to-seed variance for 34 questions; Phase 9's multi-seed sweep will determine whether this is real. *If real, it suggests focused per-window attention helps over a single large prompt — a genuinely interesting result.*

3. **Recursive Summarization is a catastrophic failure for factoid QA.** EM 0.206. The question-agnostic per-doc summarization stripped specific identifiers (`MULBERRY-7Q`, `M7-RX-204-A`, `12%`), specific dates (`9 April 2019`), and proper-noun anchors — despite explicit `"preserve all specific facts"` instructions in the summarization prompt. Even the trivial `sanity-03` (launch date) was lost, while `sanity-01` (founding year 1991) survived because it appears multiple times across the corpus. **Strong negative result for the paper:** pre-summarization is incompatible with factoid retrieval at any corpus scale where details matter; it can only safely be used for question types where high-level summaries carry the answer.

4. **Hallucination floor remains universal.** All 7 approaches scored 1.000 on the 6 hallucination probes. The strict refusal prompt + the "use NOT_IN_CONTEXT" rule transfers robustly across retrieval/non-retrieval pipelines. **Caveat:** recursive_summary's perfect score is partly mechanical (it can't answer most questions, so refusing wins by accident on hallucination probes).

5. **Pareto frontier** (quality vs. cost):
   - **sliding_window** dominates on quality at 1$ × naive cost.
   - **rerank** dominates on quality at ≈ naive cost (best $/F1 in the RAG family).
   - **full_context** trades cost for quality cleanly.
   - **hybrid, hyde** are dominated by rerank.
   - **recursive_summary** is dominated by everything except possibly questions whose answer is itself summary-like.

6. **Cost rangefinder.** 7 approaches × 1 seed × 34 questions ≈ **$0.26 cumulative**. With the 3-seed Phase 9 sweep planned (7 × 3 × 34 = 714 calls per approach mix), expected total: ~$0.80. Well under the $5 cap.

7. **Verbosity caps EM near 0.70.** Even the best approach (sliding_window) only achieves EM 0.706 = 24/34. The remaining 10 EM-failures across approaches are dominated by *verbose-but-factually-correct* answers ("Twenty-five years" vs gold "25 years"; "Approximately 32 years" vs "32 years"; "Ambassador Iola Penmarrick" vs "Iola Penmarrick"). F1 captures this far better, hence the F1 0.823–0.901 spread among the working approaches. The paper should *report both* and recommend F1 as the headline for short-answer factoid QA.

**Confidence.** Medium-high on rankings within RAG family. Medium on sliding_window > full_context (single seed). High on recursive_summary's failure mode.

---

## 2026-05-11 — Four RAG approaches head-to-head (Phase 5)

**Setup.** Identical answer-generation prompt + identical eval set across all four. Only retrieval differs. Single seed per run.

| Approach | EM | F1 | Cost ($) | p50 (ms) | p95 (ms) |
|---|---|---|---|---|---|
| naive | 0.647 | 0.823 | 0.0122 | 2149 | 3070 |
| hybrid | 0.618 | 0.794 | 0.0122 | 2085 | 2705 |
| hyde | 0.647 | 0.798 | **0.0193** | **5207** | 6851 |
| **rerank** | 0.647 | **0.836** | 0.0123 | 2911 | 3794 |

**Per-probe-type EM.** Sanity and hallucination are **1.000 across all four** — no honesty regressions. Needle EM is **0.625 across all four** (3 fails are uniform verbosity issues, not retrieval). The differentiating signal is in multi-hop and distractor F1.

**The only 3 questions where approaches disagree** (all multi-hop):

| QID | naive | hybrid | hyde | rerank | Notes |
|---|---|---|---|---|---|
| hop-01 (FILAMENT-3 → city) | ✓ | ✗ | ✓ | ✗ | BM25 fusion + reranker both fooled by lexical overlap on FILAMENT-3 mentions; pure dense + HyDE traced the cross-doc link. |
| hop-03 (MERIDIAN-7 → institute) | ✓ | ✓ | ✗ | ✓ | HyDE's hypothetical pulled retrieval toward a different (wrong) doc. |
| **hop-04** (Accord → funding chain) | ✗ | ✗ | ✓ | ✓ | The hardest probe — both HyDE and Rerank crack the 3-hop chain naive+hybrid miss. |

**Observations.**

1. **No approach beat the baseline on EM** at this corpus scale; the 4 approaches tie at EM 0.647 (except hybrid, which lost one question). The EM ceiling at this corpus is bounded by the **verbose-answer issue**, not retrieval — every "wrong" EM at this point is the model emitting `"Twenty-five years"` instead of `"25 years"`, etc.

2. **Rerank wins on F1 (0.836).** Cross-encoder reranking helps when the dense top-N includes the right chunk but ranked low — the reranker pulls it up. Multi-hop F1 = 0.718 (best of four).

3. **HyDE is the most expensive and the slowest, with no clean win here.** It cracks 2 hard hops but breaks 1 easier one — net zero EM. Distractor F1 actually drops (0.667 vs 0.774) because the hypothetical answer pulls the embedding toward plausible-sounding distractors. **HyDE may benefit a larger corpus** where the question text alone is too short to retrieve well; at this scale, it's pure overhead.

4. **Hybrid underperforms naive here.** BM25's bias toward lexical matches misled on the `hop-01` Veridian chain — the relevant cross-doc passage uses different surface forms. RRF is supposed to mitigate this; it didn't fully. Worth probing in Phase 7 with a stratified analysis.

5. **Hallucination remains 6/6 across all four approaches.** Adding more clever retrieval did not introduce any new false-positive answer to deliberately-absent questions. This is the most important property to preserve.

**Cost ranking:** naive ≈ hybrid ≈ rerank ($0.012) < hyde ($0.019). All four are negligible against the $5 cap (cumulative project spend: **$0.064**).

**Confidence.** Medium. Single seed per approach, ~34-question eval set — differences smaller than the seed-to-seed variance we'd expect. Phase 9's multi-seed sweep is where we get statistical claims.

---

## 2026-05-11 — Naive RAG, clean baseline — `naive_20260512_000900_094414`

**Headline.** Naive Vector RAG on the full 34-question eval set with `gemini-3-flash-preview`:

| Probe type | n | EM | F1 |
|---|---|---|---|
| needle | 8 | **0.625** | 0.812 |
| multi_hop | 8 | **0.500** | 0.662 |
| distractor | 8 | **0.375** | 0.774 |
| hallucination | 6 | **1.000** | 1.000 |
| sanity | 4 | **1.000** | 1.000 |
| **Overall** | **34** | **0.647** | **0.823** |

Cost: **$0.0122**. p50 latency: 2.1s. p95: 3.1s. Wall-clock: 77s.

**What jumps out.**

1. **Hallucination performance is perfect (6/6).** With the current prompt's "if not in context, say NOT_IN_CONTEXT" rule, naive RAG correctly refuses on every deliberately-absent question. This is a strong honesty baseline; other approaches will need to preserve it.

2. **Sanity is perfect (4/4).** Trivial single-fact questions retrieve and answer cleanly.

3. **EM/F1 gap is structural, not a model failure.** Distractor EM=0.375 but F1=0.774 — the model is finding the right fact but wrapping it (`"$47.3 million USD"` vs gold `"$47.3 million"`, `"Twenty-five years"` vs `"25 years"`, `"Dr. Mei-Ling Forrester"` vs `"Mei-Ling Forrester"`). F1 is the more honest headline for short factoid answers; EM will become much more meaningful if Phase 5+ tightens the answer-formatting instruction.

4. **Multi-hop is the real weakness (EM=0.5).** Two genuine failures persist after the quota issue:
   - `hop-04` (Auralite Accord → MERIDIAN-7 funding): retrieval returned passages about Accord and about MERIDIAN-7 separately, but model refused rather than chain them.
   - `hop-07` (compute 2023−1991): model refused to do arithmetic, treating it as out-of-context.
   These are exactly the kinds of cases where reasoning-time approaches (multi-step or reranker-driven retrieval) should help.

5. **Cost discipline holds.** A full eval-set run costs ~$0.012 — we could afford ~400 more such runs against the $5 cap. Plenty of headroom for the Phase 9 sweep (7 approaches × 3 seeds × 34 questions = ~700 calls).

**Confidence.** High — clean run, no infra issues.

---

## 2026-05-11 — Naive RAG, first run (partial due to quota) — `naive_20260512_000129_a1acaa`

**Observation.** Of 34 questions, **23 completed** before `gemini-3-flash-preview` returned `ResourceExhausted 429` on the free tier. On the 23 that completed, the *factual* signal is much stronger than the headline EM=0.353 suggests:

| Probe type | Completed | EM | F1 | Notes |
|---|---|---|---|---|
| needle | 8/8 | 0.625 | 0.812 | All 8 retrieved correctly; EM losses are verbose wrappers (`"178 staff members"` vs `"178"`, `"Seven years"` vs `"7 years"`). |
| multi_hop | 8/8 | 0.500 | 0.600 | 6/8 factually right. Two genuine failures: `hop-04` couldn't trace Accord→FILAMENT-3 chain (refused as `NOT_IN_CONTEXT`); `hop-07` couldn't do 2023−1991 arithmetic (also refused). |
| distractor | 7/8 | 0.250 | 0.649 | Every completed answer is factually correct; EM penalties are verbose ("Dr." prefix, "USD" suffix, "Twenty-five years" vs "25 years"). |
| hallucination | 1/6 | n/a | n/a | Sample too small (5 errored on quota). The one that completed (`halluc-03` MERIDIAN-8) was correctly refused with `NOT_IN_CONTEXT`. |
| sanity | 0/4 | n/a | n/a | All 4 errored on quota. |

**Implication for the prompt.** The naive prompt asks for "as few words as possible" but the model still wraps answers in titles, units, and context. Two options for Phase 5+:
1. Tighten the prompt: "Output only the answer span verbatim. No prefix, no suffix, no units beyond what is required."
2. Accept verbose answers and rely on F1 (which already captures partial credit) for the headline metric.

**Recommendation:** option (1) for fairness across approaches, and report **both** EM and F1 in the headline table. F1=0.81 on needles is the real story.

**Implication for arithmetic.** `hop-07` (compute age = 2023 − 1991) failed because the prompt forbids inference beyond the context. This is a real limitation of strict RAG prompts. Worth a sentence in the paper's discussion.

**Confidence.** Medium-high — based on inspection of the 23 completed predictions. Full picture needs a clean re-run.

---

## 2026-05-11 — Corpus structure (Phase 2)
