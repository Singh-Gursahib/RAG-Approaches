# 05 — RAG Approach Specifications

> Per-technique implementation specs for all 13 RAG-side techniques. Each entry follows the same structure so they are directly comparable.

**Per-technique spec template:**
- **Mechanism** — what it does, in 3–5 lines.
- **Pseudocode** — minimal reference implementation sketch.
- **Why it works** — the underlying intuition.
- **When to use** — concrete signals that this is the right pick.
- **When to avoid** — failure-mode signals.
- **Tradeoffs** — index cost, query cost, latency, memory, scalability.
- **Failure modes** — known ways it breaks.
- **Ablations** — minimum set of ablations the framework will run.
- **Domain fit** — quick scoring across our 7 domains.
- **Implementation notes** — concrete decisions for our framework.

---

## 1. Naive Vector RAG  *(P0)*

**Mechanism.** Chunk corpus → embed → store in vector DB → at query time embed query → cosine top-k → stuff into prompt → generate.

**Pseudocode.**
```python
def run(query: str, ctx):
    qv = embedder.embed_query(query)
    hits = store.search(qv, k=ctx.k)              # top-k
    prompt = build_prompt(ctx.prompts, query, hits)
    return generator.generate(prompt)
```

**Why it works.** Semantic similarity is a strong prior for relevance when the corpus topic distribution roughly matches query distribution and answers are local (one chunk usually contains the answer).

**When to use.** FAQ bots, single-document Q&A, prototype baseline. Always include as a baseline.

**When to avoid.** Multi-hop reasoning, queries phrased very differently from documents, corpora with heavy table/code content.

**Tradeoffs.** Index cost low (embedding only). Query cost low. Latency low. Memory ~vectors × dim × 4 bytes. Scales linearly with corpus size.

**Failure modes.** Lost-in-the-middle when k is large. Chunk-boundary artifacts. Fails on out-of-vocabulary terminology gaps. Top-k can return semantically similar but logically irrelevant chunks.

**Ablations.** k ∈ {3, 5, 10, 20}. With/without query normalization. Two embedders (`nomic`, `bge-m3`). Two chunkers (recursive 512, semantic).

**Domain fit.**
| L | M | E | F | R | C | G |
|---|---|---|---|---|---|---|
| ⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐⭐ |

(L=Legal, M=Medical, E=Education, F=Finance, R=Research, C=Code, G=General)

**Implementation notes.** First technique implemented. Sets the recorder/manifest patterns reused by all later techniques.

---

## 2. Hybrid RAG  *(P0)*

**Mechanism.** Two retrievers in parallel — BM25 (sparse, lexical) and dense (vector) — fused via Reciprocal Rank Fusion (RRF) → cross-encoder rerank → top-k_final → generate.

**Pseudocode.**
```python
def run(query, ctx):
    sparse = bm25.search(query, k=ctx.k_sparse)
    dense = store.search(embedder.embed_query(query), k=ctx.k_dense)
    fused = reciprocal_rank_fusion([sparse, dense], k=ctx.k_fuse)
    reranked = reranker.rerank(query, fused, top_k=ctx.k_final)
    return generator.generate(build_prompt(query, reranked))
```

**Why it works.** Dense retrieval captures meaning; sparse captures rare lexical signals (numbers, names, identifiers). RRF is robust to score-scale mismatch. Cross-encoder rerank fixes order errors that dense+sparse miss.

**When to use.** Default for most domains. Strongest single non-structured baseline.

**When to avoid.** Tiny corpora where reranker latency dominates. Pure relational queries (use GraphRAG instead).

**Tradeoffs.** +1 reranker pass per query (~50–200ms cross-encoder latency on CPU). Slightly higher index size (BM25 index alongside vectors).

**Failure modes.** Reranker miscalibration on out-of-distribution queries. RRF default k may suppress correct-but-low-rank results.

**Ablations.** With/without BM25. With/without reranker. RRF k ∈ {30, 60}. Reranker ∈ {bge-v2, cohere-v3}.

**Domain fit.**
| L | M | E | F | R | C | G |
|---|---|---|---|---|---|---|
| ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |

**Implementation notes.** Use Qdrant's native hybrid search (`SparseVector` + dense). Cross-encoder via sentence-transformers.

---

## 3. Parent-Child Retrieval  *(P0)*

**Mechanism.** Index small chunks (e.g., 200 tokens) for retrieval precision; at query time return their **parent** chunks (e.g., 1500 tokens) for generation context.

