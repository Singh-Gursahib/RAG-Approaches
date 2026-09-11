"""Live single-question run over SSE (dummy approach + fake client, zero spend)."""
from __future__ import annotations

from .conftest import KEY_HEADER, parse_sse

DOCS = {"documents": [{"doc_id": "alpha", "text": "Veridian was founded in 1991."}]}
SECRET = "sk-or-v1-TEST-SECRET-KEY-do-not-leak-123"


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
        headers={KEY_HEADER: SECRET},
    )
    assert r.status_code == 200
    # Compressing proxies must not buffer live progress events.
    assert "no-transform" in r.headers["cache-control"]
    events = parse_sse(r.text)
    kinds = [e["event"] for e in events]
    assert kinds[0] == "run_start"
    assert kinds[-1] == "done"
    assert kinds.count("approach_start") == 2
    done = [e for e in events if e["event"] == "approach_done"]
    assert len(done) == 2
    assert all(e["answer"] for e in done)
    assert all("cost_usd" in e and "reasoning_tokens" in e for e in done)
    # retrieved-chunk inspector payload present
    assert all(isinstance(e["retrieved"], list) for e in done)


def test_run_uses_selected_model(client, patched_service):
    sid = _session(client)
    r = client.post(
        "/run",
        json={
            "session_id": sid,
            "question": "When?",
            "approaches": ["naive"],
            "llm": {"model": "z-ai/glm-5.3-flash", "reasoning": "lowest"},
        },
        headers={KEY_HEADER: SECRET},
    )
    start = parse_sse(r.text)[0]
    assert start["model"] == "z-ai/glm-5.3-flash"


def test_run_rejects_malformed_model_slug(client, patched_service):
    sid = _session(client)
    r = client.post(
        "/run",
        json={"session_id": sid, "question": "x", "approaches": ["naive"], "llm": {"model": "not a slug"}},
        headers={KEY_HEADER: SECRET},
    )
    assert r.status_code == 422


def test_run_unknown_session(client, patched_service):
    r = client.post(
        "/run",
        json={"session_id": "nope", "question": "x", "approaches": ["naive"]},
        headers={KEY_HEADER: SECRET},
    )
    assert r.status_code == 404


def test_run_unknown_approach_rejected(client, patched_service):
    sid = _session(client)
    r = client.post(
        "/run",
        json={"session_id": sid, "question": "x", "approaches": ["telepathy"]},
        headers={KEY_HEADER: SECRET},
    )
    assert r.status_code == 422
