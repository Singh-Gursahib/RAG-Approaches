# Long-Context Management in Large Language Models
## A Comprehensive Technical Analysis for Generative Web Products

> **Scope:** RAG-based approaches, non-RAG architectural techniques, domain-specific trade-offs (legal, medical, enterprise), and a README-style quick-reference summary.

---

## Table of Contents

1. [Why Long-Context Management Matters](#why-it-matters)
2. [RAG-Based Approaches](#rag-based-approaches)
   - Naive / Baseline RAG
   - GraphRAG
   - RAPTOR
   - HyDE (Hypothetical Document Embeddings)
   - MemoRAG
   - Agentic / Self-RAG
3. [Non-RAG Techniques](#non-rag-techniques)
   - Full Context Window Injection
   - KV Cache Compression
   - Sliding Window Attention
   - Memory-Augmented Architectures
   - Prompt Compression (LLMLingua / LLMLingua-2)
4. [Domain Deep-Dives](#domain-deep-dives)
   - Legal
   - Medical / Biomedical
   - Enterprise / Finance / Code
5. [Comparative Summary Table](#comparative-summary)
6. [README Quick Reference](#readme-quick-reference)

---

## 1. Why Long-Context Management Matters <a name="why-it-matters"></a>

Modern LLMs have expanded context windows dramatically — from 512 tokens in GPT-2 to 128K in Claude 3 and GPT-4-Turbo, and up to 10M in Llama 4 (Meta, 2025). Yet simply increasing window size does not solve the core engineering problem: **how do you efficiently deliver the right information to the model at the right time?**

Three fundamental tensions drive every design decision:

- **Relevance vs. completeness** — injecting everything sacrifices signal-to-noise; retrieving too narrowly loses cross-document context.
- **Cost vs. accuracy** — larger contexts inflate inference cost quadratically; compression risks information loss.
- **Latency vs. depth** — retrieval pipelines add round-trips; in-context reasoning takes more tokens.

Understanding these tensions is the prerequisite for choosing the right strategy per product domain.

---

## 2. RAG-Based Approaches <a name="rag-based-approaches"></a>

### 2.1 Naive / Baseline RAG

**How It Works**

The simplest RAG pattern: embed documents into a vector store, embed the user query, retrieve the top-k most similar chunks via cosine similarity (dense retrieval), and inject them into the prompt. Optionally add a BM25 sparse-retrieval layer for hybrid search.

**Strengths**
- Simple to implement with LangChain, LlamaIndex, or Haystack
- Works well for well-scoped factual Q&A
- Transparent — every answer can be traced to a source chunk
- Low indexing cost and fast cold-start

**Weaknesses**
- Fails at multi-hop reasoning (answer requires connecting facts from 3+ documents)
- Order of retrieved chunks matters significantly; random ordering degrades quality
- "Lost-in-the-middle" effect: LLMs underuse information placed in the middle of context
- Chunk boundary artifacts — semantic units split across chunks lose coherence

**Ideal Use Cases**
- FAQ bots over company knowledge bases
- Single-document Q&A (e.g., policy lookups)
- Prototype phases before committing to advanced retrieval

---

### 2.2 GraphRAG (Microsoft, 2024–2025)

**How It Works**

GraphRAG preprocesses a corpus by extracting named entities and their relationships, then builds a structured knowledge graph. Nodes are clustered into "communities," and LLM-generated summaries are produced for each community at multiple granularities. At query time, the system traverses the graph using local (entity-level) or global (community-level) search, grounding answers in relational context rather than flat vector similarity.

**Strengths**
- Dramatically improves reasoning over documents with dense inter-entity relationships (contracts, scientific literature, codebases)
- Global queries ("What are the main themes across all documents?") become tractable
- Reduces hallucination by grounding inference in explicit graph structure
- Handles semantic gaps that pure vector similarity misses

**Weaknesses**
- Very high indexing cost — entity extraction and community summarization require many LLM calls (O(n) to O(n²))
- Graph construction quality is sensitive to the model used for extraction
- Slower query-time latency than naive RAG
- Storage footprint is substantially larger than a plain vector index

**Ideal Use Cases**
- Legal: mapping case law networks, statute-to-regulation cross-references
- Scientific research: tracking citation networks, identifying conflicting findings
- Enterprise knowledge management: large internal wikis with interconnected topics

---

### 2.3 RAPTOR (Recursive Abstractive Processing for Tree-Organized Retrieval)

**How It Works**

RAPTOR builds a hierarchical tree structure over a corpus. It first clusters semantically similar text chunks, then uses an LLM to generate abstractive summaries of each cluster. This process repeats recursively: summaries are themselves clustered and re-summarized, building a tree from raw chunks (leaves) up to a single high-level summary (root). At query time, retrieval can happen at any level of the tree — coarse-grained for thematic queries, fine-grained for detail queries.

**Strengths**
- Multi-granularity retrieval: can answer both "give me an overview" and "find the specific clause" queries
- Much better than flat RAG for long documents requiring both global understanding and local precision
- Summaries at each level reduce token usage while preserving semantic coverage
- Hierarchical structure mirrors how humans organize knowledge (books → chapters → sections)

**Weaknesses**
- Offline indexing is expensive (multiple LLM summarization passes)
- Summary fidelity depends on LLM quality — weak models produce lossy summaries
- Less effective for highly factual, non-narrative corpora (tables, code, structured data)
- Not well-suited to corpora that update frequently (re-summarization is costly)

**Ideal Use Cases**
- Legal: summarizing large contracts and surfacing relevant sub-clauses
- Medical: navigating clinical guidelines (overview + specific protocol)
- Long-form journalism, policy documents, regulatory filings

---

### 2.4 HyDE (Hypothetical Document Embeddings)

**How It Works**

Rather than embedding the raw user query for vector retrieval, HyDE first asks the LLM to generate a *hypothetical answer document* — a plausible but unverified response to the query. That hypothetical document is then embedded and used as the retrieval vector. The intuition is that a generated answer has higher lexical and semantic overlap with real answer-containing documents than a short query does.

**Strengths**
- Significantly improves retrieval precision for complex or abstract queries where the question phrasing is far from the answer phrasing
- No changes to the underlying document index — drop-in improvement
- Empirically validated to outperform baseline RAG on retrieval precision benchmarks
- Helpful for zero-shot domains where query reformulation by hand is impractical

**Weaknesses**
- Adds one full LLM generation step per query, increasing latency and cost
- If the hypothetical document is factually wrong, retrieval can be biased toward incorrect context ("garbage in, garbage out" at the retrieval stage)
- Less effective when the knowledge base is narrow or highly specialized (generated hypothesis may hallucinate outside real corpus)
- Not suitable for real-time applications requiring sub-100ms retrieval

**Ideal Use Cases**
- Research assistants querying academic paper databases
- Legal discovery where query language is lay English but corpus is legal terminology
- Cross-domain knowledge systems with large semantic gaps between query and document vocabulary

---

### 2.5 MemoRAG

**How It Works**

MemoRAG addresses the failure mode of standard RAG on "fuzzy" tasks — queries where the information need is not crisply stated, or where the answer requires global document understanding rather than local chunk matching. It maintains a **global memory** built by a lightweight LLM that reads the entire corpus and compresses it into memory tokens representing document-level context. When a query arrives, this global memory is used to generate "clues" — anchor phrases that guide the retrieval of precise evidence chunks from the full corpus. The final answer is generated by a larger model with both the clues and retrieved evidence in context.

**Strengths**
- Handles tasks that require holistic document understanding (summarization, thematic analysis)
- Global memory persists across queries — amortizes the cost of full-document reading
- Effective for both simple fact-retrieval and complex narrative queries with a single system
- Does not require a perfectly formulated query from the user

**Weaknesses**
- Two-model architecture adds operational complexity (one for memory, one for generation)
- Global memory quality depends on the compression LLM's capabilities
- Higher memory footprint (global memory tokens must be maintained)
- Less mature ecosystem support compared to naive RAG or GraphRAG

**Ideal Use Cases**
- Enterprise document portals with mixed structured/unstructured content
- Customer support on complex product manuals
- Research summarization over large literature collections

---

### 2.6 Agentic RAG / Self-RAG

**How It Works**

Agentic RAG replaces the static retrieve-once pattern with an LLM agent that iteratively decides *when to retrieve*, *what to retrieve*, and *whether retrieved content is sufficient*. Self-RAG goes further: the model generates reflection tokens during generation to assess retrieval necessity and output quality inline. Q-RAG (2025) formalizes this with reinforcement learning, fine-tuning the embedder model to optimize multi-step retrieval using value-based RL.

**Strengths**
- Handles multi-hop queries naturally — agent can issue follow-up retrievals based on intermediate reasoning
- Self-correction: agent can detect irrelevant or contradictory retrieved chunks and retrieve again
- More flexible than static pipelines; adapts to query complexity at runtime
- State-of-the-art performance on complex long-context benchmarks (up to 10M token contexts in Q-RAG)

**Weaknesses**
- Non-deterministic — harder to test, debug, and audit
- Multiple LLM calls per query = high latency and cost
- Risk of agentic loops (infinite retrieval cycles)
- Overkill for simple factual queries; adds unnecessary overhead

**Ideal Use Cases**
- Legal research assistants needing multi-step reasoning across case law and statutes
- Medical diagnosis support requiring cross-referencing symptoms, drug interactions, and clinical guidelines
- Complex enterprise analytics combining internal data with external knowledge

---

## 3. Non-RAG Techniques <a name="non-rag-techniques"></a>

### 3.1 Full Context Window Injection

**How It Works**

The simplest possible strategy: load all relevant documents directly into the model's context window and let the model attend to everything. Modern frontier models (Gemini 1.5 Pro at 1M tokens, Llama 4 at 10M tokens) make this increasingly viable.

**Strengths**
- Zero retrieval infrastructure — no vector databases, no chunking logic, no embedding pipelines
- Excellent cross-document reasoning — the model can attend to any part of any document
- No information loss from chunking or retrieval errors
- Strong baseline that often outperforms naive RAG for tasks requiring full-document understanding

**Weaknesses**
- Cost scales quadratically with context length — 1M token contexts are expensive
- Latency is high for large inputs
- "Lost-in-the-middle" degradation: LLMs underperform on information placed in the middle of very long contexts
- Not viable for corpora larger than the context window

**Ideal Use Cases**
- Code review over entire repositories (with Gemini 1.5 Pro or Llama 4)
- Short-to-medium document analysis where cost is not a constraint
- Prototyping and evaluation baselines

---

### 3.2 KV Cache Compression

**How It Works**

During Transformer inference, Key-Value (KV) states for all input tokens are cached to avoid recomputation. For long contexts, this cache becomes the dominant memory bottleneck — a 100K token context in LLaMA-2-7B requires over 50GB of RAM. KV cache compression reduces this footprint via several strategies:

- **Token eviction:** drop KV pairs for low-importance tokens (H2O, SnapKV, StreamingLLM)
- **KV merging:** combine similar KV pairs into fewer synthetic representations
- **Quantization:** reduce precision of KV values (KIVI, FP8 quantization)
- **Semantic chunk-based compression (ChunkKV, 2025):** treat semantic chunks as compression units instead of individual tokens, preserving linguistic structures

RocketKV (ICML 2025) achieves up to 400× compression ratio with 3.7× end-to-end speedup and only negligible accuracy loss on long-context benchmarks.

**Strengths**
- Training-free options (RocketKV, H2O) — plug into existing deployed models
- Dramatic memory reduction enables longer effective contexts on fixed hardware
- Addresses the root hardware constraint rather than working around it
- Semantic-preserving methods (ChunkKV) maintain context coherence better than token-level eviction

**Weaknesses**
- Aggressive compression degrades performance, especially for multi-hop reasoning tasks
- Most methods are question-independent by default — compressing without knowing future queries risks dropping critical tokens
- Adds engineering complexity to the inference stack
- Not applicable at the application layer — requires access to model internals

**Ideal Use Cases**
- Production inference serving where GPU memory is the bottleneck
- Real-time applications requiring low latency over long documents
- Edge deployment of LLMs with constrained memory

---

### 3.3 Sliding Window Attention

**How It Works**

Instead of full attention (where every token attends to every other token, O(n²) complexity), Sliding Window Attention (SWA) restricts each token's attention to a fixed-size local window around it, reducing complexity to O(n). Variants include interleaved full/sparse attention layers (used in Mistral) and attention sink preservation (keeping the first few "sink" tokens always in scope).

SWAA (2025) addresses the key weakness of naive SWA — performance collapse when applied to models pretrained with full attention — by combining FA decode, interleaved layers, sink token preservation, and lightweight fine-tuning for 30-100% inference speedups with acceptable quality retention.

**Strengths**
- Linear complexity — enables very long sequences on standard hardware
- Widely adopted in production models (Mistral, Llama 2/3 use grouped-query attention with local windows)
- Can be combined with global attention tokens for hybrid coverage
- No external infrastructure needed

**Weaknesses**
- Cannot directly attend to distant tokens — fails on tasks requiring long-range dependencies
- Training-inference mismatch when adapting pretrained models
- Poor performance on "needle-in-a-haystack" tasks where the relevant token is far from the query position
- Not suitable for applications requiring precise cross-document global reasoning

**Ideal Use Cases**
- Streaming/real-time inference (chat, live transcription)
- Applications where recent context dominates (conversational agents)
- Latency-critical inference serving

---

### 3.4 Memory-Augmented Architectures (MemGPT, Hierarchical Memory)

**How It Works**

Memory-augmented systems give LLMs a multi-tier memory hierarchy analogous to human working memory:

- **Working memory:** active context window (hot, fast, limited)
- **Episodic memory:** recent interaction history stored in structured external storage
- **Long-term memory:** persistent vector store for factual and procedural knowledge

Mixed Memory-Augmented Generation (MMAG, 2025) combines a sliding-window conversational log with episodic and semantic retrieval layers, using similarity, recency, and explicit weighting to arbitrate what enters the context window. MemLoRA (2025) distills memory extraction/update logic into low-rank adapters for low-latency local deployment.

**Strengths**
- Enables effectively infinite conversational context across sessions
- Empirically validated: memory-augmented LLaMA 3 8B outperforms baselines on long-term coherence benchmarks (CCS: 0.65 → 0.74)
- Supports privacy-preserving local deployment with MemLoRA
- More cognitively aligned than pure RAG — active curation vs. passive retrieval

**Weaknesses**
- Complex operational overhead (memory read/write operations add latency)
- Memory consistency across sessions is hard to maintain (stale or contradictory memories)
- Requires stateful infrastructure — not compatible with stateless serverless architectures
- Risk of "memory poisoning" if incorrect information persists

**Ideal Use Cases**
- Long-running personal assistants retaining user preferences and history
- Multi-session clinical support tools maintaining patient context
- Enterprise agents managing ongoing projects across weeks of interactions

---

### 3.5 Prompt Compression (LLMLingua / LLMLingua-2)

**How It Works**

Prompt compression uses a smaller, fast LLM to compress verbose input prompts before they reach the primary generation model. LLMLingua-2 operates in a question-independent mode: it removes low-information tokens from context (stop words, redundant phrasing, low-entropy spans) to produce a compressed version that retains the semantic payload. Compression ratios of 4–20× are typical. The compressed prompt is then passed to the primary LLM as normal.

**Strengths**
- Application-layer technique — no changes to inference infrastructure
- Reduces cost and latency proportionally to compression ratio
- Works with any hosted LLM API (GPT-4, Claude, etc.)
- Question-independent mode allows pre-compression of fixed context for reuse

**Weaknesses**
- Compression is lossy — precise numerical values, formatting, and rare terminology may be dropped
- Compressor model adds its own latency and cost
- Does not help with documents larger than the compressor's own context
- Not suitable for domains where exact wording is legally or medically significant

**Ideal Use Cases**
- Reducing costs in high-volume chatbot applications with verbose system prompts
- Preprocessing user-submitted documents before injection (summaries, support tickets)
- Cost optimization in multi-turn agentic pipelines

---

## 4. Domain Deep-Dives <a name="domain-deep-dives"></a>

### 4.1 Legal

The legal domain is characterized by: dense inter-document reference networks (cases citing cases), extreme precision requirements (exact clause wording matters), large document volumes (discovery corpora, statute databases), and strict provenance requirements.

**Best-fit strategies:**

| Strategy | Fit | Rationale |
|---|---|---|
| GraphRAG | ⭐⭐⭐⭐⭐ | Excels at mapping case law networks and statute cross-references |
| Agentic RAG | ⭐⭐⭐⭐ | Multi-hop reasoning over citation chains; self-corrects when clauses conflict |
| RAPTOR | ⭐⭐⭐⭐ | Hierarchical tree maps cleanly to legal document structure (act → section → clause) |
| HyDE | ⭐⭐⭐ | Bridges gap between lay-English queries and legal terminology in the corpus |
| KV Cache Compression | ⭐⭐ | Useful for long brief analysis but risks dropping exact clause text |
| Prompt Compression | ⭐ | Dangerous — exact wording has legal significance; lossy compression is a liability |

**Key considerations:** A hybrid retrieval setup (BM25 + dense + graph traversal) plus reranking yielded 42% accuracy improvement over baseline RAG in a documented UAE legal SaaS deployment.

---

### 4.2 Medical / Biomedical

The medical domain requires: high factual accuracy (errors have patient safety implications), currency of knowledge (treatment guidelines update frequently), complex multi-concept reasoning (drug interactions, comorbidities), and multi-modal data (images, lab values, notes).

A 2025 scoping review of 67 RAG studies in the medical domain found the breakdown: text-based RAG (54%), knowledge graph–enhanced RAG (25%), agentic RAG (9%), multimodal RAG (3%), and plug-and-play RAG (9%).

**Best-fit strategies:**

| Strategy | Fit | Rationale |
|---|---|---|
| Knowledge Graph RAG (GraphRAG variant) | ⭐⭐⭐⭐⭐ | Captures drug-disease-symptom relationships; dominant in research literature |
| Agentic / Self-RAG | ⭐⭐⭐⭐ | Enables multi-step clinical reasoning; self-correction reduces hallucination risk |
| RAPTOR | ⭐⭐⭐⭐ | Hierarchical access to clinical guidelines (summary → specific protocol) |
| MemoRAG | ⭐⭐⭐ | Handles fuzzy clinical queries ("what are the latest recommendations for X?") |
| Memory-Augmented | ⭐⭐⭐ | Longitudinal patient context across multi-session clinical dialogues |
| Prompt Compression | ⭐ | High risk of dropping critical clinical values; avoid in diagnostic applications |

**Key considerations:** Medical RAG requires fine-tuned embedding models that understand clinical terminology (e.g., trained on MIMIC, PubMed). Multi-stage verification against approved medical databases is mandatory. Clear citation trails for all generated responses are non-negotiable for clinical use.

---

### 4.3 Enterprise / Finance / Code

These domains share: large structured + unstructured document mixes (PDFs, spreadsheets, code files), evolving data (prices, regulations, code changes), and the need for auditability.

**Best-fit strategies by sub-domain:**

| Sub-domain | Top Strategy | Reason |
|---|---|---|
| Financial compliance | Naive/Hybrid RAG + reranking | SEC filings, compliance PDFs — well-structured, moderate cross-reference needs |
| Code repositories | Full context injection | With 1M+ token windows, injecting entire repos is increasingly viable |
| Enterprise knowledge | MemoRAG + Memory-Augmented | Handles mixed structured/unstructured; persists context across sessions |
| Real-time analytics | Agentic RAG | Interleaves live data retrieval with LLM reasoning |
| High-volume chatbots | Prompt Compression + Naive RAG | Cost optimization at scale |

---

## 5. Comparative Summary Table <a name="comparative-summary"></a>

| Technique | Type | Complexity | Latency | Cost | Best For | Avoid When |
|---|---|---|---|---|---|---|
| Naive RAG | RAG | Low | Low | Low | Simple Q&A, prototyping | Multi-hop, relational queries |
| GraphRAG | RAG | Very High | Medium | Very High | Relational corpora, legal, research | Frequently updating corpora |
| RAPTOR | RAG | High | Medium | High | Hierarchical docs, long contracts | Structured/tabular corpora |
| HyDE | RAG | Low | Medium | Medium | Query-corpus vocab gap | Narrow/specialized corpora |
| MemoRAG | RAG | High | Medium | High | Global + local mixed queries | Real-time / low-latency apps |
| Agentic / Self-RAG | RAG | Very High | High | Very High | Multi-hop, complex reasoning | Simple factual Q&A |
| Full Context Injection | Non-RAG | Low | High | Very High | Deep cross-doc reasoning | Large corpora, cost-sensitive |
| KV Cache Compression | Non-RAG | Medium | Low | Low | Memory-constrained inference | Tasks needing all tokens |
| Sliding Window Attention | Non-RAG | Medium | Very Low | Very Low | Streaming, chat, real-time | Long-range dependency tasks |
| Memory-Augmented | Non-RAG | High | Medium | Medium | Multi-session agents | Stateless architectures |
| Prompt Compression | Non-RAG | Low | Low | Low | Verbose prompts, cost reduction | Legally/medically precise docs |

---

## 6. README Quick Reference <a name="readme-quick-reference"></a>

```
# Long-Context LLM Management — Quick Reference

## RAG-Based Techniques

### 1. Naive / Baseline RAG
   Mechanism : Embed docs → vector store → top-k retrieval → inject into prompt
   Best for  : Simple Q&A, knowledge base chatbots, prototyping
   Avoid     : Multi-hop reasoning, relational corpora
   Tooling   : LangChain, LlamaIndex, Haystack

### 2. GraphRAG (Microsoft)
   Mechanism : Entity/relation extraction → knowledge graph → community summaries
   Best for  : Legal (case law networks), research (citation graphs), dense wikis
   Avoid     : High-churn corpora (expensive re-indexing)
   Tooling   : Microsoft GraphRAG (OSS), LightRAG, Neo4j + LangChain

### 3. RAPTOR
   Mechanism : Cluster chunks → LLM summarize → recurse up tree → multi-level retrieval
   Best for  : Long contracts, clinical guidelines, policy documents
   Avoid     : Tabular/structured data, frequently updated corpora
   Tooling   : LlamaIndex RAPTOR integration, custom implementation

### 4. HyDE (Hypothetical Document Embeddings)
   Mechanism : Generate hypothetical answer → embed it → use as retrieval vector
   Best for  : Query-corpus vocabulary mismatch, research assistants
   Avoid     : Real-time apps, narrow specialized corpora
   Tooling   : LangChain HyDE retriever, custom prompt → embed → search

### 5. MemoRAG
   Mechanism : Lightweight LLM builds global memory tokens → clue generation → targeted retrieval
   Best for  : Mixed global/local queries, fuzzy information needs
   Avoid     : Low-latency, cost-sensitive applications
   Tooling   : MemoRAG GitHub (BGEM3 + LLM)

### 6. Agentic / Self-RAG / Q-RAG
   Mechanism : LLM agent decides when/what to retrieve, with self-reflection tokens
   Best for  : Multi-hop legal/medical reasoning, complex analytics
   Avoid     : Simple Q&A, determinism-required applications
   Tooling   : LangGraph, AutoGen, Q-RAG (RL-fine-tuned embedder)

---

## Non-RAG Techniques

### 7. Full Context Window Injection
   Mechanism : Load all docs directly into model's context window
   Best for  : Deep cross-doc reasoning, code repos, moderate-size corpora
   Avoid     : Large corpora, cost-sensitive or high-volume applications
   Models    : Gemini 1.5 Pro (1M tokens), Llama 4 (10M tokens), Claude 3.5

### 8. KV Cache Compression
   Mechanism : Evict/merge/quantize KV cache pairs to reduce memory footprint
   Best for  : Memory-constrained inference, edge deployment, high-throughput serving
   Avoid     : Tasks requiring all input tokens; question-independent modes risk dropping key facts
   Tools     : RocketKV (ICML 2025), H2O, SnapKV, ChunkKV, KIVI

### 9. Sliding Window Attention
   Mechanism : Restrict token attention to local fixed-size window (linear complexity)
   Best for  : Real-time streaming, conversational agents, latency-critical serving
   Avoid     : Long-range dependency tasks, needle-in-haystack retrieval
   Notes     : Used in Mistral, Llama variants; SWAA (2025) improves adaptation for pretrained models

### 10. Memory-Augmented Architectures
    Mechanism : Multi-tier memory (working / episodic / long-term) with active curation
    Best for  : Multi-session agents, longitudinal clinical tools, personal assistants
    Avoid     : Stateless serverless architectures
    Tools     : MemGPT, MMAG, MemLoRA (lightweight local deployment)

### 11. Prompt Compression (LLMLingua / LLMLingua-2)
    Mechanism : Small LLM removes low-entropy tokens from prompt before primary model
    Best for  : Cost reduction on verbose prompts, high-volume chatbots
    Avoid     : Legal/medical documents where exact wording matters
    Tools     : LLMLingua-2 (Microsoft), LLMZip

---

## Decision Framework

Start with:
  [Cost is the primary constraint]  → Prompt Compression + Naive RAG
  [Simple Q&A, structured docs]     → Hybrid RAG (BM25 + dense) + reranking
  [Multi-hop reasoning needed]      → Agentic RAG or GraphRAG
  [Hierarchical documents]          → RAPTOR
  [Entire corpus fits in window]    → Full Context Injection
  [Multi-session / stateful agent]  → Memory-Augmented + RAG hybrid
  [GPU memory is the bottleneck]    → KV Cache Compression
  [Streaming / real-time]           → Sliding Window Attention

Domain shortcuts:
  Legal     → GraphRAG + Agentic RAG + HyDE
  Medical   → Knowledge Graph RAG + Agentic RAG + Memory-Augmented
  Finance   → Hybrid RAG + Prompt Compression (for cost)
  Code      → Full Context Injection (Gemini/Llama 4) or Agentic RAG
  Chatbots  → Sliding Window + Memory-Augmented + Prompt Compression
```

---

*Document generated May 2026. Sources include: MemoRAG (arXiv 2409.05591), RAPTOR, GraphRAG (Microsoft OSS), Q-RAG (arXiv 2511.07328), SWAA (arXiv 2512.10411), RocketKV (ICML 2025), ChunkKV (NeurIPS 2025), MMAG/MemLoRA (Dec 2025), scoping reviews from NCBI (2025) and arXiv biomedical RAG survey (2505.01146), and RAG vs LC LLM comparative analysis (Medium, Jan 2026).*