**Pseudocode.**
```python
def index(docs):
    for doc in docs:
        for parent in chunk(doc, size=1500):
            for child in chunk(parent, size=200):
                store.upsert(child, payload={"parent_id": parent.id})

def run(query):
    children = store.search(qv, k=20)
    parent_ids = unique([c.parent_id for c in children])
    parents = parent_store.get_many(parent_ids[:k_final])
    return generator.generate(build_prompt(query, parents))
```

**Why it works.** Decouples the retrieval unit (small, precise) from the reading unit (large, coherent). Counters chunk-boundary artifacts.

**When to use.** Long, narrative documents (legal contracts, textbooks, policy docs).

**When to avoid.** Already-short documents (parent and child collapse to same span). Highly tabular corpora.

**Tradeoffs.** ~2× storage (children + parents). Index time slightly higher. Query time near-identical.

**Failure modes.** Parent definition unclear in unstructured docs (paragraph? section?). Duplicate parents bleed across queries.

**Ablations.** Child sizes ∈ {128, 256, 512}. Parent sizes ∈ {1024, 1500, 2048}. Heuristic vs structural parents (paragraph vs section).

**Domain fit.**
| L | M | E | F | R | C | G |
|---|---|---|---|---|---|---|
| ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ |

**Implementation notes.** Store parents in a sidecar SQLite table keyed by `parent_id`; do not embed parents.

---

## 4. Multi-Query Retrieval  *(P0)*

**Mechanism.** Use an LLM to generate N diverse rewrites of the user query (different phrasings, sub-questions, hypothetical perspectives) → retrieve for each → fuse via RRF → rerank → generate.

**Pseudocode.**
```python
def run(query):
    rewrites = generator.generate(REWRITE_PROMPT.format(query, n=ctx.n_rewrites))
    candidates_per_q = [store.search(embedder.embed_query(q), k=10)
                        for q in [query] + rewrites]
    fused = reciprocal_rank_fusion(candidates_per_q)
    reranked = reranker.rerank(query, fused, top_k=ctx.k_final)
    return generator.generate(build_prompt(query, reranked))
```

**Why it works.** Increases recall for under-specified or ambiguous queries; diversity in rewrites covers the answer's likely paraphrasings.

**When to use.** Open-ended questions. Education / general QA. When recall matters more than latency.

**When to avoid.** Already-precise queries (rewrites add noise). Latency-sensitive applications.

**Tradeoffs.** +1 LLM call (small) for rewrites. N× retrieval. Query latency ~2–3× naive.

**Failure modes.** Rewrites drift to a different topic, suppressing correct chunks. Recall up but precision down → distractors in context.

**Ablations.** N ∈ {3, 5, 8}. Rewrite prompt variants (paraphrase / decompose / hypothesize). With/without rerank.

**Domain fit.**
| L | M | E | F | R | C | G |
|---|---|---|---|---|---|---|
| ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ |

**Implementation notes.** Use Gemini Flash for rewrites (cost). Cache rewrites per query hash.

---

## 5. HyDE — Hypothetical Document Embeddings  *(P0)*

**Mechanism.** LLM writes a plausible answer to the query (the "hypothetical document"); embed that answer; retrieve similar real documents; generate the final answer from real retrievals.

**Pseudocode.**
```python
def run(query):
    hypo = generator.generate(HYDE_PROMPT.format(query=query))
    qv = embedder.embed_query(hypo.text)
    hits = store.search(qv, k=ctx.k)
    return generator.generate(build_prompt(query, hits))
```

**Why it works.** A short query embeds poorly relative to the long, answer-shaped chunks it should match. A hypothetical answer has more lexical overlap with real answer-bearing documents.

**When to use.** Cross-vocabulary domains (lay-English query over technical corpus). Research, medical literature, legal lay-queries.

**When to avoid.** Narrow / specialized corpora where the hypothesis hallucinates outside the index. Low-latency apps.

**Tradeoffs.** +1 LLM call per query. Latency +1× generator round-trip. Cost ~+0.5–1× over naive RAG.

**Failure modes.** Hallucinated hypothesis biases retrieval toward incorrect content. "Garbage hypothesis → garbage retrieval."

**Ablations.** With/without hypothesis. Hypothesis length cap. Generator for hypothesis (Flash vs Pro).

**Domain fit.**
| L | M | E | F | R | C | G |
|---|---|---|---|---|---|---|
| ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ |

**Implementation notes.** Always log the hypothetical doc to `outputs.jsonl` for audit.

---

## 6. Hierarchical RAG  *(P1)*

**Mechanism.** Build an explicit document → section → paragraph index based on **document structure** (headings, sections), no LLM summarization. Coarse-to-fine retrieval: section-level top-k → paragraph-level top-k within those sections.

