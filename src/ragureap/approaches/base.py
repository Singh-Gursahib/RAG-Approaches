"""Approach protocol + per-question answer-with-trace record.

Every approach (RAG or non-RAG) implements the same minimal interface:
    setup(chunks, full_text, config) -> None
    answer(question, qid) -> AnswerWithTrace
"""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any, Protocol, runtime_checkable

from ..data.chunk import Chunk


@dataclass(frozen=True)
class TraceStep:
    """One step in an approach's pipeline (a retrieval call, an LLM call, etc.)."""

    step: str           # "retrieve" | "rerank" | "generate" | "summarize" | ...
    input: str          # truncated by the runner if very large
    output: str
    tokens_in: int = 0
    tokens_out: int = 0
    latency_ms: float = 0.0
    cost_usd: float = 0.0
    meta: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        # Cap input/output preview so trace.jsonl doesn't balloon.
        for k in ("input", "output"):
            if isinstance(d[k], str) and len(d[k]) > 2000:
                d[k] = d[k][:2000] + "…[truncated]"
        return d


@dataclass(frozen=True)
class AnswerWithTrace:
    qid: str
    question: str
    answer: str
    trace: list[TraceStep]

    @property
    def total_cost_usd(self) -> float:
        return sum(s.cost_usd for s in self.trace)

    @property
    def total_latency_ms(self) -> float:
        return sum(s.latency_ms for s in self.trace)

    @property
    def total_tokens_in(self) -> int:
        return sum(s.tokens_in for s in self.trace)

    @property
    def total_tokens_out(self) -> int:
        return sum(s.tokens_out for s in self.trace)

    def to_prediction_row(self) -> dict[str, Any]:
        return {
            "qid": self.qid,
            "question": self.question,
            "prediction": self.answer,
            "cost_usd": self.total_cost_usd,
            "latency_ms": self.total_latency_ms,
            "tokens_in": self.total_tokens_in,
            "tokens_out": self.total_tokens_out,
        }


@runtime_checkable
class Approach(Protocol):
    """Approach interface. `name` is the short identifier (e.g., 'naive')."""

    name: str

    def setup(self, chunks: list[Chunk], full_text: str, config: dict[str, Any]) -> None: ...
    def answer(self, question: str, qid: str) -> AnswerWithTrace: ...
