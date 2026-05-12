"""Common types for retrieval indexes."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol, runtime_checkable

from ..data.chunk import Chunk


@dataclass(frozen=True)
class SearchHit:
    """One result from an Index.search call."""

    chunk_id: str
    score: float
    text: str

    def __repr__(self) -> str:
        preview = self.text[:60] + ("…" if len(self.text) > 60 else "")
        return f"SearchHit({self.chunk_id}, score={self.score:.4f}, text={preview!r})"


@runtime_checkable
class Index(Protocol):
    """Anything you can `build` once and `search` against."""

    def build(self, chunks: list[Chunk]) -> None: ...
    def search(self, query: str, k: int) -> list[SearchHit]: ...
