"""HyDE (Hypothetical Document Embeddings): the model first writes a hypothetical
answer, that text is embedded, and the embedding drives dense retrieval. The
final answer-generation call uses the standard prompt over the retrieved chunks.

Costs ~2x naive in LLM calls (rewrite + answer) but often retrieves more
relevant chunks for questions where the question text alone is too short or
under-specified.
"""
from __future__ import annotations

import time
from typing import Any

from ..data.chunk import Chunk
from ..indexing.chroma_store import ChromaStore
from ..llm.embedding import Embedder
from ..llm.gemini import GeminiClient
from ._prompts import ANSWER_PROMPT, HYDE_REWRITE_PROMPT, format_context
from .base import AnswerWithTrace, TraceStep


class HyDERAG:
    name = "hyde"

    def __init__(self):
        self.vec: ChromaStore | None = None
        self.embedder: Embedder | None = None
        self.llm: GeminiClient | None = None
        self.top_k = 5

    def setup(self, chunks: list[Chunk], full_text: str, config: dict[str, Any]) -> None:
        self.top_k = int(config.get("retrieval", {}).get("top_k", 5))
        self.embedder = Embedder(
            model_name=config.get("embedding", {}).get("model")
            or "sentence-transformers/all-MiniLM-L6-v2"
        )
        self.vec = ChromaStore(embedder=self.embedder)
        self.vec.build(chunks)

    def attach_llm(self, llm: GeminiClient) -> None:
        self.llm = llm

    def answer(self, question: str, qid: str) -> AnswerWithTrace:
        assert self.vec is not None and self.embedder is not None and self.llm is not None

        # --- step 1: rewrite ---
        rewrite_prompt = HYDE_REWRITE_PROMPT.format(question=question)
        rewrite_resp = self.llm.generate(rewrite_prompt)
        hypothetical = rewrite_resp.text if rewrite_resp.text else question  # fallback
        rewrite_step = TraceStep(
            step="hyde_rewrite",
            input=rewrite_prompt,
            output=hypothetical,
            tokens_in=rewrite_resp.tokens_in,
            tokens_out=rewrite_resp.tokens_out,
            latency_ms=rewrite_resp.latency_ms,
            cost_usd=rewrite_resp.cost_usd,
            meta={"model": rewrite_resp.model},
        )

        # --- step 2: retrieve using hypothetical as the query ---
        t0 = time.perf_counter()
        hits = self.vec.search(hypothetical, k=self.top_k)
        retrieve_ms = (time.perf_counter() - t0) * 1000.0
        retrieve_step = TraceStep(
            step="retrieve_via_hypothetical",
            input=hypothetical,
            output=", ".join(h.chunk_id for h in hits),
            latency_ms=retrieve_ms,
            meta={
                "k": self.top_k,
                "chunk_ids": [h.chunk_id for h in hits],
                "scores": [h.score for h in hits],
            },
        )

        # --- step 3: answer using the original question + retrieved chunks ---
        answer_prompt = ANSWER_PROMPT.format(context=format_context(hits), question=question)
        answer_resp = self.llm.generate(answer_prompt)
        generate_step = TraceStep(
            step="generate",
            input=answer_prompt,
            output=answer_resp.text,
            tokens_in=answer_resp.tokens_in,
            tokens_out=answer_resp.tokens_out,
            latency_ms=answer_resp.latency_ms,
            cost_usd=answer_resp.cost_usd,
            meta={"model": answer_resp.model},
        )

        return AnswerWithTrace(
            qid=qid,
            question=question,
            answer=answer_resp.text,
            trace=[rewrite_step, retrieve_step, generate_step],
        )
