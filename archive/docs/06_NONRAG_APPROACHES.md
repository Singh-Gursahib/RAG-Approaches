# 06 — Non-RAG Approach Specifications

> Per-technique specs for the 8 non-RAG long-context strategies. Same template as `05_RAG_APPROACHES.md`. These are the strategies that **do not** rely on a separate retrieval index — they manipulate the context window directly, compress it, cache it, or layer memory across sessions.

---

## 1. Full-Context Injection  *(P0)*

**Mechanism.** Concatenate every relevant document into the prompt; rely on the model's long-context window to attend to what matters. With Gemini 1.5/2 Pro (1M tokens) this fits non-trivial corpora outright.

**Pseudocode.**
```python
def run(query):
    corpus_text = "\n\n".join(doc.text for doc in domain.load_documents())
    prompt = f"{corpus_text}\n\nQuestion: {query}\nAnswer:"
    return generator.generate(prompt, max_context_tokens=1_000_000)
```

**Why it works.** No retrieval errors. The model can attend to **any** part of any document and form arbitrary cross-document connections. Often the strongest baseline when the corpus fits.

**When to use.** Corpora ≤ 800K tokens. Tasks needing deep cross-doc synthesis (code review, contract analysis, full literature surveys). When cost is acceptable.

**When to avoid.** Corpora > model window. Cost-sensitive endpoints. Latency-sensitive endpoints (1M-token prefill is slow).

**Tradeoffs.** Cost grows ~quadratically with input length on most architectures. Latency dominated by prefill. Storage zero (no index).

**Failure modes.** Lost-in-the-middle: information at depths 30–70% in the context is under-attended. Hallucination on edge / boundary content. Quadratic cost shock when corpora grow.

**Ablations.** Window size cap ∈ {32K, 128K, 1M}. Document order ∈ {as-is, reverse, query-similarity-sorted}.

**Domain fit.**
| L | M | E | F | R | C | G |
|---|---|---|---|---|---|---|
| ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ |

(Highest fit: code repos, where structural cross-file reasoning is the whole point.)

**Implementation notes.** Always **also** record `tokens_in` per query — this is the costliest baseline and sets the upper-bound budget for any other technique.

---

## 2. Recursive Summarization  *(P0)*

**Mechanism.** Map-reduce: summarize each chunk → summarize summaries → … → answer the question against the final summary. No retrieval; the corpus is digested top-down.

**Pseudocode.**
```python
def run(query):
    summaries = [generator.summarize(c, query=query) for c in chunks]
    while len(summaries) > stop_n:
        groups = batch(summaries, size=batch_n)
        summaries = [generator.merge_summary(g, query=query) for g in groups]
    final_summary = summaries[0]
    return generator.answer(final_summary, query)
```

**Why it works.** Reduces O(corpus) tokens to O(stop_n × summary_size) at answer time. Query-aware summarization keeps relevant signal.

**When to use.** Single-document deep questions, summarization tasks, long policy/regulatory analyses. When the **same** corpus is queried many times (summary reuse).

**When to avoid.** Precise factual recall (summaries lose specifics). Frequently changing corpora (re-summarize every change).

**Tradeoffs.** O(n) LLM calls upfront, O(log n) merge passes. Query latency low if summaries are cached. Storage = summary tree.

**Failure modes.** Summary drift across levels. Loss of numerical / named-entity precision. Question-conditioning weakens at higher merge levels.

**Ablations.** Query-aware vs query-agnostic summarization. Branching factor (batch_n) ∈ {3, 5, 10}. Summary length cap.

**Domain fit.**
| L | M | E | F | R | C | G |
|---|---|---|---|---|---|---|
| ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ |

**Implementation notes.** Cache the summary tree under `data/processed/<domain>/recursive_summary/tree.json`; invalidate on dataset hash change.

---

## 3. Sliding-Window Reasoning  *(P0)*

