# 10 — Hybrid Architecture Proposals

> The **research contribution** of this project. Six novel hybrid systems that combine multiple RAG / non-RAG techniques to push the cost-quality Pareto frontier. The flat techniques in `05` and `06` are baselines; the hybrids here are the paper's argument.

Each proposal answers: *what failure mode of the constituent techniques does this fix, and on what evidence?*

---

## 1. Hybrid #1 — GraphRAG + Adaptive Router

**Pitch.** GraphRAG dominates relational queries but pays a heavy indexing cost and is slower at query time than vector RAG. A query-level **router** dispatches each query to the cheapest sufficient pipeline:
- **No-retrieve** if the question is conversational / definitional.
- **Naive vector** if the question is factual and likely single-hop.
- **GraphRAG-local** if the question names entities and asks about their relationships.
- **GraphRAG-global** if the question is thematic ("what are the main themes / patterns…").

**Architecture.**
```
query → router (small LM)
  ├─ "no_retrieve"   → generator
  ├─ "single_step"   → naive_rag
  ├─ "graph_local"   → graph_rag (local mode)
  └─ "graph_global"  → graph_rag (global mode)
```

**Hypothesis.** Aggregate cost-per-correct-answer is lower than always-GraphRAG with comparable accuracy on relational queries. Specifically:
- ≥ 90% of always-GraphRAG faithfulness on legal multi-hop.
- ≤ 40% of always-GraphRAG cost on a mixed legal workload.

**Ablations.**
- Router variants: rule-based (regex on entity mentions) vs Flash-LM vs fine-tuned classifier.
- Without `graph_global` branch.
- Misrouting cost (force-misroute 20% of queries to measure router-error penalty).

**Domains.** Legal, Research (citation networks). Stretch: Medical (drug-disease graph).

**Risk.** Router miscalibration. Drift over time.

---

## 2. Hybrid #2 — RAPTOR + Multi-Query + Reranker

**Pitch.** RAPTOR's hierarchical tree provides multi-granularity retrieval; Multi-Query Retrieval generates query rewrites for higher recall; the cross-encoder reranker fixes order errors. Stacked, they should beat any individual component on long, narrative documents.

**Architecture.**
```
query → multi_query.rewrites(N=5)
      → for each rewrite: retrieve from RAPTOR at all levels
      → fuse via RRF
      → reranker (top_k_final)
      → generator
```

**Hypothesis.** On long policy documents and legal contracts, this hybrid will:
- Beat plain RAPTOR by ≥ 10% relative on faithfulness for under-specified queries.
- Beat Hybrid RAG (BM25 + dense + rerank) by ≥ 5% on multi-hop within long docs.

**Ablations.**
- Without RAPTOR levels (collapse to leaf-only).
- Without query rewrites (single query).
- Without reranker.
- N rewrites ∈ {3, 5, 8}.

**Domains.** Legal (contracts), Education (textbooks), Research (long surveys).

**Risk.** Cost compounding (RAPTOR indexing + N retrievals + reranker).

---

## 3. Hybrid #3 — MemoRAG + Agentic Loop

