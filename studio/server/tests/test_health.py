"""Phase 1 smoke tests: the app boots and /health proves ragureap is wired."""
from __future__ import annotations

from fastapi.testclient import TestClient

from studio.server.app.main import app

client = TestClient(app)


def test_health_ok():
    resp = client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["service"] == "rag-atlas-api"
    assert "ragureap_version" in body
    assert body["model_default"]  # non-empty default model string


def test_health_imports_ragureap():
    """The whole point of Phase 1: the server can see the research package."""
    body = client.get("/health").json()
    assert body["ragureap_version"] != "not-installed"


def test_root_redirect_info():
    body = client.get("/").json()
    assert body["service"] == "rag-atlas-api"