**Pseudocode.**
```python
def run(query):
    sec_hits = section_store.search(qv, k=ctx.section_k)        # ~5
    para_hits = paragraph_store.search(qv, k=ctx.para_k,
                                       filter={"section_id": [s.id for s in sec_hits]})
    return generator.generate(build_prompt(query, para_hits))
```

**Why it works.** Document structure is free supervision. Coarse selection prunes the search space cheaply; fine retrieval gets precision.

**When to use.** Structured corpora — legal acts, textbooks, regulatory filings, well-formatted PDFs.

**When to avoid.** Unstructured blobs (forums, transcripts, social posts).

**Tradeoffs.** Storage ~2–3× (multi-level indices). Index time low (no LLM). Query time slightly higher (two retrievals).

**Failure modes.** Bad parser → wrong sectioning → cascading errors. Section embeddings dominated by section headings.

**Ablations.** With/without section pre-filter. Section embedding source (heading only vs heading+first-para vs whole-section average).

**Domain fit.**
| L | M | E | F | R | C | G |
|---|---|---|---|---|---|---|
| ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐ |

**Implementation notes.** Reuse the parser's section tree from `pipelines/parse/`.

---

## 7. RAPTOR  *(P1)*

**Mechanism.** Cluster chunks (UMAP + GMM) → LLM-summarize each cluster → cluster the summaries → recurse → multi-level tree from raw chunks (leaves) to a single root summary. Retrieval can target any level.

**Pseudocode.**
```python
def index(docs):
    leaves = chunk_all(docs)
    levels = [leaves]
    while len(levels[-1]) > stop_n:
        clusters = cluster(levels[-1])
        summaries = [summarizer.summarize(c) for c in clusters]
        levels.append(summaries)
    store.upsert_all(levels)

def run(query):
    hits = store.search_multi_level(qv, k=ctx.k, levels=ctx.levels)
    return generator.generate(build_prompt(query, hits))
```

**Why it works.** Multi-granularity retrieval — the same index serves both "give me an overview" and "find the specific clause" without re-indexing.

**When to use.** Long narrative documents, policy/regulatory filings, clinical guidelines, surveys.

**When to avoid.** Tabular / structured data. Frequently updating corpora (re-summarization is expensive).

**Tradeoffs.** Heavy index cost (multiple LLM passes; O(n) summaries per level, O(log n) levels). Storage 1.5–2× raw chunks. Query time near-naive.

**Failure modes.** Lossy summaries propagate up; clusters with weak coherence produce vague summaries that retrieve as false positives.

**Ablations.** With/without recursion (one-level vs multi-level). Cluster size targets ∈ {10, 20, 50}. Summarizer (Flash vs Pro).

**Domain fit.**
| L | M | E | F | R | C | G |
|---|---|---|---|---|---|---|
| ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ |

**Implementation notes.** Track cluster lineage in chunk metadata so a retrieved summary can be expanded to its constituent leaves on demand.

---

## 8. GraphRAG  *(P1)*

**Mechanism.** Two-phase. **Indexing:** LLM extracts entities + relationships per chunk → builds a global knowledge graph → community detection (Leiden) → LLM summarizes each community at multiple levels. **Querying:** *local search* (start from query-relevant entities, walk the graph) for specific Q; *global search* (rank community summaries) for thematic Q.

**Pseudocode.**
```python
def index(docs):
    triples = []
    for ch in chunks:
        triples += llm.extract_triples(ch.text)
    G = build_graph(triples)
    communities = leiden(G)
    summaries = {c: llm.summarize_community(G, c) for c in communities}
    return GraphIndex(G, communities, summaries)

def run(query):
    entities = llm.extract_entities(query)
    if mode == "local":
        ctx_chunks = walk_local(G, entities, depth=2)
    else:
        ctx_chunks = top_communities_by_relevance(query, summaries)
    return generator.generate(build_prompt(query, ctx_chunks))
```

**Why it works.** Explicit relational structure outperforms vector similarity when the answer requires connecting facts (multi-hop). Community summaries enable global queries impossible with flat retrieval.

**When to use.** Legal (case-law citation networks), scientific (research-citation graphs), enterprise wikis with dense interlinks.

**When to avoid.** High-churn corpora (re-indexing is expensive). Single-document Q&A.

**Tradeoffs.** **Index cost very high** (O(n) LLM calls for extraction, O(n) for community summaries). Storage large (graph + summaries + chunks). Query cost moderate. Inherent indexing latency (minutes-to-hours for large corpora).

**Failure modes.** Triple extractor produces noisy / incorrect relations → garbage graph. Community granularity sensitive — too coarse misses detail; too fine fragments answers.

