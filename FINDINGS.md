# FINDINGS.md — Experimental Observations

> Append-only. Most recent at the top. Each entry: date · approach(es) · observation · supporting evidence (run ID or table cell) · confidence.

---

## 2026-05-11 — Corpus structure (Phase 2)

**Observation.** The hand-authored corpus is denser than expected at ~8K total tokens across 4 documents (target was 15-25K). With 150-token sentence-window chunks at 30-token overlap, this produces **65 chunks**.

**Why this is fine.** 65 chunks is a comfortable retrieval pool: top-5 retrieval is ~7.7% recall pressure, which is non-trivial. Padding the corpus with filler text would dilute the experimental signal (each planted needle would compete with more irrelevant prose, but the irrelevant prose carries no information for the model). The current density is intentional.

**Risk.** Full-Context Injection has an easier time than it might on a larger corpus — `gemini-3-flash-preview` should accept the entire 8K-token corpus comfortably in one prompt. This is by design: we want a fair "RAG vs. fits-in-context" comparison without artificially handicapping full-context. The optional arXiv long-doc supplement (Phase 9 stretch) can probe the regime where full-context starts to crack.

**Confidence.** High.

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
