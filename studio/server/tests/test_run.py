"""Live single-question run over SSE (dummy approach + fake client → zero spend)."""
from __future__ import annotations

from .conftest import parse_sse

DOCS = {"documents": [{"doc_id": "alpha", "text": "Veridian was founded in 1991."}]}
SECRET = "AIzaSY-TEST-SECRET-KEY-do-not-leak-123"


def _session(client):
    return client.post("/session", json=DOCS).json()["session_id"]


def test_run_requires_key(client):
    sid = _session(client)
    r = client.post("/run", json={"session_id": sid, "question": "When?", "approaches": ["naive"]})
    assert r.status_code == 401
    assert r.json()["detail"]["code"] == "missing_key"


def test_run_streams_events(client, patched_service):
    sid = _session(client)
    r = client.post(
        "/run",
        json={"session_id": sid, "question": "When founded?", "approaches": ["naive", "rerank"]},
        headers={"X-Gemini-Key": SECRET},
    )
    assert r.status_code == 200
    events = parse_sse(r.text)
    kinds = [e["event"] for e in events]
    assert kinds[0] == "run_start"
    assert kinds[-1] == "done"
    assert kinds.count("approach_start") == 2
    done = [e for e in events if e["event"] == "approach_done"]
    assert len(done) == 2
    assert all(e["answer"] for e in done)
    assert all("cost_usd" in e for e in done)
    # retrieved-chunk inspector payload present
    assert all(isinstance(e["retrieved"], list) for e in done)


def test_run_unknown_session(client, patched_service):
    r = client.post(
        "/run",
        json={"session_id": "nope", "question": "x", "approaches": ["naive"]},
        headers={"X-Gemini-Key": SECRET},
    )
    assert r.status_code == 404


def test_run_unknown_approach_rejected(client, patched_service):
    sid = _session(client)
    r = client.post(
        "/run",
        json={"session_id": sid, "question": "x", "approaches": ["telepathy"]},
        headers={"X-Gemini-Key": SECRET},
    )
    assert r.status_code == 422
