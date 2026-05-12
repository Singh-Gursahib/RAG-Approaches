"""Naive Vector RAG: embed query → Chroma top-k → single LLM call.

The simplest possible RAG. Floor baseline that every other approach must beat.
"""
from __future__ import annotations

import time
from typing import Any

from ..data.chunk import Chunk
from ..indexing.chroma_store import ChromaStore
from ..llm.embedding import Embedder
from ..llm.gemini import GeminiClient
from ._prompts import ANSWER_PROMPT, format_context
from .base import AnswerWithTrace, TraceStep


class NaiveRAG:
    name = "naive"

    def __init__(self):
        self.store: ChromaStore | None = None
        self.llm: GeminiClient | None = None
        self.top_k = 5

    def setup(self, chunks: list[Chunk], full_text: str, config: dict[str, Any]) -> None:
        self.top_k = int(config.get("retrieval", {}).get("top_k", 5))
        embedder = Embedder(model_name=config.get("embedding", {}).get("model")
                            or "sentence-transformers/all-MiniLM-L6-v2")
        self.store = ChromaStore(embedder=embedder)
        self.store.build(chunks)
        # LLM client is created by the runner and injected via attach_llm() so
        # the runner controls the BudgetLedger lifecycle.

    def attach_llm(self, llm: GeminiClient) -> None:
        self.llm = llm

    def answer(self, question: str, qid: str) -> AnswerWithTrace:
        assert self.store is not None, "setup() must be called first"
        assert self.llm is not None, "attach_llm() must be called first"

        # --- retrieve ---
        t0 = time.perf_counter()
        hits = self.store.search(question, k=self.top_k)
        retrieve_ms = (time.perf_counter() - t0) * 1000.0
        context = format_context(hits)
        retrieve_step = TraceStep(
            step="retrieve",
            input=question,
            output=", ".join(h.chunk_id for h in hits),
            latency_ms=retrieve_ms,
            meta={
                "k": self.top_k,
                "chunk_ids": [h.chunk_id for h in hits],
                "scores": [h.score for h in hits],
            },
        )

        # --- generate ---
        prompt = ANSWER_PROMPT.format(context=context, question=question)
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
            qid=qid,
            question=question,
            answer=resp.text,
            trace=[retrieve_step, generate_step],
        )
