# 01 — Research Analysis & Identified Gaps

> Deep analysis of the existing `research.md`, what it covers well, what is missing, and the consolidated set of techniques this framework will implement.

---

## 1. Strengths of `research.md`

The current research document provides:

- A clear taxonomy splitting **RAG** vs **non-RAG** strategies.
- Concise, accurate descriptions of six RAG variants (Naive, GraphRAG, RAPTOR, HyDE, MemoRAG, Agentic/Self-RAG) and five non-RAG techniques (Full-context, KV compression, Sliding-window, Memory-augmented, Prompt compression).
- Domain deep-dives for **Legal**, **Medical**, **Enterprise/Finance/Code** with strategy-fit tables.
- A comparative summary table covering complexity, latency, cost.
- A practitioner-friendly README quick reference with decision shortcuts.

This is a strong **literature review** baseline. It is the right starting point for a research project.

---

## 2. Gaps and Missing Techniques

To make the framework **comprehensive and competitive with current 2025–2026 literature**, the following gaps need to be addressed. Each gap is paired with the technique(s) we will add.

### 2.1 Missing RAG-side techniques

| Gap | Addition |
|---|---|
| Document-aware chunking is glossed over | **Parent-Child / Small-to-Big retrieval** as a first-class technique |
| Query reformulation only mentioned via HyDE | **Multi-Query Retrieval** (generate k diverse rewrites, fuse results via RRF) |
| No mention of dense+sparse hybrid as standalone | **Hybrid RAG** (BM25 + dense + RRF + cross-encoder rerank) explicit |
| Routing logic implicit in agentic | **Adaptive RAG** (a *router* that classifies queries → no-retrieval / single-step / multi-step) |
| Late-interaction retrievers absent | **ColBERT-style late interaction** (optional, behind a flag) |
| Reranker not separated | **Cross-encoder reranker** as an isolated, swappable component |
| Compression-based retrieval missing | **Contextual Compression Retriever** (LongLLMLingua at retrieval time, not just prompt time) |
| Hierarchical retrieval beyond RAPTOR | **Hierarchical RAG** (explicit doc → section → paragraph index, no LLM summarization) |
| Multi-modal RAG | **Multimodal RAG** stub (table+text PDFs, images via captioning) — at least a hook for medical/finance domains |
| Routing across indices | **Semantic Router** (deterministic embedding-based routing between technique-specific indices) |

### 2.2 Missing Non-RAG techniques