**Mechanism.** Slide a window across the corpus; ask the model the question against each window; aggregate the per-window answers (vote / merge / argmax-confidence). Distinct from architectural Sliding-Window Attention — this is an **application-layer** strategy.

**Pseudocode.**
```python
def run(query):
    windows = sliding_windows(corpus_chunks, size=W, stride=S)
    answers = [generator.answer(query, w) for w in windows]
    return aggregator.aggregate(query, answers)   # vote, merge, or argmax
```

**Why it works.** Bounded per-call context (cheap, predictable). Each window is independent → trivially parallel. Combines cleanly with non-LLM aggregation (majority vote on multiple-choice; confidence-weighted merge on free-form).

**When to use.** Embarrassingly parallel workloads (batch processing). Corpora that exceed the model window. Multiple-choice / classification tasks.

**When to avoid.** Multi-hop questions where the answer requires evidence from multiple windows simultaneously (cross-window reasoning is impossible in this scheme).

**Tradeoffs.** Total cost ~ O(corpus / window) generations. Latency dominated by aggregation strategy (parallel vs sequential).

**Failure modes.** Cross-window dependencies missed. Per-window hallucinations propagate to vote. Aggregator becomes the bottleneck.

**Ablations.** Window size ∈ {2K, 8K, 32K}. Stride ∈ {0.5W, 0.75W, 1.0W}. Aggregator ∈ {majority vote, LLM merge, confidence-weighted}.

**Domain fit.**
| L | M | E | F | R | C | G |
|---|---|---|---|---|---|---|
| ⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐⭐ |

**Implementation notes.** Use `asyncio.gather` for parallel window calls under a configurable concurrency cap.

---

## 4. Prompt Compression  *(P1)*

**Mechanism.** A small, fast LLM (LLMLingua / LLMLingua-2) compresses the prompt — removing low-information tokens — before it reaches the primary generator. **Question-independent** mode (corpus pre-compression for reuse) and **question-aware** mode (LongLLMLingua) supported.

**Pseudocode.**
```python
def run(query, corpus_or_chunks):
    compressed = lingua.compress(corpus_or_chunks, ratio=ctx.ratio, query=query if ctx.qa else None)
    return generator.generate(build_prompt(query, compressed))
```

**Why it works.** Natural language is redundant; ~50% of tokens carry the bulk of information. A compressor with a smaller LM identifies low-perplexity tokens and drops them.

**When to use.** Cost reduction at scale. High-volume chatbots with verbose system prompts. Pre-compressing fixed corpora for reuse.

**When to avoid.** Domains where exact wording is contractually / clinically critical (legal clause text, drug dosages, regulatory language).

**Tradeoffs.** +1 compressor pass (small LM, ~50–200ms). Generator input cost down 4–10×. Quality drop usually <5% on summarization, larger on exact-recall tasks.

**Failure modes.** Numerical / named-entity drops. Stylistic loss (legalese → vague). Compressor model drift.

**Ablations.** Ratio ∈ {0.3, 0.5, 0.7}. Question-aware on/off. Compressor variant (Lingua-1, Lingua-2, LongLLMLingua).

**Domain fit.**
| L | M | E | F | R | C | G |
|---|---|---|---|---|---|---|
| ⭐ | ⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ |

**Implementation notes.** Vendor LLMLingua-2 via its pip package; budget compressor latency under 100ms p50.

---

## 5. Context Caching  *(P1)*

**Mechanism.** Use Gemini's **explicit cache** (or equivalent prompt cache) to pre-compute and cache the KV state for a fixed prefix (system prompt + corpus). Subsequent queries reuse the cache; only the per-query suffix is paid for at full price.

**Pseudocode.**
```python
def setup(corpus):
    cache_id = gemini.cache.create(model, contents=[corpus], ttl=ctx.ttl)
    save("cache_id", cache_id)

def run(query):
    return gemini.generate(model, cache=cache_id, contents=[query])
```

**Why it works.** Repeated queries against a fixed corpus pay the prefill cost once. Effective price/latency for the 2nd…Nth query drops dramatically (~50–90% on cache-hit cost).

