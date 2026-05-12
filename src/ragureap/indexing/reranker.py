"""Cross-encoder reranker wrapper around `bge-reranker-base`.

Used by the `rerank` approach (and optionally by `hybrid`) to re-score a
top-N candidate set against the query and return the top-k.
"""
from __future__ import annotations

from .base import SearchHit


_RERANKER_CACHE: dict[str, object] = {}


class Reranker:
    """Lazy-loaded cross-encoder. Singleton model cache per process."""

    def __init__(self, model_name: str = "BAAI/bge-reranker-base"):
        self.model_name = model_name
        self._model = None

    def _ensure_model(self):
        if self._model is not None:
            return self._model
        if self.model_name in _RERANKER_CACHE:
            self._model = _RERANKER_CACHE[self.model_name]
            return self._model
        from sentence_transformers import CrossEncoder

        model = CrossEncoder(self.model_name)
        _RERANKER_CACHE[self.model_name] = model
        self._model = model
        return model

    def rerank(self, query: str, candidates: list[SearchHit], top_k: int) -> list[SearchHit]:
        """Score (query, chunk.text) pairs with the cross-encoder, return top-k."""
        if not candidates:
            return []
        model = self._ensure_model()
        pairs = [(query, c.text) for c in candidates]
        scores = model.predict(pairs).tolist()
        scored = sorted(zip(scores, candidates), key=lambda x: -x[0])[:top_k]
        return [SearchHit(chunk_id=c.chunk_id, score=float(s), text=c.text) for s, c in scored]
