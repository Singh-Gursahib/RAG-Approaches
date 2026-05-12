"""Recursive (map-reduce) Summarization.

Setup time (once, question-agnostic):
  For each document, generate a detail-preserving summary.
At answer time (per question):
  Combine all per-document summaries into the answer prompt.

Trade-off explored: summarization is question-independent, so it's
cheaper per query than full-context but at the cost of losing details that
the summarizer didn't preserve. Needle-style probes will reveal whether the
"detail-preserving" instruction actually preserves them.
"""
from __future__ import annotations

import time
from typing import Any

from ..data.chunk import Chunk
from ..data.corpus import load_corpus
from ..llm.gemini import GeminiClient
from ._prompts import ANSWER_PROMPT, SUMMARIZE_DOC_PROMPT
from .base import AnswerWithTrace, TraceStep


class RecursiveSummarization:
    name = "recursive_summary"

    def __init__(self):
        self.summaries: list[tuple[str, str]] = []  # (doc_id, summary)
        self.llm: GeminiClient | None = None
        self._setup_cost: float = 0.0
        self._setup_tokens_in: int = 0
        self._setup_tokens_out: int = 0
        self._setup_latency_ms: float = 0.0
        self._corpus_dir: str = ""

    def setup(self, chunks: list[Chunk], full_text: str, config: dict[str, Any]) -> None:
        # We pull the original documents (not chunks) so the summary preserves
        # document boundaries. The setup LLM calls run lazily once attach_llm
        # is called — see _ensure_summaries.
        self._corpus_dir = config.get("paths", {}).get("eval_corpus", "data/eval_corpus")

    def attach_llm(self, llm: GeminiClient) -> None:
        self.llm = llm

    def _ensure_summaries(self) -> None:
        if self.summaries:
            return
        assert self.llm is not None
        docs = load_corpus(self._corpus_dir)
        for d in docs:
            prompt = SUMMARIZE_DOC_PROMPT.format(document=d.text)
            t0 = time.perf_counter()
            resp = self.llm.generate(prompt)
            elapsed_ms = (time.perf_counter() - t0) * 1000.0
            self.summaries.append((d.doc_id, resp.text))
            self._setup_cost += resp.cost_usd
            self._setup_tokens_in += resp.tokens_in
            self._setup_tokens_out += resp.tokens_out
            self._setup_latency_ms += elapsed_ms

    def answer(self, question: str, qid: str) -> AnswerWithTrace:
        assert self.llm is not None
        self._ensure_summaries()

        # Build the context from the summaries.
        context_parts = [f"[Document: {doc_id}]\n{summary}" for doc_id, summary in self.summaries]
        context = "\n\n".join(context_parts)

        # The first question carries the amortized setup cost in its trace so
        # the run's totals are honest.
        trace: list[TraceStep] = []
        if self._setup_cost > 0 or self._setup_tokens_in > 0:
            trace.append(
                TraceStep(
                    step="summarize_corpus_amortized",
                    input=f"<{len(self.summaries)} documents>",
                    output=f"<{len(self.summaries)} detail-preserving summaries>",
                    tokens_in=self._setup_tokens_in,
                    tokens_out=self._setup_tokens_out,
                    latency_ms=self._setup_latency_ms,
                    cost_usd=self._setup_cost,
                    meta={"once_per_run": True, "doc_ids": [d for d, _ in self.summaries]},
                )
            )
            # Reset so subsequent questions don't double-count.
            self._setup_cost = 0.0
            self._setup_tokens_in = 0
            self._setup_tokens_out = 0
            self._setup_latency_ms = 0.0

        # --- generate answer ---
        prompt = ANSWER_PROMPT.format(context=context, question=question)
        resp = self.llm.generate(prompt)
        trace.append(
            TraceStep(
                step="generate_over_summaries",
                input=prompt,
                output=resp.text,
                tokens_in=resp.tokens_in,
                tokens_out=resp.tokens_out,
                latency_ms=resp.latency_ms,
                cost_usd=resp.cost_usd,
                meta={"model": resp.model},
            )
        )

        return AnswerWithTrace(qid=qid, question=question, answer=resp.text, trace=trace)
