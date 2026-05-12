"""Metrics for the eval set.

EM and F1 follow the SQuAD-style normalization (lowercase, strip punctuation
and articles, collapse whitespace). Hallucination probes are graded against a
refusal-pattern detector instead of token overlap.
"""
from __future__ import annotations

import re
import string
from collections import Counter
from dataclasses import dataclass
from typing import Iterable


# Phrases that count as a valid refusal for hallucination probes.
REFUSAL_PATTERNS = (
    "not_in_context",
    "not in context",
    "not in the context",
    "not in the corpus",
    "no information",
    "no mention",
    "no answer",
    "i don't know",
    "i do not know",
    "cannot be determined",
    "cannot determine",
    "is not stated",
    "is not provided",
    "is not mentioned",
    "does not contain",
    "no relevant information",
    "insufficient information",
    "context does not",
    "unknown",
    "unable to answer",
)


def normalize_answer(s: str) -> str:
    """SQuAD-style normalization, plus hyphen/slash → space so identifiers like
    `MULBERRY-7Q` match `mulberry 7q` and vice versa."""
    s = s.lower()
    s = re.sub(r"[-/_]", " ", s)  # split identifier components into tokens
    s = re.sub(r"\b(a|an|the)\b", " ", s)
    s = "".join(ch for ch in s if ch not in string.punctuation)
    s = " ".join(s.split())
    return s


def exact_match(pred: str, gold: str) -> bool:
    return normalize_answer(pred) == normalize_answer(gold)


def token_f1(pred: str, gold: str) -> float:
    """Token-overlap F1 between prediction and gold (SQuAD style)."""
    pt = normalize_answer(pred).split()
    gt = normalize_answer(gold).split()
    if not pt and not gt:
        return 1.0
    if not pt or not gt:
        return 0.0
    common = Counter(pt) & Counter(gt)
    overlap = sum(common.values())
    if overlap == 0:
        return 0.0
    precision = overlap / len(pt)
    recall = overlap / len(gt)
    return 2 * precision * recall / (precision + recall)


def is_refusal(pred: str) -> bool:
    """Return True if the prediction reads as a 'don't know / not in context' refusal."""
    p = pred.lower().strip()
    if not p:
        return False
    # Reject if the prediction is suspiciously long (likely a real answer
    # that happens to contain a refusal phrase as a hedge).
    if len(p) > 200:
        return False
    return any(pattern in p for pattern in REFUSAL_PATTERNS)


def grade_hallucination(pred: str) -> bool:
    """For hallucination probes: correct iff the model refused."""
    return is_refusal(pred)


@dataclass
class QuestionGrade:
    qid: str
    type: str
    pred: str
    gold: str
    em: bool
    f1: float
    correct: bool        # type-aware: EM for normal questions, refusal for hallucination probes


def grade_one(qid: str, qtype: str, pred: str, gold: str) -> QuestionGrade:
    if qtype == "hallucination":
        correct = grade_hallucination(pred)
        # For reporting, EM and F1 are not meaningful on refusal; set to 0/correctness.
        return QuestionGrade(
            qid=qid, type=qtype, pred=pred, gold=gold, em=correct, f1=float(correct), correct=correct
        )
    em = exact_match(pred, gold)
    f1 = token_f1(pred, gold)
    # For non-hallucination questions, correctness == EM for the headline number,
    # but we also report F1 to capture partial credit.
    return QuestionGrade(qid=qid, type=qtype, pred=pred, gold=gold, em=em, f1=f1, correct=em)


def aggregate(grades: Iterable[QuestionGrade]) -> dict:
    """Aggregate per-question grades into a metrics dict.

    Returns a structure including overall EM/F1/accuracy and per-probe-type breakdowns.
    """
    grades = list(grades)
    by_type: dict[str, list[QuestionGrade]] = {}
    for g in grades:
        by_type.setdefault(g.type, []).append(g)

    def _avg(values: list[float]) -> float:
        return sum(values) / len(values) if values else 0.0

    overall = {
        "n": len(grades),
        "em": _avg([float(g.em) for g in grades]),
        "f1": _avg([g.f1 for g in grades]),
        "accuracy": _avg([float(g.correct) for g in grades]),
    }

    per_type = {}
    for t, gs in sorted(by_type.items()):
        per_type[t] = {
            "n": len(gs),
            "em": _avg([float(g.em) for g in gs]),
            "f1": _avg([g.f1 for g in gs]),
            "accuracy": _avg([float(g.correct) for g in gs]),
        }

    return {"overall": overall, "per_type": per_type}
