"""Unit tests for eval/metrics.py — pinning EM, F1, refusal detection, and aggregation."""
from __future__ import annotations

import pytest

from ragureap.eval.metrics import (
    aggregate,
    exact_match,
    grade_hallucination,
    grade_one,
    is_refusal,
    normalize_answer,
    token_f1,
)


# ---- normalization & EM ----


def test_normalize_answer_strips_articles_punctuation_case() -> None:
    assert normalize_answer("The MULBERRY-7Q.") == "mulberry 7q"
    assert normalize_answer("  An apple,  ") == "apple"
    assert normalize_answer("A B C") == "b c"


def test_em_basic() -> None:
    # Hyphens are tokenized → these all match.
    assert exact_match("MULBERRY-7Q", "mulberry-7q") is True
    assert exact_match("Mulberry 7Q", "MULBERRY-7Q") is True
    assert exact_match("foo", "bar") is False


def test_em_ignores_articles_and_punctuation() -> None:
    assert exact_match("The Crescent Bridge", "Crescent Bridge.") is True
    assert exact_match("1932", "1932.") is True


# ---- token F1 ----


def test_f1_full_overlap() -> None:
    assert token_f1("Veridian Heights", "Veridian Heights") == pytest.approx(1.0)


def test_f1_partial_overlap() -> None:
    # Hyphens are tokenized: "Mei-Ling Forrester" → ["mei","ling","forrester"]
    f1 = token_f1("Mei-Ling Forrester", "Forrester")
    # pred 3 tokens, gold 1 token, overlap 1 → p=1/3, r=1, f1=0.5
    assert f1 == pytest.approx(0.5, abs=1e-6)


def test_f1_zero_overlap() -> None:
    assert token_f1("apple", "orange") == 0.0


def test_f1_both_empty_is_one() -> None:
    # Edge case: both blank after normalization → F1 of 1.0 by convention.
    assert token_f1("", "") == 1.0


# ---- refusal / hallucination ----


@pytest.mark.parametrize(
    "pred",
    [
        "NOT_IN_CONTEXT",
        "not in context",
        "I don't know.",
        "The context does not contain that information.",
        "Cannot be determined from the provided context.",
        "No mention of this in the corpus.",
        "Unknown.",
    ],
)
def test_refusal_recognized(pred: str) -> None:
    assert is_refusal(pred) is True


@pytest.mark.parametrize(
    "pred",
    [
        "Quentin Aldermann",
        "1991",
        "MULBERRY-7Q",
        "4.832 GHz",
        "The Halden Institute for Computational Mycology.",
    ],
)
def test_real_answers_not_refusal(pred: str) -> None:
    assert is_refusal(pred) is False


def test_grade_hallucination_correctness() -> None:
    assert grade_hallucination("NOT_IN_CONTEXT") is True
    assert grade_hallucination("Quentin Aldermann") is False


def test_grade_one_hallucination_uses_refusal() -> None:
    g = grade_one("halluc-x", "hallucination", "NOT_IN_CONTEXT", "NOT_IN_CORPUS")
    assert g.correct is True
    assert g.em is True
    assert g.f1 == 1.0


def test_grade_one_hallucination_fabrication_is_wrong() -> None:
    g = grade_one("halluc-x", "hallucination", "Mayor Joachim Telder", "NOT_IN_CORPUS")
    assert g.correct is False


def test_grade_one_factoid_em() -> None:
    g = grade_one("sanity-01", "sanity", "1991", "1991")
    assert g.em is True
    assert g.f1 == 1.0
    assert g.correct is True


def test_grade_one_factoid_partial() -> None:
    g = grade_one("dist-02", "distractor", "Mei-Ling Forrester", "Mei-Ling Forrester")
    assert g.em is True
    assert g.correct is True


# ---- aggregation ----


def test_aggregate_overall_and_per_type() -> None:
    g1 = grade_one("a", "sanity", "1991", "1991")              # correct
    g2 = grade_one("b", "needle", "MULBERRY-7Q", "MULBERRY-7Q")  # correct
    g3 = grade_one("c", "needle", "wrong", "0.46 ppm")          # wrong
    g4 = grade_one("d", "hallucination", "NOT_IN_CONTEXT", "NOT_IN_CORPUS")  # correct refusal
    g5 = grade_one("e", "hallucination", "Some made-up fact.", "NOT_IN_CORPUS")  # fabrication

    out = aggregate([g1, g2, g3, g4, g5])
    assert out["overall"]["n"] == 5
    assert out["overall"]["accuracy"] == pytest.approx(3 / 5)
    assert out["per_type"]["sanity"]["accuracy"] == 1.0
    assert out["per_type"]["needle"]["accuracy"] == 0.5
    assert out["per_type"]["hallucination"]["accuracy"] == 0.5
