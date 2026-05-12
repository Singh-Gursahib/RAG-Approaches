# Paper outline — RAG_Ureap

Working title:

> **When does retrieval stop helping? A controlled comparison of seven long-context strategies under a fixed budget.**

Provisional venue: **ACL Findings** (short paper, 4 pages + refs) or a workshop on retrieval / long-context. Pure preprint is the fallback.

---

## Abstract (≤200 words)

We compare four RAG variants (Naive, Hybrid, HyDE, Cross-Encoder Reranker) against three non-retrieval long-context strategies (Full-Context Injection, Recursive Summarization, Sliding-Window Reasoning) under identical conditions on a hand-authored 34-question eval set spanning five probe types (needle-in-haystack, multi-hop, distractor, hallucination, sanity). A single generator (`gemini-3-flash-preview`) handles all approaches with a project-wide $5 spend cap. With multi-seed bootstrap analysis we find: (1) at our 8K-token corpus scale, non-retrieval approaches Pareto-dominate retrieval on token-F1 by a meaningful margin; (2) the strict-refusal prompt transfers cleanly — all approaches except Recursive Summarization achieve perfect honesty on the 6 deliberately-absent probes; (3) Recursive Summarization is the only approach that is statistically significantly worse than the rest, despite explicit "preserve all facts" instructions stripping specific identifiers, dates, and percentages. We close with a cost × quality Pareto frontier showing Cross-Encoder Reranking as the efficient pick among same-cost-class RAG approaches, and Sliding-Window Reasoning as the quality leader when budget permits. The full experimental code, eval set, and run artifacts are released.

## Structure

1. **Introduction** (≤1 col)
   - Motivation: dozens of RAG variants, few honest head-to-heads under matched conditions.
   - Contribution: 7 approaches, 1 corpus, 1 model, public artifacts.

2. **Related work** (≤1 col)
   - RAG taxonomies (Naive/Hybrid/HyDE/Reranker; cite originals).
   - Non-RAG long-context (Full-Context, Map-Reduce summarization, Sliding-Window).
   - Prior comparison work and its gaps (multi-model confounds, opaque eval sets).

3. **Setup**
   - **Corpus** — 4 hand-authored interconnected documents (~8K tokens) with planted facts at known depths.
   - **Eval set** — 34 questions across 5 probe types (8 needle, 8 multi-hop, 8 distractor, 6 hallucination, 4 sanity), every gold answer grep-verified against the corpus.
   - **Approaches** — identical answer-generation prompt across all 7; only retrieval/context-construction differs.
   - **Single generator** — gemini-3-flash-preview. Embeddings local (MiniLM). Reranker local (bge-reranker-base).
   - **Budget** — $5 project cap, JSONL ledger preflight, no run exceeds 95% of cap.
   - **Statistical design** — 3 seeds per approach at T=0.3 for variance; T=0 single-seed runs preserved as deterministic baselines.

4. **Approaches** (table + 1 paragraph each)
   - Naive Vector RAG · Hybrid (BM25+Dense+RRF) · HyDE · Cross-Encoder Reranker
   - Full-Context Injection · Recursive Summarization · Sliding-Window Reasoning

5. **Results**
   - Headline table (mean ± bootstrap 95% CI, sorted by F1). FIG 1: forest plot. FIG 2: per-probe EM. FIG 3: cost × F1 Pareto. FIG 4: win-loss heatmap.
   - Significance: Holm-corrected paired Wilcoxon. Identify which pairwise differences are defensible at N=34×3.
   - Cost characterization: dollars per question, token shape per approach, latency p50/p95.

6. **Discussion** (the five findings)
   - F1: Non-retrieval beats retrieval at sub-window scale.
   - F2: Recursive summarization destroys factoid recall (the only significant gap).
   - F3: Refusal-prompt honesty floor is universal.
   - F4: EM is bounded by verbosity; F1 captures the real signal.
   - F5: Cross-encoder reranking is the efficient pick in the RAG family.

7. **Limitations**
   - Single model (no claim about model-agnostic results).
   - Sub-window corpus (no claim about behavior at 100K+ tokens).
   - Hand-authored eval set (controllable probes, but limited domain coverage).
   - Statistical power at N=34×3 is modest; only large gaps are detectable.

8. **Future work**
   - The 14 deferred techniques (GraphRAG, RAPTOR, MemoRAG, Self-RAG, Agentic, Adaptive, etc.) as bullets.
   - Long-document supplement: arXiv papers (one paper = one corpus) to probe the regime where full-context cracks.
   - Multi-model ablation under the same budget.

9. **Reproducibility**
   - Code, eval set, run artifacts, dashboard — all at <github URL TBD>.
   - Total spend: ~$1 — reproducible on a personal API key in under an hour.

## Tables to emit (paper/tables/)

- `sweep_headline.csv` — per-approach mean ± std + pooled bootstrap CI.
- `pairwise_em.csv`, `pairwise_f1.csv` — Holm-corrected p-values.

## Figures to emit (paper/figures/)

- `pareto_cost_quality.pdf` — Fig 3.
- `forest_em.pdf`, `forest_f1.pdf` — Figs 1a/1b.
- `per_probe_em.pdf` — Fig 2.
- `win_loss.pdf` — Fig 4.

## LaTeX skeleton

A `paper/draft.tex` will be produced in Phase 10 using the `acl` or `acmart` template, depending on venue. Figures will be `\includegraphics{figures/<name>.pdf}` directly from this directory.
