"""End-to-end smoke tests for each approach.

These build the index and call .answer() on a single question. The LLM call
itself is mocked so no API spend is incurred during pytest.
"""
from __future__ import annotations

import types
from pathlib import Path
from unittest.mock import patch

import pytest

from ragureap.approaches.full_context import FullContextInjection
from ragureap.approaches.hybrid import HybridRAG
from ragureap.approaches.hyde import HyDERAG
from ragureap.approaches.naive import NaiveRAG
from ragureap.approaches.recursive_summary import RecursiveSummarization
from ragureap.approaches.rerank import RerankRAG
from ragureap.approaches.sliding_window import SlidingWindowReasoning
from ragureap.data.corpus import chunk_corpus, load_corpus
from ragureap.indexing.base import SearchHit
from ragureap.llm.gemini import GeminiResponse


PROJECT_ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="module")
def chunks_and_text():
    docs = load_corpus(PROJECT_ROOT / "data" / "eval_corpus")
    chunks = chunk_corpus(docs, target_tokens=150, overlap_tokens=30)
    full_text = "\n\n".join(d.text for d in docs)
    return chunks, full_text


CONFIG = {
    "embedding": {"model": "sentence-transformers/all-MiniLM-L6-v2"},
    "retrieval": {"top_k": 5, "top_n_for_rerank": 20},
    "reranker": {"model": "BAAI/bge-reranker-base"},
    "paths": {"eval_corpus": str(PROJECT_ROOT / "data" / "eval_corpus")},
    "sliding_window": {"window_unit": "document"},
}


class FakeLLM:
    """Stand-in for GeminiClient — returns canned responses, no network."""

    def __init__(self, canned: list[str]):
        self.canned = list(canned)
        self.calls = 0

    def generate(self, prompt: str) -> GeminiResponse:
        text = self.canned[self.calls] if self.calls < len(self.canned) else "STUB"
        self.calls += 1
        return GeminiResponse(
            text=text,
            tokens_in=len(prompt) // 4,
            tokens_out=len(text) // 4,
            cost_usd=0.0,
            latency_ms=1.0,
            model="fake",
        )


def test_naive_e2e(chunks_and_text) -> None:
    chunks, full_text = chunks_and_text
    approach = NaiveRAG()
    approach.setup(chunks, full_text, CONFIG)
    approach.attach_llm(FakeLLM(["1991"]))
    aw = approach.answer("In what year was the Halden Institute founded?", "sanity-01")
    assert aw.answer == "1991"
    assert len(aw.trace) == 2  # retrieve + generate
    assert aw.trace[0].step == "retrieve"
    assert aw.trace[1].step == "generate"


def test_hybrid_e2e(chunks_and_text) -> None:
    chunks, full_text = chunks_and_text
    approach = HybridRAG()
    approach.setup(chunks, full_text, CONFIG)
    approach.attach_llm(FakeLLM(["Quentin Aldermann"]))
    aw = approach.answer("Who is the mayor of Veridian?", "sanity-02")
    assert aw.answer == "Quentin Aldermann"
    assert aw.trace[0].step == "retrieve_hybrid"
    # Fused set should be top_k=5 results.
    assert len(aw.trace[0].meta["fused_ids"]) == 5


def test_hyde_e2e(chunks_and_text) -> None:
    chunks, full_text = chunks_and_text
    approach = HyDERAG()
    approach.setup(chunks, full_text, CONFIG)
    # Two LLM calls: first the rewrite, then the answer.
    approach.attach_llm(FakeLLM(["The Crescent Bridge was built in 1932 over the Saren.", "1932"]))
    aw = approach.answer("When was the Crescent Bridge built?", "dist-06")
    assert aw.answer == "1932"
    assert [s.step for s in aw.trace] == ["hyde_rewrite", "retrieve_via_hypothetical", "generate"]


def test_rerank_e2e(chunks_and_text) -> None:
    chunks, full_text = chunks_and_text
    approach = RerankRAG()
    approach.setup(chunks, full_text, CONFIG)
    approach.attach_llm(FakeLLM(["MULBERRY-7Q"]))
    aw = approach.answer(
        "What is the archive password for the 2019 Constanin papers?", "needle-01"
    )
    assert aw.answer == "MULBERRY-7Q"
    assert aw.trace[0].step == "retrieve_then_rerank"
    assert len(aw.trace[0].meta["reranked_ids"]) == 5


def test_full_context_e2e(chunks_and_text) -> None:
    chunks, full_text = chunks_and_text
    approach = FullContextInjection()
    approach.setup(chunks, full_text, CONFIG)
    approach.attach_llm(FakeLLM(["1991"]))
    aw = approach.answer("When was the Halden Institute founded?", "sanity-01")
    assert aw.answer == "1991"
    assert len(aw.trace) == 1
    assert aw.trace[0].step == "generate_full_context"
    # Context should be the entire corpus (much larger than a single chunk).
    assert aw.trace[0].meta["context_chars"] > 10000


def test_recursive_summary_e2e(chunks_and_text) -> None:
    chunks, full_text = chunks_and_text
    approach = RecursiveSummarization()
    approach.setup(chunks, full_text, CONFIG)
    # 4 setup summary calls + 1 answer call for the first question.
    canned = [f"Summary {i}" for i in range(4)] + ["1991"]
    approach.attach_llm(FakeLLM(canned))
    aw = approach.answer("When was the Halden Institute founded?", "sanity-01")
    assert aw.answer == "1991"
    # First answer carries the amortized setup step.
    steps = [s.step for s in aw.trace]
    assert "summarize_corpus_amortized" in steps
    assert "generate_over_summaries" in steps


def test_sliding_window_e2e(chunks_and_text) -> None:
    chunks, full_text = chunks_and_text
    approach = SlidingWindowReasoning()
    approach.setup(chunks, full_text, CONFIG)
    # 4 windows (default = one per document). Final state is the answer.
    approach.attach_llm(FakeLLM(["NOT_IN_CONTEXT", "1991", "1991", "1991"]))
    aw = approach.answer("When was the Halden Institute founded?", "sanity-01")
    assert aw.answer == "1991"
    assert len(aw.trace) == 4  # one step per window
    assert aw.trace[0].step.startswith("window_1_of_")
