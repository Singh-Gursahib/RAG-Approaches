# Literature review for the IEEE paper

This file captures the citations we ground the IEEE draft in, along with a one- to two-sentence note on why each one matters and how it is used in our paper. Bibtex entries live in `references.bib`.

## Core RAG family

### [1] Lewis et al., NeurIPS 2020 — Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks
- Original RAG paper. Combined parametric memory (seq2seq) with non-parametric memory (Wikipedia dense index via DPR).
- Why we cite: introduces the RAG framework our four RAG variants belong to.
- arXiv: 2005.11401

### [2] Gao et al., ACL 2023 — Precise Zero-Shot Dense Retrieval without Relevance Labels (HyDE)
- HyDE: generate a hypothetical answer first, embed THAT, retrieve nearest documents.
- Why we cite: foundation for our `hyde` approach.
- arXiv: 2212.10496

### [3] Asai et al., ICLR 2024 — Self-RAG: Learning to Retrieve, Generate, and Critique through Self-Reflection
- LM trained with reflection tokens; retrieves on demand.
- Why we cite: example of a more sophisticated RAG variant we deferred from this study.
- arXiv: 2310.11511

### [4] Edge et al., 2024 — From Local to Global: A Graph RAG Approach to Query-Focused Summarization
- Microsoft GraphRAG. Builds an entity graph plus community summaries.
- Why we cite: example of structured RAG; cited in related work + future work.
- arXiv: 2404.16130

### [5] Sarthi et al., ICLR 2024 — RAPTOR: Recursive Abstractive Processing for Tree-Organized Retrieval
- Recursive clustering + summarization tree over the corpus, retrieved at inference.
- Why we cite: example of hierarchical RAG; deferred future work.
- arXiv: 2401.18059

## Foundations of retrieval

### [6] Robertson & Zaragoza, Foundations and Trends in IR 2009 — The Probabilistic Relevance Framework: BM25 and Beyond
- Definitive reference for BM25.
- Why we cite: BM25 is the lexical leg of our `hybrid` approach.

### [7] Karpukhin et al., EMNLP 2020 — Dense Passage Retrieval for Open-Domain Question Answering (DPR)
- Foundational dense-vector retriever using a BERT-style dual encoder.
- Why we cite: ancestor of every modern dense retriever in this study.
- arXiv: 2004.04906

### [8] Cormack et al., SIGIR 2009 — Reciprocal Rank Fusion Outperforms Condorcet and Individual Rank Learning Methods
- Defines RRF and the $\frac{1}{k + r}$ scoring rule, k=60 by convention.
- Why we cite: directly the fusion method our `hybrid` uses to combine BM25 and dense rankings.

### [9] Reimers & Gurevych, EMNLP 2019 — Sentence-BERT: Sentence Embeddings using Siamese BERT-Networks
- Siamese fine-tuning of BERT for sentence embeddings; the foundation of `sentence-transformers`.
- Why we cite: our embedding model (`all-MiniLM-L6-v2`) is a sentence-transformers checkpoint.
- arXiv: 1908.10084

### [10] Khattab & Zaharia, SIGIR 2020 — ColBERT: Efficient and Effective Passage Search via Contextualized Late Interaction over BERT
- Late-interaction retriever; cross-encoder cousin.
- Why we cite: positioned as the academic forerunner of bge-reranker.
- arXiv: 2004.12832

### [11] Xiao et al., 2023 — C-Pack: Packaged Resources To Advance General Chinese Embedding (BGE family)
- BAAI BGE embedding + reranker family.
- Why we cite: our cross-encoder rerank approach uses `bge-reranker-base`.
- arXiv: 2309.07597

## Long-context evidence and behavior

### [12] Liu et al., TACL 2024 — Lost in the Middle: How Language Models Use Long Contexts
- Classic finding: LM accuracy is U-shaped over input position; mid-context drops sharply.
- Why we cite: motivates our finding that full-context still wins despite the "lost in the middle" effect — for our 8K corpus the effect is small.
- arXiv: 2307.03172

### [13] Vaswani et al., NeurIPS 2017 — Attention Is All You Need
- The Transformer architecture.
- Why we cite: standard reference whenever we mention attention or context windows.
- arXiv: 1706.03762

## Benchmarks and evaluation

### [14] Rajpurkar et al., EMNLP 2016 — SQuAD: 100,000+ Questions for Machine Comprehension of Text
- Source of the EM/F1 normalization we use.
- Why we cite: our `eval/metrics.py` follows SQuAD-style EM/F1.
- arXiv: 1606.05250

### [15] Yang et al., EMNLP 2018 — HotpotQA: A Dataset for Diverse, Explainable Multi-hop Question Answering
- Multi-hop QA dataset with supporting-fact annotations.
- Why we cite: inspiration for our multi-hop probe set design.
- arXiv: 1809.09600

## Statistical methods

### [16] Efron, Annals of Statistics 1979 — Bootstrap Methods: Another Look at the Jackknife
- Origin of the bootstrap.
- Why we cite: we use percentile-bootstrap 95% CIs throughout.

### [17] Wilcoxon, Biometrics Bulletin 1945 — Individual Comparisons by Ranking Methods
- The Wilcoxon signed-rank test.
- Why we cite: we use paired Wilcoxon for pairwise approach comparisons.

### [18] Holm, Scandinavian Journal of Statistics 1979 — A Simple Sequentially Rejective Multiple Test Procedure
- Holm-Bonferroni correction.
- Why we cite: multiple-comparison correction across all pairwise tests.

## Other / system

### [19] Devlin et al., NAACL 2019 — BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding
- Why we cite: ancestor of every model we use (SBERT, BGE, ColBERT, etc.).
- arXiv: 1810.04805

### [20] Gemini team, Google — Gemini family technical report (2024)
- Why we cite: the generator model used for all experiments.

### [21] Brown et al., NeurIPS 2020 — Language Models are Few-Shot Learners (GPT-3)
- Why we cite: contextual background for instruction-following generators.
- arXiv: 2005.14165

### [22] Touvron et al., 2023 — LLaMA: Open and Efficient Foundation Language Models
- Why we cite: representative open-weight long-context model family.
- arXiv: 2302.13971

## Key facts we lift into the paper

- RAG was introduced as a way to combine parametric and non-parametric memory in 2020 (Lewis et al., [1]).
- HyDE's central trick — generate a hypothetical answer, embed it, retrieve — was published in 2023 (Gao et al., [2]).
- "Lost in the middle" (Liu et al., 2024 [12]) reports U-shaped accuracy with respect to input position, motivating the question of whether full-context still wins.
- RRF $k = 60$ is the value Cormack et al. [8] showed empirically robust.
- Self-RAG, GraphRAG, RAPTOR ([3, 4, 5]) are examples of "advanced" RAG variants we deliberately deferred to keep the comparison tractable.
- SQuAD-style EM/F1 normalization (lowercase, strip punctuation and articles) is from Rajpurkar et al. [14].
- HotpotQA [15] inspired the multi-hop probe structure.
- Holm correction [18] keeps FWER bounded across our $\binom{7}{2}$ pairwise tests.