**When to use.** Document-Q&A products: same corpus, many queries (e.g., a single contract being asked many questions). Live demos. Domain-stable knowledge bases.

**When to avoid.** Highly dynamic corpora. One-shot queries. Short contexts (cache overhead exceeds savings).

**Tradeoffs.** Cache TTL is bounded (e.g., 1h on Gemini explicit cache). Storage cost server-side. Cache invalidation on corpus update.

**Failure modes.** Cache miss after TTL → fall back to full prefill. Stale cache after corpus update if invalidation not triggered. Quality differences across cache-hit vs cache-miss are negligible but should be verified.

**Ablations.** With/without cache. TTL settings. Per-document vs per-corpus cache granularity.

**Domain fit.**
| L | M | E | F | R | C | G |
|---|---|---|---|---|---|---|
| ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ |

**Implementation notes.** Wrap Gemini explicit cache via the SDK's `caches.create()` API; key cache by `(domain, dataset_hash)`. Reuse across runs in the same hour.

---

## 6. Memory-Augmented (MemGPT-style)  *(P1)*

**Mechanism.** Tiered memory — **main context** (active window), **recall storage** (recent interactions, structured), **archival storage** (long-term vector store). The agent has tools to **read** / **write** / **search** these tiers, paging information in and out as the conversation evolves.

**Pseudocode.**
```python
class MemGPT:
    def step(self, user_msg):
        ctx = self.main_context()            # warning fn pages out if needed
        out = self.llm.respond(ctx, tools=[read_recall, search_archival, write_archival])
        return out

# Tools
def read_recall(query): return recall_storage.search(query, k=5)
def search_archival(query): return vector_store.search(embedder.embed_query(query), k=5)
def write_archival(text): vector_store.upsert(text)
```

**Why it works.** Treats the context window as a **hot cache** with explicit eviction and refill. Mirrors operating-system virtual memory: working set in fast tier, cold pages in slow tier, OS (= LLM agent) decides.

**When to use.** Multi-session personal assistants. Longitudinal clinical / educational dialogues. Long-running enterprise agents.

**When to avoid.** Stateless serverless deployments. Single-shot Q&A.

**Tradeoffs.** Stateful infrastructure required. Operational complexity (memory consistency, GC). Per-turn cost includes 0–N memory tool calls.

**Failure modes.** Memory poisoning (incorrect facts persist and degrade future turns). Stale memory contradicts new information. Pathological eviction loops.

**Ablations.** With/without archival. Recall capacity. Eviction policy (LRU vs salience-weighted).

**Domain fit.**
| L | M | E | F | R | C | G |
|---|---|---|---|---|---|---|
| ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ |

**Implementation notes.** Use the open-source **Letta** (formerly MemGPT) library as the reference; wrap it behind our `Technique` interface. Persistent storage via SQLite + Qdrant.

---

## 7. Multi-Agent Memory System  *(P2)*

**Mechanism.** Multiple specialized agents share a memory bus: **Planner** decomposes the task → **Retriever** fetches context → **Writer** produces an answer → **Critic** evaluates and triggers re-loops if needed → **Memorizer** persists insights to long-term storage. Inter-agent messages are themselves memory entries.

**Pseudocode.**
```python
state = SharedMemory()
plan = Planner.run(query, state)
for sub in plan.steps:
    ctx = Retriever.run(sub, state)
    draft = Writer.run(sub, ctx, state)
    score = Critic.run(draft, state)
    if score < threshold:  Writer.revise(draft, score, state)
Memorizer.distill(state)
return final(state)
```

**Why it works.** Specialization improves per-step quality; explicit critic loop catches errors that single-shot agents miss; shared memory amortizes context across steps.

**When to use.** Complex research / analytical workflows. Multi-document compliance reports. Tasks where iteration meaningfully improves quality.