**Pitch.** MemoRAG provides a global "world model" of the corpus via memory tokens. Agentic RAG provides iterative verification. Combined: the agent **starts** from MemoRAG-generated clues (so it doesn't waste a step deciding what to ask) and **verifies / refines** via targeted retrieval — short-circuiting the agentic loop's typical first-step exploration cost.

**Architecture.**
```
query
  ├─ memo_rag.memory.generate_clues(query)  →  initial clue set
  └─ agent.run(query, initial_state={clues: clues})
       loops: assess → retrieve(targeted) → critique
```

**Hypothesis.** Reduces agentic-loop step count by ≥ 30% (clues seed the search) while maintaining or improving faithfulness on multi-hop. Net effect: faster + cheaper agentic pipeline at parity quality.

**Ablations.**
- Without MemoRAG (cold-start agent).
- Without agent (pure MemoRAG).
- Memory model size variants.

**Domains.** Enterprise / general (mixed query workloads), Research (literature surveys).

**Risk.** Hallucinated clues mislead the agent more efficiently.

---

## 4. Hybrid #4 — Recursive Summarization + RAG Fallback

**Pitch.** Many real-world queries can be answered from a high-level summary alone. Always-RAG over-retrieves; always-Summary loses precision. **Try summary first, fall back to RAG only on uncertainty.**

**Architecture.**
```
query
  → recursive_summary.answer(query, top_summary)
  → confidence_score(answer)
  → if confidence < θ:  hybrid_rag.run(query)   ← fallback
  → else:               return summary_answer
```

Confidence score uses self-consistency or a small calibration head.

**Hypothesis.** On general QA workloads, ≥ 60% of queries answerable from summary alone with no quality loss; the remaining 40% trigger fallback. Net cost reduction ~50%.

**Ablations.**
- Confidence threshold sweep θ ∈ {0.5, 0.7, 0.9}.
- With/without summary cache reuse across queries.
- Different confidence scorers (self-consistency, log-prob, judge).

**Domains.** Education, General-Purpose QA, Finance (10-K summary-then-detail).

**Risk.** Confidence miscalibration → wrong answers escape the fallback gate.

---

## 5. Hybrid #5 — Hybrid RAG + Context Caching

**Pitch.** Document-Q&A products query the same corpus repeatedly. Today, every query pays for full corpus injection or full retrieval-prefill. With **Gemini's explicit cache**, the system prompt + retrieved-context window can be cached when reused, but naive retrieval changes per-query, defeating the cache. Solution: **bucket queries by retrieved-cluster signature**; queries that retrieve overlapping context share a cache.

**Architecture.**
```
query
  → hybrid_rag.retrieve(query)           # standard
  → cluster_signature = hash(retrieved_chunk_ids)
  → cache_key = (domain, signature)
  → if cache_hit: gemini.generate(cache=cache_key, suffix=query)
  → else:        gemini.generate(prompt=full); register cache(cache_key)
```

**Hypothesis.** On a workload with locality (≥ 30% queries share retrieval clusters), per-query cost drops 40–70% with no quality change.

**Ablations.**
- Cache hit-rate vs cluster-signature granularity.
- Without caching baseline.
- Cache TTL ∈ {15min, 1h, 24h}.

**Domains.** Finance (analysts repeatedly querying 10-Ks), Legal (contract review sessions), Research (literature deep-dives).

**Risk.** Cache invalidation correctness on corpus updates.

---

## 6. Hybrid #6 — Domain Router → Per-Domain Best Stack (Meta)

**Pitch.** The framework's **product**: a meta-system that classifies a query's domain (legal / medical / finance / etc.) and dispatches to the experimentally-best technique for that domain. Backed by the Phase 12 cross-domain experiments.

**Architecture.**
```
query
  → domain_router (small LM): predicts domain ∈ {legal, medical, ...}
  → strategy_table[domain]   →  e.g., legal: graph_rag+adaptive
                                  medical: agentic_rag+memgpt
                                  finance: hybrid_rag+context_cache
                                  general: adaptive_rag
                                  ...
  → dispatch(strategy, query)
```

The `strategy_table` is **the paper's core decision artifact**. It is read-only at runtime and its values are **derived from experimental Pareto winners**.

**Hypothesis.** A meta-system using Pareto-optimal per-domain strategies outperforms any single technique averaged across all domains by ≥ 15% on faithfulness at lower aggregate cost than the best uniform strategy.

**Ablations.**
- Random domain assignment (sanity floor).
- Single-strategy (best-in-aggregate) baseline.
- Misclassified-domain penalty curve.

**Domains.** All 7 — this hybrid uses all of them.

**Risk.** Domain misclassification at the boundary (legal-finance overlap, medical-research overlap).

---

## 7. Cross-Hybrid Ablation Strategy

Each hybrid runs the full ablation matrix:

| Hybrid | # Ablations | Cells | Notes |
|---|---|---|---|
| #1 GraphRAG + Router | 5 | 5 × 7 dom × 3 seeds | router variant sweep |
| #2 RAPTOR + MQ + Reranker | 4 | 4 × 7 × 3 | rewrite-N + rerank toggle |
| #3 MemoRAG + Agent | 3 | 3 × 7 × 3 | with/without each component |
| #4 Summary + RAG | 4 | 4 × 7 × 3 | θ sweep |
| #5 Hybrid + Cache | 3 | 3 × 7 × 3 | cluster granularity |
| #6 Meta Router | 3 | 3 × 7 × 3 | router accuracy sensitivity |

Aggregate Phase 11 cell count ~22 hybrid configs × 7 domains × 3 seeds = **462 cells**. At smoke-suite size (10 questions) this is tractable; at full size it's the largest experimental cost in the project.

---

## 8. Why These Six?

Each hybrid was chosen to test a **distinct hypothesis** about long-context strategy:

| # | Hypothesis being tested |
|---|---|
| 1 | Routing > monolithic — query-conditional pipelines beat one-size-fits-all. |
| 2 | Stacking complementary retrievers > single retriever — recall + precision compose. |
| 3 | Global memory short-circuits agentic exploration. |
| 4 | Summarize-first dominates on summary-answerable workloads. |
| 5 | Caching unlocks long-context economics for document-Q&A. |
| 6 | Per-domain optima beat universal strategies — the framework's bottom-line claim. |

The paper's discussion section is structured around these six tests; each becomes a sub-claim with quantitative support.

---

## 9. Implementation Order

Phase 11 builds in this order:

1. **#5 (Hybrid + Cache)** — cheapest, fastest to validate. Clean win or no.
2. **#4 (Summary + RAG)** — needs only existing components.
3. **#1 (Graph + Router)** — depends on Phase 5 GraphRAG.
4. **#2 (RAPTOR + MQ + Reranker)** — depends on Phase 5 RAPTOR.
5. **#3 (MemoRAG + Agent)** — depends on Phase 5 MemoRAG + Phase 6 Agent.
6. **#6 (Meta)** — last, since it depends on all per-domain best results from Phase 12.

---

## 10. Out-of-Scope Hybrids (Documented, Not Built)

A few combinations were considered and **rejected** for v1 — kept here for completeness:

- **GraphRAG + Multi-Agent Memory** — speculative cost; too many moving parts to test cleanly.
- **HyDE + RAPTOR + Self-RAG** — incremental over Hybrid #2; not enough additional signal.
- **Full-Context + Sliding-Window Reasoning** — interesting but requires hosting a fixed-window model variant.
- **State-Space + RAG** — depends on out-of-scope SSM hosting.

These are recorded as future-work lines in the paper.
