"""Eval harness: grading, CIs, repeats, significance, win-loss, saved results (zero spend)."""
from __future__ import annotations

from .conftest import KEY_HEADER, SETUP_CALLS, parse_sse

SECRET = "sk-or-v1-TEST-KEY-eval-000"
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
        headers={KEY_HEADER: SECRET},
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
        for field in ("em", "f1", "em_lo", "em_hi", "f1_lo", "f1_hi", "cost_usd", "p50_ms", "n_seeds"):
            assert field in row
        assert row["n_seeds"] == 1 and row["f1_seed_std"] == 0.0
    # per-question record with both approaches' predictions, and the question text
    assert len(results["questions"]) == len(QUESTIONS)
    assert set(results["questions"][0]["predictions"].keys()) == {"naive", "rerank"}
    assert results["questions"][0]["question_text"] == "Year founded?"
    # pairwise significance + win matrix present
    assert "naive" in results["pairwise_f1"] and "rerank" in results["pairwise_f1"]["naive"]
    assert results["win_matrix"]["naive"]["rerank"]["n"] == len(QUESTIONS)


def test_eval_repeats_aggregate_like_the_paper(client, patched_service):
    sid = _session(client)
    r = client.post(
        "/eval",
        json={
            "session_id": sid,
            "questions": QUESTIONS,
            "approaches": ["naive", "recursive_summary"],
            "repeats": 2,
            "llm": {"model": "z-ai/glm-5.3-flash", "temperature": 0.3},
        },
        headers={KEY_HEADER: SECRET},
    )
    events = parse_sse(r.text)
    assert sum(e["event"] == "question_done" for e in events) == 2 * 2 * len(QUESTIONS)

    results = events[-1]["results"]
    for row in results["headline"]:
        assert row["n_seeds"] == 2
        assert row["n"] == 2 * len(QUESTIONS)
        assert row["llm_calls"] == len(QUESTIONS)  # mean calls per run
    assert results["win_matrix"]["naive"]["recursive_summary"]["n"] == 2 * len(QUESTIONS)
    assert len(results["questions"][0]["predictions"]["naive"]["preds"]) == 2
    # recursive_summary caches summaries, so every repeat builds a fresh instance;
    # naive's index is built once and reused.
    assert SETUP_CALLS.count("recursive_summary") == 2
    assert SETUP_CALLS.count("naive") == 1


def test_eval_result_is_saved_and_loads_back_exactly(client, patched_service):
    sid = _session(client)
    r = client.post(
        "/eval",
        json={"session_id": sid, "questions": QUESTIONS, "approaches": ["naive"], "label": "my test"},
        headers={KEY_HEADER: SECRET},
    )
    done = parse_sse(r.text)[-1]
    result_id = done["saved_result_id"]
    assert result_id

    listing = client.get("/results").json()["results"]
    assert [item["id"] for item in listing] == [result_id]
    assert listing[0]["label"] == "my test"

    saved = client.get(f"/results/{result_id}").json()
    assert saved["results"] == done["results"]
    assert saved["config"]["attribution_headers_sent"] is False
    assert saved["dataset"]["questions"][1]["gold_answer"] == "MULBERRY-7Q"


def test_results_rejects_unknown_or_invalid_ids(client):
    assert client.get("/results/does-not-exist").status_code == 404
    assert client.get("/results/.hidden").status_code == 404


def test_eval_key_not_leaked(client, patched_service):
    sid = _session(client)
    r = client.post(
        "/eval",
        json={"session_id": sid, "questions": QUESTIONS, "approaches": ["naive"]},
        headers={KEY_HEADER: SECRET},
    )
    assert SECRET not in r.text
    result_id = parse_sse(r.text)[-1]["saved_result_id"]
    assert SECRET not in client.get(f"/results/{result_id}").text
