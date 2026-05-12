"""BM25 lexical retrieval over chunks, using rank_bm25.BM25Okapi.

Tokenization is a simple lowercase + alphanumeric split. Adequate for our
prose; swap in a smarter tokenizer if recall ever becomes a problem.
"""
from __future__ import annotations

import re

from ..data.chunk import Chunk
from .base import SearchHit


_TOKEN_RE = re.compile(r"[a-z0-9][a-z0-9\-_/]*")


def tokenize(text: str) -> list[str]:
    """Lowercase + alphanumeric tokenizer that keeps hyphenated identifiers."""
    return _TOKEN_RE.findall(text.lower())


class BM25Store:
    """In-memory BM25 over a chunk list."""

    def __init__(self):
        self._bm25 = None
        self._chunks: list[Chunk] = []
        self._tokenized: list[list[str]] = []

    def build(self, chunks: list[Chunk]) -> None:
        if not chunks:
            raise ValueError("Cannot build BM25Store over an empty chunk list.")
        from rank_bm25 import BM25Okapi

        self._chunks = list(chunks)
        self._tokenized = [tokenize(c.text) for c in self._chunks]
        self._bm25 = BM25Okapi(self._tokenized)

    def search(self, query: str, k: int) -> list[SearchHit]:
        if self._bm25 is None:
            raise RuntimeError("BM25Store.search called before build.")
        q_tokens = tokenize(query)
        scores = self._bm25.get_scores(q_tokens)
        # Argsort descending, take top-k.
        idxs = sorted(range(len(scores)), key=lambda i: -scores[i])[:k]
        hits: list[SearchHit] = []
        for i in idxs:
            c = self._chunks[i]
            hits.append(SearchHit(chunk_id=c.chunk_id, score=float(scores[i]), text=c.text))
        return hits

    def __len__(self) -> int:
        return len(self._chunks)
