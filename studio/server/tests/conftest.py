"""Shared test fixtures.

Tests run with a dummy Approach + a fake LLM client so there are NO model
downloads and NO API spend. The two injectable seams in service.py
(get_approach_class, make_client) are monkeypatched.
"""
from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

from ragureap.approaches.base import AnswerWithTrace, TraceStep
from ragureap.llm.gemini import GeminiResponse

from studio.server.app import service
from studio.server.app.main import app


class FakeClient:
    """Stand-in for GeminiClient — deterministic, free, no network."""

    def __init__(self, answer: str = "a fabricated short answer"):
        self.answer = answer

    def generate(self, prompt: str) -> GeminiResponse:
        return GeminiResponse(
            text=self.answer,
            tokens_in=12,
            tokens_out=4,
            cost_usd=0.00002,
            latency_ms=1.5,
            model="fake-model",
        )


def make_dummy(name: str):
    """Build a lightweight Approach subclass (no embeddings, no reranker)."""

    class DummyApproach:
        def __init__(self):
            self.name = name
            self.llm = None

        def setup(self, chunks, full_text, config):
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