**Ablations.** With/without community summaries. Local-only vs global-only vs hybrid. Extraction LLM (Flash vs Pro). Leiden resolution parameter.

**Domain fit.**
| L | M | E | F | R | C | G |
|---|---|---|---|---|---|---|
| ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ |

**Implementation notes.** Reimplement a minimal version of Microsoft GraphRAG against our interfaces; cite/ship a switch to use the upstream library for ablation comparison. Neo4j store backed by `graph/neo4j_store.py`.

---

## 9. MemoRAG  *(P1)*

**Mechanism.** A **lightweight long-context LLM** reads the entire corpus (or large slabs) and compresses it into "memory tokens" (a global compressed representation). At query time, this memory generates **clues** (anchor phrases / sub-queries) which guide retrieval of precise evidence chunks. A second, larger generator answers using clues + retrieved evidence.

**Pseudocode.**
```python
def index(docs):
    memory = memory_lm.compress(concat(docs))   # one-off, cached

def run(query):
    clues = memory_lm.generate_clues(query, memory)
    retrieved = []
    for clue in clues:
        retrieved += store.search(embedder.embed_query(clue), k=ctx.k_per_clue)
    retrieved = dedupe(retrieved)
    return generator.generate(build_prompt(query, retrieved, clues))
```

**Why it works.** "Fuzzy" queries (no clear keyword anchor) fail vector retrieval. Global memory provides query-conditioned clues that retrieve well.

**When to use.** Mixed global/local question workloads. Enterprise document portals. Holistic summaries + specific lookups in the same system.

**When to avoid.** Real-time apps (memory token generation is non-trivial). Tiny corpora (no benefit).

**Tradeoffs.** Two-model architecture. Memory build is a one-time heavy cost; per-query overhead is one extra small-LM call. Storage moderate (memory tokens + index).

**Failure modes.** Stale memory after corpus updates. Hallucinated clues retrieve wrong chunks.

**Ablations.** With/without memory (degrades to clue-less retrieval). Clue count ∈ {1, 3, 5}. Memory model size.

**Domain fit.**
| L | M | E | F | R | C | G |
|---|---|---|---|---|---|---|
| ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ |

**Implementation notes.** Use Gemini Flash as the memory model (cheap, long context). Cache the memory artifact in `data/processed/<domain>/memo_rag/memory.bin`.

---

## 10. Self-RAG  *(P1)*

**Mechanism.** The generator is trained / prompted to emit special **reflection tokens** during generation: `[Retrieve]` (need more context), `[ISREL]` (is retrieved chunk relevant), `[ISSUP]` (is generation supported by retrieval), `[ISUSE]` (is generation useful). The runtime parses these tokens, conditionally retrieves, and gates output.

**Pseudocode.**
```python
def run(query):
    state = {"answer": "", "retrieved": []}
    while not done(state):
        out = generator.generate(prompt_with_reflection(state))
        if "[Retrieve]" in out:
            extra = store.search(embedder.embed_query(extract_subq(out)), k=5)
            state["retrieved"] += extra
        else:
            state["answer"] += out
    return finalize(state)
```

**Why it works.** Inline self-critique — the model decides when retrieval is needed, prunes irrelevant chunks, and self-checks support before finalizing.

**When to use.** Mixed factual / open-ended workloads where retrieval *necessity* varies per query.

**When to avoid.** Throughput-sensitive systems. Strict-SLA endpoints.

**Tradeoffs.** Variable, often 2–4× latency vs Naive. Cost similarly variable. Determinism harder (loop bound required).

**Failure modes.** Loops (retrieve → reflect → retrieve …); inflated cost; reflection token format drift across model versions.

**Ablations.** Hard loop bound ∈ {2, 4, 8}. With/without each reflection token type. Critic-only mode (no retrieval gating).

**Domain fit.**
| L | M | E | F | R | C | G |
|---|---|---|---|---|---|---|
| ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |

**Implementation notes.** Without a fine-tuned Self-RAG checkpoint, simulate via prompting Gemini Pro to emit structured reflection tags. Validate JSON with a strict parser.

---

## 11. Agentic RAG  *(P0)*

**Mechanism.** A LangGraph state machine orchestrates: **plan** → **retrieve(tool)** → **assess** → optional re-retrieve → **synthesize** → **critique** → finalize. The agent calls retrieval as a *tool* and decides which tool, with which sub-query.

**Pseudocode.**
```python
graph = StateGraph(AgentState)
graph.add_node("plan", plan_step)
graph.add_node("retrieve", retrieve_tool)
graph.add_node("assess", assess_step)
graph.add_node("synthesize", synthesize_step)
graph.add_node("critique", critique_step)
graph.add_edge("plan", "retrieve")
graph.add_conditional_edge("assess", lambda s: "synthesize" if s.enough else "retrieve")
graph.add_edge("synthesize", "critique")
graph.add_conditional_edge("critique", lambda s: END if s.passes else "synthesize")
```

