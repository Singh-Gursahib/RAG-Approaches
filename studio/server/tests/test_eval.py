"""Eval harness: grading, CIs, pairwise significance, win-loss (dummy → zero spend)."""
from __future__ import annotations

from .conftest import parse_sse

SECRET = "AIzaSY-TEST-KEY-eval-000"
DOCS = {"documents": [{"doc_id": "a", "text": "Veridian was founded in 1991. The token is MULBERRY-7Q."}]}
QUESTIONS = [
    {"id": "q1", "type": "sanity", "question": "Year founded?", "gold_answer": "1991"},
    {"id": "q2", "type": "needle", "question": "Token?", "gold_answer": "MULBERRY-7Q"},
    {"id": "q3", "type": "hallucination", "question": "CEO salary?", "gold_answer": "NOT_IN_CONTEXT"},
]


def _session(client):
    return client.post("/session", json=DOCS).json()["session_id"]


def test_eval_requires_key(client):
    sid = _session(client)
    r = client.post("/eval", json={"session_id": sid, "questions": QUESTIONS, "approaches": ["naive"]})
    assert r.status_code == 401


def test_eval_full_results_shape(client, patched_service):
    sid = _session(client)
    r = client.post(
        "/eval",
        json={"session_id": sid, "questions": QUESTIONS, "approaches": ["naive", "rerank"]},
        headers={"X-Gemini-Key": SECRET},
    )
    assert r.status_code == 200
    events = parse_sse(r.text)
    kinds = [e["event"] for e in events]
    assert kinds[0] == "eval_start"
    assert kinds[-1] == "eval_done"
    assert kinds.count("question_done") == 2 * len(QUESTIONS)

    results = events[-1]["results"]
    assert set(results["approaches"]) == {"naive", "rerank"}
    assert len(results["headline"]) == 2
    for row in results["headline"]:
        for field in ("em", "f1", "em_lo", "em_hi", "f1_lo", "f1_hi", "cost_usd", "p50_ms"):
            assert field in row
    # per-question record with both approaches' predictions
    assert len(results["questions"]) == len(QUESTIONS)
    assert set(results["questions"][0]["predictions"].keys()) == {"naive", "rerank"}
    # pairwise significance + win matrix present and symmetric in keys
    assert "naive" in results["pairwise_f1"] and "rerank" in results["pairwise_f1"]["naive"]
    assert results["win_matrix"]["naive"]["rerank"]["n"] == len(QUESTIONS)


def test_eval_key_not_leaked(client, patched_service):
    sid = _session(client)
    r = client.post(
        "/eval",
        json={"session_id": sid, "questions": QUESTIONS, "approaches": ["naive"]},
        headers={"X-Gemini-Key": SECRET},
    )
    assert SECRET not in r.text
