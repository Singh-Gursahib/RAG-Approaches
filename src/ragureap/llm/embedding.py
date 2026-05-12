"""Lazy-loaded sentence-transformers embedding wrapper.

The first call to `encode` downloads the model on first use (~80 MB) and caches
it locally; subsequent calls are fast and CPU-friendly.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    import numpy as np


_MODEL_CACHE: dict[str, "SentenceTransformerLike"] = {}


class SentenceTransformerLike:  # pragma: no cover - duck-typing placeholder
    def encode(self, sentences, **kwargs): ...


@dataclass
class Embedder:
    """Stateful embedder. Holds a single sentence-transformers model in memory."""

    model_name: str = "sentence-transformers/all-MiniLM-L6-v2"
    _model: object | None = None

    def _load(self) -> object:
        if self.model_name in _MODEL_CACHE:
            self._model = _MODEL_CACHE[self.model_name]
            return self._model
        from sentence_transformers import SentenceTransformer

        model = SentenceTransformer(self.model_name)
        _MODEL_CACHE[self.model_name] = model  # type: ignore[assignment]
        self._model = model
        return model

    def encode(self, texts: list[str]) -> "np.ndarray":
        """Embed a batch of texts; returns a (N, D) float32 numpy array."""
        model = self._model if self._model is not None else self._load()
        return model.encode(texts, convert_to_numpy=True, show_progress_bar=False)  # type: ignore[attr-defined]

    def encode_one(self, text: str) -> "np.ndarray":
        return self.encode([text])[0]

    @property
    def dim(self) -> int:
        """Embedding dimensionality (loads model on first access)."""
        # Probe with a tiny input to determine dim — cheaper than introspecting the model.
        return int(self.encode_one("probe").shape[0])
