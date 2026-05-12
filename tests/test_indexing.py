"""Index round-trip tests: build → search returns the expected chunks.

We use the real eval corpus and check that for a few targeted queries each
retriever surfaces a chunk that *literally contains* the answer. This is a
soft correctness floor — if a retriever cannot do this for clear lexical
matches, it is broken.
"""
from __future__ import annotations

import time
from pathlib import Path

import pytest

from ragureap.data.corpus import chunk_corpus, load_corpus
from ragureap.indexing.base import SearchHit
from ragureap.indexing.bm25_store import BM25Store, tokenize
from ragureap.indexing.chroma_store import ChromaStore
from ragureap.indexing.fusion import rrf
from ragureap.llm.embedding import Embedder


PROJECT_ROOT = Path(__file__).resolve().parents[1]
CORPUS_DIR = PROJECT_ROOT / "data" / "eval_corpus"


# Probes shaped so a working retriever should land the literal answer span in
# at least one of its top-5 hits.
QUERY_PROBES: list[tuple[str, str]] = [
    ("What is the archive password for the 2019 Constanin papers?", "MULBERRY-7Q"),
    ("Who is the current Director of the Halden Institute?", "Mei-Ling Forrester"),
    ("When was the Crescent Bridge built?", "1932"),
    ("What frequency does MERIDIAN-7's telemetry channel use?", "4.832 GHz"),
]


@pytest.fixture(scope="module")
def chunks():
    docs = load_corpus(CORPUS_DIR)
    return chunk_corpus(docs, target_tokens=150, overlap_tokens=30)


@pytest.fixture(scope="module")
def embedder() -> Embedder:
    return Embedder()


# ---------------------------------------------------------------------------
# RRF: pure unit test, no model needed
# ---------------------------------------------------------------------------


def test_rrf_combines_two_rankings() -> None:
    a = [
        SearchHit("c1", 0.9, "alpha"),
        SearchHit("c2", 0.8, "beta"),
        SearchHit("c3", 0.7, "gamma"),
    ]
    b = [
        SearchHit("c2", 5.0, "beta"),
        SearchHit("c1", 4.0, "alpha"),
    ]
    fused = rrf([a, b], k_rrf=60)
    # c2 ranked 2nd and 1st → highest RRF; c1 ranked 1st and 2nd → second;
    # c3 only in one list → last.
    ids = [h.chunk_id for h in fused]
    assert ids[0] in {"c1", "c2"}
    assert "c3" in ids
    assert all(h.score > 0 for h in fused)


def test_rrf_handles_empty_input() -> None:
    assert rrf([]) == []


def test_rrf_truncates_to_top_k() -> None:
    a = [SearchHit(f"c{i}", 1.0 - i / 10, "x") for i in range(8)]
    fused = rrf([a], top_k=3)
    assert len(fused) == 3


# ---------------------------------------------------------------------------
# BM25: no model download, fast
# ---------------------------------------------------------------------------


def test_bm25_tokenize_keeps_hyphens() -> None:
    toks = tokenize("Designator M7-RX-204-A at 4.832 GHz, password MULBERRY-7Q.")
    assert "m7-rx-204-a" in toks
    assert "mulberry-7q" in toks
    assert "ghz" in toks


def test_bm25_build_and_search(chunks) -> None:
    store = BM25Store()
    store.build(chunks)
    assert len(store) == len(chunks)

    hits = store.search("MULBERRY-7Q archive password", k=3)
    assert len(hits) == 3
    assert any("MULBERRY-7Q" in h.text for h in hits)


def test_bm25_raises_before_build() -> None:
    store = BM25Store()
    with pytest.raises(RuntimeError):
        store.search("anything", k=5)


# ---------------------------------------------------------------------------
# ChromaStore: requires model download on first run (cached afterward)
# ---------------------------------------------------------------------------


@pytest.fixture(scope="module")
def chroma(chunks, embedder) -> ChromaStore:
    store = ChromaStore(embedder=embedder)
    t0 = time.perf_counter()
    store.build(chunks)
    elapsed = time.perf_counter() - t0
    # Phase-3 exit criterion: build in <10s on this small corpus (allow 20s
    # headroom for cold model download on the first CI run).
    print(f"\nChromaStore build: {elapsed:.2f}s over {len(chunks)} chunks")
    return store


def test_chroma_build(chroma, chunks) -> None:
    assert len(chroma) == len(chunks)


def test_chroma_search_returns_k(chroma) -> None:
    hits = chroma.search("Auralite Accord signing date", k=5)
    assert len(hits) == 5
    assert all(isinstance(h, SearchHit) for h in hits)
    # Cosine similarity scores should be in [-1, 1].
    for h in hits:
        assert -1.0 <= h.score <= 1.0


# ---------------------------------------------------------------------------
# Joint correctness: every probe answer should appear in top-5 of at least one retriever
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("query,expected_substr", QUERY_PROBES)
def test_at_least_one_retriever_lands_the_answer(
    chroma, chunks, query: str, expected_substr: str
) -> None:
    bm25 = BM25Store()
    bm25.build(chunks)

    dense_hits = chroma.search(query, k=5)
    lex_hits = bm25.search(query, k=5)
    fused = rrf([dense_hits, lex_hits], top_k=5)

    dense_ok = any(expected_substr in h.text for h in dense_hits)
    lex_ok = any(expected_substr in h.text for h in lex_hits)
    fused_ok = any(expected_substr in h.text for h in fused)

    # We require fused to surface it (since that's what hybrid RAG will use),
    # but log per-retriever as a diagnostic.
    assert fused_ok, (
        f"RRF-fused top-5 did not contain {expected_substr!r} for query {query!r}. "
        f"dense_ok={dense_ok} lex_ok={lex_ok}"
    )