**When to avoid.** Simple Q&A (overkill, multiplicative cost). Latency-sensitive paths.

**Tradeoffs.** Highest cost / latency of any technique here (often 5–15× Naive). Hardest to debug. Greatest variance across seeds.

**Failure modes.** Inter-agent communication errors. Critic miscalibration → over-iteration. Coordination failure → agents talk past each other.

**Ablations.** With/without critic. With/without memorizer. Number of writer revisions ∈ {0, 1, 3}.

**Domain fit.**
| L | M | E | F | R | C | G |
|---|---|---|---|---|---|---|
| ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |

**Implementation notes.** Use LangGraph state machine with one node per role + a typed shared-state object; cap total LLM calls per query in config.

---

## 8. Long-Context Native Reasoning (Reference Baseline)  *(P0)*

**Mechanism.** A **reference benchmark** — not really a "technique" but a pinned configuration: Gemini 1.5/2 Pro with the full corpus or document loaded directly, no retrieval, no compression, no caching, no decomposition. Pure long-context inference.

**Pseudocode.**
```python
def run(query):
    return gemini_pro_long.generate(
        f"{full_corpus}\n\n{query}",
        max_context_tokens=1_000_000
    )
```

**Why it's separate from "Full-Context Injection".** Full-Context (#1) is application-layer — chooses what to inject. This reference baseline is **fixed**: always-everything, always-Pro, always-full-window. Its purpose is to set the **upper bound on quality** that any technique must justify deviating from on cost/latency grounds.

**Why it works.** Modern long-context LLMs are surprisingly effective at unstructured cross-document reasoning when given the entire corpus. Setting a clear "ceiling" makes every other technique's compute argument concrete.

**When to use.** Benchmarking only. Treat as the reference, not a deployable strategy.

**When to avoid.** Cost / latency / privacy-sensitive deployments.

**Tradeoffs.** Highest cost. Highest latency. Highest accuracy ceiling for many tasks (when corpus fits).

**Failure modes.** Lost-in-the-middle on very long contexts. Cost spikes on large corpora. Degraded reasoning when the corpus exceeds ~70% of the window.

**Ablations.** Two window sizes (128K vs 1M). Two Gemini variants (Pro vs Flash) for cost-quality reference points.

**Domain fit.** Universal — its job is to be the reference for every domain.

**Implementation notes.** Run **once per domain × benchmark** in the cross-domain experiment matrix; results back the "cost premium of any other technique" figure in the paper.

---

## 9. Out-of-Scope (Tracked But Not Implemented)

These appear in `research.md` but require model-internal access we don't have:

- **KV Cache Compression** (RocketKV, H2O, ChunkKV, KIVI). Requires a custom inference server. We **document** expected behavior and **cite** published numbers in the paper's related-work; we do **not** reimplement.
- **Sliding-Window Attention** (model-architecture variant). Same — citation, not reimplementation.
- **State-Space Memory** (Mamba / RWKV-style). Tracked as a future hook; not in v1.

A configuration switch lets us point at a hosted or local model server that supports these natively if one becomes available; the framework doesn't preclude their inclusion.

---

## 10. Cross-Technique Notes

- **Full-Context** and **Long-Context Native** look similar but serve different roles: the former is configurable / used in practice; the latter is a fixed reference ceiling.
- **Recursive Summarization, Sliding-Window Reasoning, Multi-Agent Memory** are all "no-vector-store" strategies — useful when retrieval infrastructure is unavailable or undesirable.
- **Context Caching** is the cheapest high-quality option for **document-Q&A products** with a stable corpus and is a strong candidate for hybrid stacks (see `10_HYBRID_PROPOSALS.md`).
- **MemGPT and Multi-Agent Memory** are the only stateful techniques — they are the only options if the use case has cross-session continuity (longitudinal patient notes, ongoing research projects).
- **All non-RAG techniques use the same `Generator` and `RunRecorder`** abstractions as RAG techniques, so cost / latency / token telemetry is uniform and directly comparable.
