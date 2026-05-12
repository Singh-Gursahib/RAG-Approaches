"""Full-Context Injection: dump the entire corpus into the prompt verbatim.

The "fits in the window" upper bound. Tests whether retrieval is even
necessary at this corpus size. Cost scales linearly with corpus size — this
approach does not generalize to large corpora.
"""
from __future__ import annotations

from typing import Any

from ..data.chunk import Chunk
from ..llm.gemini import GeminiClient
from ._prompts import ANSWER_PROMPT
from .base import AnswerWithTrace, TraceStep


class FullContextInjection:
    name = "full_context"

    def __init__(self):
        self.full_text: str = ""
        self.llm: GeminiClient | None = None

    def setup(self, chunks: list[Chunk], full_text: str, config: dict[str, Any]) -> None:
        # We use `full_text` (the original concatenated corpus) rather than
        # `chunks` so the model sees the original prose, not chunked windows.
        self.full_text = full_text

    def attach_llm(self, llm: GeminiClient) -> None:
        self.llm = llm

    def answer(self, question: str, qid: str) -> AnswerWithTrace:
        assert self.llm is not None

        prompt = ANSWER_PROMPT.format(context=self.full_text, question=question)
        resp = self.llm.generate(prompt)
        generate_step = TraceStep(
            step="generate_full_context",
            input=prompt,
            output=resp.text,
            tokens_in=resp.tokens_in,
            tokens_out=resp.tokens_out,
            latency_ms=resp.latency_ms,
            cost_usd=resp.cost_usd,
            meta={"model": resp.model, "context_chars": len(self.full_text)},
        )
        return AnswerWithTrace(
            qid=qid, question=question, answer=resp.text, trace=[generate_step]
        )
