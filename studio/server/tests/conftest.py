"""Shared test fixtures.

Tests run with a dummy Approach and a fake LLM client, so there are NO model
downloads and NO API spend. The two injectable seams in service.py
(get_approach_class, make_client) are monkeypatched, OpenRouter's model list is
forced offline, the server key is unset, and saved results go to a temp dir.
"""
from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

from ragureap.approaches.base import AnswerWithTrace, TraceStep

from studio.server.app import models_catalog, results_store, service
from studio.server.app.main import app
from studio.server.app.openrouter import LLMResponse

KEY_HEADER = "X-OpenRouter-Key"

# Records every DummyApproach.setup() call, so tests can check instance reuse.
SETUP_CALLS: list[str] = []


class FakeClient:
    """Stand-in for OpenRouterClient: deterministic, free, no network."""

    def __init__(self, answer: str = "a fabricated short answer"):
        self.answer = answer
        self.stats = {"llm_calls": 0, "reasoning_tokens": 0, "truncation_retries": 0}

    def generate(self, prompt: str) -> LLMResponse:
        self.stats["llm_calls"] += 1
        self.stats["reasoning_tokens"] += 3
        return LLMResponse(
            text=self.answer,
            tokens_in=12,
            tokens_out=4,
            cost_usd=0.00002,
            latency_ms=1.5,
            model="fake/model",
            reasoning_tokens=3,
        )


def make_dummy(name: str):
    """Build a lightweight Approach subclass (no embeddings, no reranker)."""

    class DummyApproach:
        def __init__(self):
            self.name = name
            self.llm = None

        def setup(self, chunks, full_text, config):
            SETUP_CALLS.append(name)
            self._n_chunks = len(chunks)

        def attach_llm(self, llm):
            self.llm = llm

        def answer(self, question: str, qid: str) -> AnswerWithTrace:
            # Vary the answer per approach so win/loss + pairwise have signal.
            text = f"answer from {name}"
            resp = self.llm.generate(question)
            step = TraceStep(
                step="generate",
                input=question,
                output=text,
                tokens_in=resp.tokens_in,
                tokens_out=resp.tokens_out,
                latency_ms=resp.latency_ms,
                cost_usd=resp.cost_usd,
                meta={"chunk_ids": ["000_doc_01:0"], "scores": [0.9]},
            )
            return AnswerWithTrace(qid=qid, question=question, answer=text, trace=[step])

    return DummyApproach


@pytest.fixture(autouse=True)
def isolated_environment(monkeypatch, tmp_path):
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)

    def offline(*args, **kwargs):
        raise OSError("OpenRouter is not reachable in tests")

    monkeypatch.setattr(models_catalog, "_fetch_remote", offline)
    monkeypatch.setitem(models_catalog._remote, "index", None)
    monkeypatch.setitem(models_catalog._remote, "at", 0.0)
    monkeypatch.setitem(models_catalog._remote, "failed_at", 0.0)
    monkeypatch.setattr(results_store, "RESULTS_DIR", tmp_path / "results")
    SETUP_CALLS.clear()


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def patched_service(monkeypatch):
    """Patch the LLM + approach seams so runs are free and fast."""
    monkeypatch.setattr(service, "make_client", lambda *a, **k: FakeClient())
    monkeypatch.setattr(service, "get_approach_class", lambda name: make_dummy(name))
    return service


def parse_sse(text: str) -> list[dict]:
    """Parse an SSE response body into a list of event dicts (with `event` key)."""
    events = []
    cur_event = None
    for line in text.splitlines():
        if line.startswith("event:"):
            cur_event = line[len("event:"):].strip()
        elif line.startswith("data:"):
            payload = json.loads(line[len("data:"):].strip())
            payload["event"] = cur_event or payload.get("event", "message")
            events.append(payload)
    return events
