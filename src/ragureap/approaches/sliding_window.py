"""Sliding-Window Reasoning.

Process the corpus in successive windows, maintaining a running "best answer"
state. Each window: the LLM sees the question, the current state, and the new
window, and outputs an updated state. After the last window, the state is the
answer.

For a small 4-document corpus, the natural window is one document. For a
chunk-level (~150 token) variant, set `window_unit: chunk` in the config — but
that quickly becomes expensive (one LLM call per chunk per question).
"""
from __future__ import annotations

import time
from typing import Any

from ..data.chunk import Chunk
from ..data.corpus import load_corpus
from ..llm.gemini import GeminiClient
from ._prompts import SLIDING_WINDOW_PROMPT
from .base import AnswerWithTrace, TraceStep


_INITIAL_STATE = "NOT_IN_CONTEXT"


class SlidingWindowReasoning:
    name = "sliding_window"

    def __init__(self):
        self.windows: list[tuple[str, str]] = []  # (label, text)
        self.llm: GeminiClient | None = None
        self.window_unit = "document"

    def setup(self, chunks: list[Chunk], full_text: str, config: dict[str, Any]) -> None:
        self.window_unit = config.get("sliding_window", {}).get("window_unit", "document")
        if self.window_unit == "document":
            corpus_dir = config.get("paths", {}).get("eval_corpus", "data/eval_corpus")
            docs = load_corpus(corpus_dir)
            self.windows = [(d.doc_id, d.text) for d in docs]
        elif self.window_unit == "chunk":
            self.windows = [(c.chunk_id, c.text) for c in chunks]
        else:
            raise ValueError(f"Unknown window_unit: {self.window_unit!r}")

    def attach_llm(self, llm: GeminiClient) -> None:
        self.llm = llm

    def answer(self, question: str, qid: str) -> AnswerWithTrace:
        assert self.llm is not None

        state = _INITIAL_STATE
        trace: list[TraceStep] = []

        for i, (label, text) in enumerate(self.windows):
            prompt = SLIDING_WINDOW_PROMPT.format(question=question, state=state, window=text)
            t0 = time.perf_counter()
            resp = self.llm.generate(prompt)
            elapsed_ms = (time.perf_counter() - t0) * 1000.0
            new_state = resp.text.strip() if resp.text else state
            trace.append(
                TraceStep(
                    step=f"window_{i + 1}_of_{len(self.windows)}",
                    input=prompt,
                    output=new_state,
                    tokens_in=resp.tokens_in,
                    tokens_out=resp.tokens_out,
                    latency_ms=elapsed_ms,
                    cost_usd=resp.cost_usd,
                    meta={
                        "window_unit": self.window_unit,
                        "window_label": label,
                        "prev_state": state,
                    },
                )
            )
            state = new_state

        return AnswerWithTrace(qid=qid, question=question, answer=state, trace=trace)
