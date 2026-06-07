"""The BYO key must never leak into any response body, and redact() scrubs it."""
from __future__ import annotations

from studio.server.app.deps import redact
from .conftest import parse_sse

SECRET = "AIzaSY-SUPER-SECRET-abcdef1234567890"
DOCS = {"documents": [{"doc_id": "a", "text": "Founded in 1991."}]}


def test_redact_removes_secret():
    msg = f"upstream auth failed with key {SECRET} oops"
    out = redact(msg, SECRET)
    assert SECRET not in out
    assert "redacted" in out


def test_redact_noop_when_absent():
    assert redact("nothing secret here", SECRET) == "nothing secret here"
    assert redact("text", None) == "text"


def test_key_never_in_run_response(client, patched_service):
    sid = client.post("/session", json=DOCS).json()["session_id"]
    r = client.post(
        "/run",
        json={"session_id": sid, "question": "When?", "approaches": ["naive"]},
        headers={"X-Gemini-Key": SECRET},
    )
    assert SECRET not in r.text
    # sanity: we did get a real run back
    assert "approach_done" in [e["event"] for e in parse_sse(r.text)]


def test_health_has_no_key(client):
    assert SECRET not in client.get("/health").text
