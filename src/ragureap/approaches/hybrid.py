"""Hybrid RAG: BM25 + Dense retrieval fused via Reciprocal Rank Fusion.

Each retriever returns top-N candidates; RRF combines them; the fused top-k
becomes the LLM context. Identical answer-generation prompt as `naive` so
retrieval is the only experimental variable.
"""
from __future__ import annotations

import time
from typing import Any

from ..data.chunk import Chunk
from ..indexing.bm25_store import BM25Store
from ..indexing.chroma_store import ChromaStore
from ..indexing.fusion import rrf
from ..llm.embedding import Embedder
from ..llm.gemini import GeminiClient
from ._prompts import ANSWER_PROMPT, format_context
from .base import AnswerWithTrace, TraceStep


class HybridRAG:
    name = "hybrid"

    def __init__(self):
        self.vec: ChromaStore | None = None
        self.bm25: BM25Store | None = None
        self.llm: GeminiClient | None = None
        self.top_n = 10
        self.top_k = 5

    def setup(self, chunks: list[Chunk], full_text: str, config: dict[str, Any]) -> None:
        ret = config.get("retrieval", {})
        self.top_n = int(ret.get("top_n_for_rerank", ret.get("top_n", 10)))
        self.top_k = int(ret.get("top_k", 5))
        embedder = Embedder(
            model_name=config.get("embedding", {}).get("model")
            or "sentence-transformers/all-MiniLM-L6-v2"
        )
        self.vec = ChromaStore(embedder=embedder)
        self.vec.build(chunks)
        self.bm25 = BM25Store()
        self.bm25.build(chunks)

    def attach_llm(self, llm: GeminiClient) -> None:
        self.llm = llm

    def answer(self, question: str, qid: str) -> AnswerWithTrace:
        assert self.vec is not None and self.bm25 is not None
        assert self.llm is not None

        # --- dense retrieval ---
        t0 = time.perf_counter()
        dense_hits = self.vec.search(question, k=self.top_n)
        dense_ms = (time.perf_counter() - t0) * 1000.0

        # --- lexical retrieval ---
        t1 = time.perf_counter()
        lex_hits = self.bm25.search(question, k=self.top_n)
        lex_ms = (time.perf_counter() - t1) * 1000.0

        # --- fuse ---
        t2 = time.perf_counter()
        fused = rrf([dense_hits, lex_hits], top_k=self.top_k)
        fuse_ms = (time.perf_counter() - t2) * 1000.0

        retrieve_step = TraceStep(
            step="retrieve_hybrid",
            input=question,
            output=", ".join(h.chunk_id for h in fused),
            latency_ms=dense_ms + lex_ms + fuse_ms,
            meta={
                "top_n": self.top_n,
                "top_k": self.top_k,
                "dense_ids": [h.chunk_id for h in dense_hits],
                "lex_ids": [h.chunk_id for h in lex_hits],
                "fused_ids": [h.chunk_id for h in fused],
                "fused_scores": [h.score for h in fused],
            },
        )

        # --- generate ---
        prompt = ANSWER_PROMPT.format(context=format_context(fused), question=question)
        resp = self.llm.generate(prompt)
        generate_step = TraceStep(
            step="generate",
            input=prompt,
            output=resp.text,
            tokens_in=resp.tokens_in,
            tokens_out=resp.tokens_out,
            latency_ms=resp.latency_ms,
            cost_usd=resp.cost_usd,
            meta={"model": resp.model},
        )

        return AnswerWithTrace(
            qid=qid, question=question, answer=resp.text, trace=[retrieve_step, generate_step]
        )
