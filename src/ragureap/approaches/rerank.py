"""Cross-Encoder Reranker RAG: dense top-N → bge-reranker → top-k → generate."""
from __future__ import annotations

import time
from typing import Any

from ..data.chunk import Chunk
from ..indexing.chroma_store import ChromaStore
from ..indexing.reranker import Reranker
from ..llm.embedding import Embedder
from ..llm.gemini import GeminiClient
from ._prompts import ANSWER_PROMPT, format_context
from .base import AnswerWithTrace, TraceStep


class RerankRAG:
    name = "rerank"

    def __init__(self):
        self.vec: ChromaStore | None = None
        self.reranker: Reranker | None = None
        self.llm: GeminiClient | None = None
        self.top_n = 20
        self.top_k = 5

    def setup(self, chunks: list[Chunk], full_text: str, config: dict[str, Any]) -> None:
        ret = config.get("retrieval", {})
        self.top_n = int(ret.get("top_n_for_rerank", 20))
        self.top_k = int(ret.get("top_k", 5))
        embedder = Embedder(
            model_name=config.get("embedding", {}).get("model")
            or "sentence-transformers/all-MiniLM-L6-v2"
        )
        self.vec = ChromaStore(embedder=embedder)
        self.vec.build(chunks)
        self.reranker = Reranker(
            model_name=config.get("reranker", {}).get("model") or "BAAI/bge-reranker-base"
        )

    def attach_llm(self, llm: GeminiClient) -> None:
        self.llm = llm

    def answer(self, question: str, qid: str) -> AnswerWithTrace:
        assert self.vec is not None and self.reranker is not None and self.llm is not None

        # --- candidate retrieval ---
        t0 = time.perf_counter()
        candidates = self.vec.search(question, k=self.top_n)
        retrieve_ms = (time.perf_counter() - t0) * 1000.0

        # --- rerank ---
        t1 = time.perf_counter()
        top_hits = self.reranker.rerank(question, candidates, top_k=self.top_k)
        rerank_ms = (time.perf_counter() - t1) * 1000.0

        retrieve_step = TraceStep(
            step="retrieve_then_rerank",
            input=question,
            output=", ".join(h.chunk_id for h in top_hits),
            latency_ms=retrieve_ms + rerank_ms,
            meta={
                "top_n": self.top_n,
                "top_k": self.top_k,
                "candidate_ids": [c.chunk_id for c in candidates],
                "reranked_ids": [h.chunk_id for h in top_hits],
                "reranked_scores": [h.score for h in top_hits],
            },
        )

        # --- generate ---
        prompt = ANSWER_PROMPT.format(context=format_context(top_hits), question=question)
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
