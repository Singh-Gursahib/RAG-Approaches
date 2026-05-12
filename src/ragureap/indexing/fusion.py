"""Reciprocal Rank Fusion for combining ranked lists from heterogeneous retrievers."""
from __future__ import annotations

from .base import SearchHit


def rrf(
    rankings: list[list[SearchHit]],
    k_rrf: int = 60,
    top_k: int | None = None,
) -> list[SearchHit]:
    """Combine multiple ranked SearchHit lists via Reciprocal Rank Fusion.

    Args:
        rankings: each element is a ranked list of SearchHit from one retriever.
        k_rrf:    standard RRF smoothing constant (60 per Cormack et al., 2009).
        top_k:    if set, truncate the fused output to top_k.

    Returns:
        A single ranked list of SearchHit, fused score in `.score`. Original
        per-retriever scores are discarded; the returned `text` comes from the
        first retriever that ranked the chunk.
    """
    if not rankings:
        return []

    score_by_id: dict[str, float] = {}
    text_by_id: dict[str, str] = {}

    for ranking in rankings:
        for rank, hit in enumerate(ranking):
            score_by_id[hit.chunk_id] = score_by_id.get(hit.chunk_id, 0.0) + 1.0 / (
                k_rrf + rank + 1
            )
            text_by_id.setdefault(hit.chunk_id, hit.text)

    fused = sorted(
        (SearchHit(chunk_id=cid, score=score, text=text_by_id[cid]) for cid, score in score_by_id.items()),
        key=lambda h: -h.score,
    )
    if top_k is not None:
        fused = fused[:top_k]
    return fused