**Why it works.** Multi-hop questions decompose into sub-queries; explicit planning + iterative retrieval mirrors how a researcher actually works.

**When to use.** Complex legal/medical reasoning, multi-document analytics, when correctness >> latency.

**When to avoid.** Simple factual Q&A (overkill).

**Tradeoffs.** 3–10× latency / cost vs Naive. Hardest to debug. Most subject to non-determinism.

**Failure modes.** Infinite loops; sub-query drift; over-retrieval (filling context with marginal chunks).

**Ablations.** Max steps ∈ {3, 5, 10}. Critic on/off. Tool set (retrieve only / retrieve + web / retrieve + calculator).

**Domain fit.**
| L | M | E | F | R | C | G |
|---|---|---|---|---|---|---|
| ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |

**Implementation notes.** LangGraph for the state machine; technique config caps steps and total cost.

---

## 12. Adaptive RAG  *(P1)*

**Mechanism.** A **lightweight router** classifies each incoming query into `no_retrieve` / `single_step` / `multi_step` / `full_context`. The appropriate downstream pipeline is dispatched. The router can be a small classifier or a Flash-LM with a tight prompt.

**Pseudocode.**
```python
def run(query):
    mode = router.classify(query)              # "no_retrieve" | "single" | "multi" | "full"
    if mode == "no_retrieve":   return generator.generate(query)
    if mode == "single":        return naive_rag.run(query)
    if mode == "multi":         return agentic_rag.run(query)
    if mode == "full":          return full_context.run(query)
```

**Why it works.** Mixed workloads have varying complexity. Always-on multi-hop wastes budget on simple queries; always-on naive fails complex ones.

**When to use.** Production systems with heterogeneous queries. Cost-aware deployments.

**When to avoid.** Uniform query distributions (router overhead has no upside).

**Tradeoffs.** +1 small classifier call per query. Aggregate cost typically lower than always-multi-step.

**Failure modes.** Router misclassification (under-route → wrong answer; over-route → wasted cost). Classifier drift over time.

**Ablations.** Router ∈ {rule-based, Flash-LM, fine-tuned classifier}. With/without `full_context` branch.

**Domain fit.** Best in **mixed** real-world workloads; this is the technique most likely to win the cost-per-correct-answer Pareto.

**Implementation notes.** The router becomes the decision-framework artifact for the paper. Train it from a labeled subset of benchmark queries.

---

## 13. Contextual Compression RAG  *(P2)*

**Mechanism.** Standard retrieve top-k, then **compress** the retrieved chunks (LLMLingua / LongLLMLingua or LLM-based extractive summarization) before injection. Compression is *query-aware*.

**Pseudocode.**
```python
def run(query):
    hits = store.search(qv, k=ctx.k)
    compressed = compressor.compress(query, hits, ratio=ctx.ratio)
    return generator.generate(build_prompt(query, compressed))
```

**Why it works.** Allows higher k (more recall) while keeping the generator's input compact. Reduces lost-in-the-middle and cost.

**When to use.** Cost-sensitive long-context use cases. High-k retrieval where most chunks are partially useful.

**When to avoid.** Domains where **exact wording matters** (legal, medical specifics, code).

**Tradeoffs.** +1 compressor pass (small LM). Cost down ~30–60% on input tokens. Compression error risk.

**Failure modes.** Numerical fidelity loss. Drops rare terminology. Compressor hallucinates.

**Ablations.** Compression ratio ∈ {0.3, 0.5, 0.7}. Compressor model variant. With/without question-aware mode.

**Domain fit.** Strong fit for general/finance summary tasks; weak fit for legal/medical exact-clause tasks.

**Implementation notes.** Wrap LLMLingua-2 via its Python package; budget compressor at <100ms p50.

---

## 14. Cross-Technique Notes

- **All techniques share the same `Embedder`, `Reranker`, `Generator`** abstractions — swapping these is a config change.
- **Reranker is opt-in via config** for every retrieval-based technique. Ablations toggle this.
- **Per-technique prompt templates** live in `techniques/<family>/<name>/prompts.yaml` and are hashed into the run manifest.
- **Cost telemetry is collected uniformly** by the `Generator` adapter — every technique reports tokens / $ / latency without writing custom code.
- **All P0 techniques run on every domain** in the smoke benchmark (Phase 3 exit gate). Heavier techniques run on a curated subset for cost reasons.