| Gap | Addition |
|---|---|
| Recursive summarization not separated from RAPTOR | **Recursive Summarization** as a standalone non-RAG approach (no retrieval, just summarize-then-answer) |
| Long-context "native" not benchmarked separately | **Long-Context Native Reasoning** with Gemini 1.5/2 Pro, comparing 128K vs 1M token windows |
| Caching not addressed | **Context Caching** (Gemini's explicit cache + prompt caching) — a non-RAG cost-reduction lever |
| Multi-agent memory absent | **Multi-Agent Memory Systems** (e.g., MemGPT-style + planner/executor split) |
| State-space models absent | **State-Space Memory** (Mamba/RWKV-style models as a long-context alternative — at minimum a benchmarking hook) |
| Sliding-window reasoning vs SWA conflated | **Sliding-Window Reasoning** (chunk → answer-per-chunk → aggregate, distinct from architectural SWA) |

### 2.3 Cross-cutting gaps

- **No reproducibility methodology.** Need fixed seeds, dataset hashes, run manifests.
- **No hallucination measurement plan.** Need a concrete pipeline (faithfulness scoring with strong judge model + reference-based fact checking).
- **No cost / latency / memory dashboards.** These are essential for the "when to use what" answer.
- **No statistical testing.** Bootstrapped CIs and paired tests are needed before any "X beats Y" claim.
- **No ablation strategy.** We need a systematic way to ablate components (e.g., "GraphRAG without community summaries", "Hybrid RAG without reranker").
- **No adversarial / red-team test design.** Hallucination, prompt-injection, contradictory-context tests are not in `research.md`.
- **No domain dataset specification.** The doc names domains but does not specify what corpora to use.
- **No paper structure.** Conference target, sections, figures, ablation tables — none specified.

---

## 3. Consolidated Master List of Techniques

The framework will implement, benchmark, and ablate the following techniques. Items marked **(P0)** are essential for the first usable cut; **(P1)** are second-wave; **(P2)** are stretch / paper-completeness items.

### 3.1 RAG-based (13 techniques)

1. **Naive Vector RAG** — dense top-k retrieval, single-shot generation. **(P0)**
2. **Hybrid RAG** — BM25 + dense + Reciprocal Rank Fusion + cross-encoder rerank. **(P0)**
3. **Parent-Child Retrieval** — small-chunk index, large-chunk return. **(P0)**
4. **Multi-Query Retrieval** — N rewrites → fuse via RRF. **(P0)**
5. **HyDE** — generate hypothetical doc, embed, retrieve. **(P0)**
6. **Hierarchical RAG** — explicit doc/section/paragraph levels, no LLM summarization. **(P1)**
7. **RAPTOR** — clustering + recursive LLM summarization tree. **(P1)**
8. **GraphRAG** — entity/relation extraction, community summaries, local + global search. **(P1)**
9. **MemoRAG** — global memory tokens + clue-driven retrieval. **(P1)**
10. **Self-RAG** — reflection-token-driven retrieval and critique. **(P1)**
11. **Agentic RAG** — LangGraph agent with retrieval tools, multi-step. **(P0)**
12. **Adaptive RAG** — router (no-retrieve / single-step / multi-step) + execution. **(P1)**
13. **Contextual Compression RAG** — retriever returns compressed context (LongLLMLingua). **(P2)**

### 3.2 Non-RAG (8 techniques)

1. **Full-Context Injection** — load entire corpus or document into the window. **(P0)**
2. **Recursive Summarization** — map-reduce style summarize-then-answer. **(P0)**
3. **Sliding-Window Reasoning** — chunk-by-chunk reasoning with answer aggregation. **(P0)**
4. **Prompt Compression** — LLMLingua-2 pre-injection compression. **(P1)**
5. **Context Caching** — Gemini explicit cache for fixed corpora. **(P1)**
6. **Memory-Augmented (MemGPT-style)** — tiered memory with read/write tools. **(P1)**
7. **Multi-Agent Memory** — planner + retriever + writer + critic with shared memory. **(P2)**
8. **Long-Context Native (1M+ window) baseline** — Gemini 1.5/2 Pro reference run. **(P0)**

> **Out of scope for the first paper but tracked:** KV cache compression and SWA (model-internal, require model-server level changes), state-space models (require non-Transformer model integration). These will be benchmarking *hooks* rather than full implementations. We document their expected behavior and cite published numbers for context.

### 3.3 Hybrid Architectures (proposed novel contributions — see `10_HYBRID_PROPOSALS.md`)

1. **GraphRAG + Adaptive Router** — graph for relational queries, vector for factual, full-context for short corpora. *Decision is per-query.*
2. **RAPTOR + Multi-Query + Reranker** — hierarchical breadth + query diversity for long policy docs.
3. **MemoRAG + Agentic Loop** — global memory provides clues, agent verifies via targeted retrieval.
4. **Recursive Summarization + Vector RAG fallback** — summarize first, retrieve only on summary uncertainty.
5. **Hybrid RAG + Context Caching** — cache the static corpus prompt; pay only for query and rerank tokens.
6. **Domain Router → Per-Domain Best Stack** — meta-system that classifies the query domain and dispatches to the best per-domain technique.

These hybrids are the **research contributions** of this project. The flat techniques are baselines/components.

---

## 4. Domains to Cover

Beyond `research.md`'s three domains, we will cover **seven**:

| Domain | Why include | Distinctive challenge |
|---|---|---|
| Legal | High citation density, precision-critical | Multi-hop reasoning over case-law graphs |
| Medical | Safety-critical, fast-moving guidelines | Clinical concept linking + citation requirement |
| Education | Pedagogical correctness, age-appropriate | Curriculum coherence, cross-grade knowledge prerequisites |
| Finance | Tabular + narrative, regulated | Numerical fidelity, time-sensitive data |
| Research / Scientific | Citation networks, contradiction handling | Long surveys, hypothesis-grounding |
| Code Assistants | Structured + cross-file dependencies | Function-call graphs, repo-scale context |
| General-Purpose QA | Wide topic distribution | Robustness to domain shift |

A separate adapter per domain (see `07_DATASETS.md`) lets every technique run on every domain.

---

## 5. Methodological Gaps to Close

The framework's **research methodology**, in addition to its techniques, will include:

1. **Reproducibility-first run manifests.** Every run captures: technique config, code git SHA, dataset hash, prompt template hash, model+version IDs, seed(s), wall-clock, token counts, GPU time (if local), and the full stream of intermediate artifacts (retrieved chunks, reranker scores, generated answer). One folder per run under `runs/`.
2. **Statistical rigor.** Bootstrap confidence intervals (n=1000, BCa) for every reported metric. Paired tests (Wilcoxon signed-rank) when comparing two techniques on the same query set. Multiple-comparison correction (Holm) when comparing many techniques.
3. **Multi-seed runs.** For non-deterministic techniques (anything LLM-generative), report mean ± CI over ≥3 seeds.
4. **Ablation matrix.** For each compound technique, define a minimal set of ablations (e.g., GraphRAG: with/without community summaries, with/without local search, with/without reranker).
5. **Adversarial test bank.** A held-out set of: long-context distractors, contradictory-context queries, prompt injection attempts in retrieved chunks, needle-in-haystack at varying depths, multi-hop chains of length 2–5.
6. **Human-eval sub-sample.** A small (~100 query) human-judged set per domain to validate automated metrics. We will use a structured rubric (faithfulness 0–2, completeness 0–2, fluency 0–2).
7. **Cost-aware Pareto plots.** Quality-vs-cost and quality-vs-latency Pareto frontiers per domain — these are the visual centerpiece of the paper.

---

## 6. Open Decisions to Confirm with the User

Before scaffolding code, the following decisions need user input. They are listed here for visibility; they will be re-asked at the end of the roadmap (see `14_ROADMAP.md`):

1. **API keys to provide.** Gemini API key (required). OpenAI key (optional — useful for `gpt-4o` as a judge model in faithfulness eval). Cohere key (optional — for `rerank-3` as one reranker option).
2. **Local compute envelope.** Available RAM / GPU? Determines whether we run Ollama-hosted reranker / generator locally, or rely on hosted APIs.
3. **Dataset acquisition.** Some domain corpora (legal cases, medical papers) we can pull automatically (CourtListener, PubMed). Others (proprietary curricula, financial filings) may need user uploads. Confirmed ask in `07_DATASETS.md`.
4. **Frontend ambition.** Full Next.js dashboard from day 1, or Streamlit MVP first? Recommendation: **Streamlit MVP for v0.1**, Next.js once metrics are stable.
5. **Paper venue target.** ACL / EMNLP / NAACL / a workshop? Affects formatting and required experiments. Default: **ACL Findings + workshop**.

---

## 7. Summary

`research.md` is a strong literature review but stops short of a research methodology. This framework will:

- **Implement 21 techniques** (13 RAG + 8 non-RAG) under a unified interface, plus 6 hybrid proposals as the actual research contribution.
- **Cover 7 domains** with dedicated dataset adapters.
- **Apply rigorous statistical methodology** (multi-seed, bootstrapped CIs, paired tests, ablations).
- **Produce reproducible run artifacts** that double as paper appendix material.

The next document (`02_PROJECT_ARCHITECTURE.md`) translates this into folder structure, module boundaries, and runtime architecture.
