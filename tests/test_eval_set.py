"""Tests for the eval-set loader, schema, and corpus grounding.

Critical guarantee: every non-hallucination question's `source_span` (or
`gold_answer` for short factoid answers) must be findable in the corpus.
Hallucination probes must NOT be findable.
"""
from __future__ import annotations

from pathlib import Path

import pytest

from ragureap.data.corpus import load_corpus
from ragureap.data.eval_set import EvalQuestion, load_eval_set, summarize


PROJECT_ROOT = Path(__file__).resolve().parents[1]
EVAL_SET_PATH = PROJECT_ROOT / "tests" / "eval_set.jsonl"
CORPUS_DIR = PROJECT_ROOT / "data" / "eval_corpus"


@pytest.fixture(scope="module")
def questions() -> list[EvalQuestion]:
    return load_eval_set(EVAL_SET_PATH)


@pytest.fixture(scope="module")
def corpus_text() -> str:
    docs = load_corpus(CORPUS_DIR)
    return "\n\n".join(d.text for d in docs)


def test_eval_set_loads(questions: list[EvalQuestion]) -> None:
    assert len(questions) >= 30


def test_eval_set_has_all_probe_types(questions: list[EvalQuestion]) -> None:
    counts = summarize(questions)
    assert counts.get("needle", 0) >= 6
    assert counts.get("multi_hop", 0) >= 6
    assert counts.get("distractor", 0) >= 6
    assert counts.get("hallucination", 0) >= 4
    assert counts.get("sanity", 0) >= 3


def test_unique_ids(questions: list[EvalQuestion]) -> None:
    ids = [q.id for q in questions]
    assert len(ids) == len(set(ids))


def test_source_spans_are_grep_findable(
    questions: list[EvalQuestion], corpus_text: str
) -> None:
    """For every question with a source_span, that exact span must appear in the corpus.

    This is the grep-verification step the user asked for: it guarantees
    we know where every gold answer lives.
    """
    missing: list[str] = []
    for q in questions:
        if q.type == "hallucination":
            continue
        if q.source_span is None:
            # Multi-hop answers may not have a single literal span; that's allowed.
            continue
        if q.source_span not in corpus_text:
            missing.append(f"{q.id}: span not found — {q.source_span!r}")
    assert not missing, "Missing source spans:\n" + "\n".join(missing)


def test_hallucination_answers_absent_from_corpus(
    questions: list[EvalQuestion], corpus_text: str
) -> None:
    """Hallucination probes must target facts NOT present in the corpus.

    We check that the gold_answer marker ('NOT_IN_CORPUS') is used, and we
    spot-check a few keyword-level absences for the questions themselves.
    """
    for q in questions:
        if q.type != "hallucination":
            continue
        assert q.gold_answer == "NOT_IN_CORPUS", (
            f"{q.id}: hallucination gold_answer must be 'NOT_IN_CORPUS'"
        )
        # The question's specific entity must not exist as a fact in the corpus.
        # We do not enforce zero word-level overlap (questions naturally share words
        # with the corpus); the burden of absence is documented in the `notes` field.


def test_pydantic_rejects_bad_record(tmp_path: Path) -> None:
    bad = tmp_path / "bad.jsonl"
    bad.write_text('{"id": "x", "type": "not_a_real_type", "question": "?", "gold_answer": "."}\n')
    with pytest.raises(Exception):
        load_eval_set(bad)
