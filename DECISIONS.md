# DECISIONS.md — Architectural Decision Log

> Append-only. Most recent at the top. Each entry: date · title · context · decision · alternatives · consequences.

---

## 2026-05-11 — Scope cut: 10 phases, 7 approaches, $5 cap

**Context.** The original 15-phase / 21-technique / 7-domain plan was research-grade ambitious — multi-month, infrastructure-heavy (Docker, Neo4j, Qdrant, Ollama), and required cloud spend in the tens of dollars at minimum. User asked for a tractable plan.

**Decision.** Rewrite as a 10-phase plan covering 4 RAG + 3 non-RAG approaches on a single hand-authored test set, with a $5 hard budget. See `IMPLEMENTATION_PLAN.md`.

**Alternatives considered.**
- Keep the full plan but stretch the timeline → rejected, no real benefit.
- Pick HotpotQA as the benchmark → rejected in favor of a hand-authored synthetic corpus + ~34 questions, because (a) tighter cost control, (b) we know gold answers cold and can probe specific behaviors (needle-in-haystack, hallucination, distractor robustness), (c) reproducible without network.
- Use multiple LLMs for ablation → rejected, single `gemini-3-flash-preview` keeps the cost model clean and the comparison apples-to-apples.

**Consequences.**
- 14 techniques deferred (GraphRAG, RAPTOR, MemoRAG, Self-RAG, Agentic, Adaptive, Parent-Child, Multi-Query, Hierarchical, Contextual Compression, LLMLingua, Context Caching, MemGPT, Multi-Agent Memory, all 6 hybrids). They become future-work in the paper.
- All Docker/Neo4j/Qdrant dependencies dropped. ChromaDB (file-based) + rank_bm25 only.
- Old design docs archived under `archive/` rather than deleted to preserve prior thinking.

---

## 2026-05-11 — Stack: ChromaDB + rank_bm25 + Gemini Flash, no Docker

**Context.** Need a lightweight, single-developer-friendly stack.

**Decision.**
- Vector store: **ChromaDB** (file-based, no server).
- Lexical: **rank_bm25** (pure Python).
- Embeddings: **sentence-transformers/all-MiniLM-L6-v2** (CPU-OK, free).
- Reranker: **BAAI/bge-reranker-base** (CPU-OK, free).
- Generator: **`gemini-3-flash-preview`** via `google-generativeai` (paid, only cost component).
- UI: **Streamlit** with a custom theme.
- Config: plain YAML + pydantic-settings. No Hydra.

**Consequences.** No Docker required. No GPU required. Total infra: `pip install -e .` + `.env`. All cost comes through one API call path → trivial to enforce the $5 budget.

---

## 2026-05-11 — Test set authoring philosophy

**Context.** User wants light testing with author-known gold answers, including needle-in-haystack-style probes. User will spot-grade, then agent verifies via grep.

**Decision.** Hand-author ~34 questions across 5 probe types (needle-in-haystack 8, multi-hop 8, distractor 8, hallucination 6, sanity 4) over a synthetic ~20K-token corpus we control end-to-end. Corpus + eval set both committed to the repo for hermetic reproducibility.

**Consequences.** No HotpotQA or external benchmark download. Gold answers are knowable, gradable, and verifiable. Tradeoff: results aren't directly comparable to published HotpotQA scores — but that comparison was never the goal.

---

*Append new entries above this line.*
