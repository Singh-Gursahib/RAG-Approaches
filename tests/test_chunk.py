"""Unit tests for the sentence-window chunker."""
from __future__ import annotations

import pytest

from ragureap.data.chunk import Chunk, chunk_document, split_sentences


def test_split_sentences_basic() -> None:
    text = "First sentence. Second sentence! Third sentence?"
    assert split_sentences(text) == ["First sentence.", "Second sentence!", "Third sentence?"]


def test_split_sentences_handles_empty() -> None:
    assert split_sentences("") == []
    assert split_sentences("   ") == []


def test_chunk_document_emits_chunks() -> None:
    text = " ".join(f"Sentence number {i} contains some words." for i in range(40))
    chunks = chunk_document("doc1", text, target_tokens=50, overlap_tokens=10)
    assert chunks, "expected at least one chunk"
    assert all(isinstance(c, Chunk) for c in chunks)
    for i, c in enumerate(chunks):
        assert c.chunk_id == f"doc1:{i}"
        assert c.doc_id == "doc1"
        assert c.idx == i
        assert c.text
        assert c.n_tokens > 0


def test_chunk_document_overlap_present() -> None:
    text = " ".join(f"Sentence number {i} contains some filler words." for i in range(40))
    chunks = chunk_document("doc1", text, target_tokens=50, overlap_tokens=15)
    # Adjacent chunks should share at least one sentence (overlap by design).
    assert len(chunks) >= 2
    for prev, nxt in zip(chunks, chunks[1:]):
        prev_sents = set(split_sentences(prev.text))
        nxt_sents = set(split_sentences(nxt.text))
        assert prev_sents & nxt_sents, "adjacent chunks should share at least one sentence"


def test_chunk_document_single_short_doc() -> None:
    text = "Short doc."
    chunks = chunk_document("d", text, target_tokens=150, overlap_tokens=30)
    assert len(chunks) == 1
    assert chunks[0].text == "Short doc."


def test_chunk_document_target_tokens_validated() -> None:
    with pytest.raises(ValueError):
        chunk_document("d", "x.", target_tokens=0)


def test_chunk_document_overlap_validated() -> None:
    with pytest.raises(ValueError):
        chunk_document("d", "x.", target_tokens=10, overlap_tokens=10)


def test_chunk_corpus_round_trip() -> None:
    """Loading the real corpus and chunking it should produce a sensible number of chunks."""
    from pathlib import Path

    from ragureap.data.corpus import chunk_corpus, load_corpus

    corpus_dir = Path(__file__).resolve().parents[1] / "data" / "eval_corpus"
    docs = load_corpus(corpus_dir)
    assert len(docs) >= 3
    chunks = chunk_corpus(docs, target_tokens=150, overlap_tokens=30)
    # Heuristic: total chunks should be at least 20 for our ~6K-word corpus.
    assert len(chunks) >= 20
    # Every chunk has a valid id.
    for c in chunks:
        assert ":" in c.chunk_id
        assert c.n_tokens > 0
