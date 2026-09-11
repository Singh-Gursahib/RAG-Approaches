"""The key must never leak; the server key is an opt-in fallback; key checks stay anonymous."""
from __future__ import annotations

from studio.server.app.deps import redact
from studio.server.app.routers import keys as keys_router
from .conftest import KEY_HEADER, parse_sse

SECRET = "sk-or-v1-SUPER-SECRET-abcdef1234567890"
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
        headers={KEY_HEADER: SECRET},
    )
    assert SECRET not in r.text
    assert "approach_done" in [e["event"] for e in parse_sse(r.text)]


def test_server_key_fallback(client, patched_service, monkeypatch):
    assert client.get("/health").json()["server_key_configured"] is False
    monkeypatch.setenv("OPENROUTER_API_KEY", SECRET)
    health = client.get("/health")
    assert health.json()["server_key_configured"] is True
    assert SECRET not in health.text

    sid = client.post("/session", json=DOCS).json()["session_id"]
    r = client.post("/run", json={"session_id": sid, "question": "When?", "approaches": ["naive"]})
    assert r.status_code == 200
    assert SECRET not in r.text


def test_key_check_hides_identifying_fields(client, monkeypatch):
    seen = {}

    def fake_fetch(api_key):
        seen["key"] = api_key
        return {"label": "sk-or-v1-abc...xyz", "creator_user_id": "user_abc", "usage": 1.25, "is_free_tier": False, "limit_remaining": None}

    monkeypatch.setattr(keys_router, "fetch_key_info", fake_fetch)
    r = client.post("/key/check", headers={KEY_HEADER: SECRET})
    body = r.json()
    assert body == {"ok": True, "source": "browser", "is_free_tier": False, "limit_remaining": None, "usage_usd": 1.25}
    assert seen["key"] == SECRET
    assert "creator_user_id" not in r.text and "label" not in body


def test_health_has_no_key(client):
    assert SECRET not in client.get("/health").text
