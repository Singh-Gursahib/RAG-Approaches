"""Eval-set loader. Reads tests/eval_set.jsonl and validates the schema."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field


ProbeType = Literal["needle", "multi_hop", "distractor", "hallucination", "sanity"]


class EvalQuestion(BaseModel):
    id: str = Field(..., description="Stable question identifier.")
    type: ProbeType
    question: str
    gold_answer: str = Field(
        ...,
        description=(
            "Authoritative short answer. For hallucination probes, this is a "
            "canonical refusal phrase the grader looks for substrings of."
        ),
    )
    source_doc: str | None = Field(
        default=None,
        description="Document where the answer lives (None for hallucination probes).",
    )
    source_span: str | None = Field(
        default=None,
        description="Verbatim grep-able span from the corpus that contains the gold fact.",
    )
    notes: str | None = None


def load_eval_set(path: str | Path) -> list[EvalQuestion]:
    """Load + validate eval_set.jsonl."""
    path = Path(path)
    if not path.is_file():
        raise FileNotFoundError(f"Eval set not found: {path}")

    questions: list[EvalQuestion] = []
    seen_ids: set[str] = set()
    for line_no, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        raw = raw.strip()
        if not raw or raw.startswith("//") or raw.startswith("#"):
            continue
        try:
            obj = json.loads(raw)
        except json.JSONDecodeError as e:
            raise ValueError(f"{path}:{line_no}: invalid JSON — {e}") from e
        q = EvalQuestion.model_validate(obj)
        if q.id in seen_ids:
            raise ValueError(f"{path}:{line_no}: duplicate id {q.id!r}")
        seen_ids.add(q.id)
        questions.append(q)

    return questions


def summarize(questions: list[EvalQuestion]) -> dict[str, int]:
    """Count questions by probe type."""
    counts: dict[str, int] = {}
    for q in questions:
        counts[q.type] = counts.get(q.type, 0) + 1
    counts["total"] = len(questions)
    return counts
