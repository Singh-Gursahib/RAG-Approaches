"""Sentence-window chunker.

Splits documents into ~target_tokens-sized windows of complete sentences, with
configurable overlap. Token counting is approximate (whitespace-split words);
that's accurate enough for chunk sizing and avoids a tokenizer dependency here.
"""
from __future__ import annotations

import re
from dataclasses import dataclass


_SENT_SPLIT_RE = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9\"'(])")


@dataclass(frozen=True)
class Chunk:
    """A single retrieval unit."""

    chunk_id: str        # "doc_id:idx"
    doc_id: str
    idx: int             # ordinal within the document
    text: str
    n_tokens: int        # approximate word count


def _approx_tokens(text: str) -> int:
    return len(text.split())


def split_sentences(text: str) -> list[str]:
    """Split text into sentences using a simple regex.

    Good enough for our authored prose; replace with NLTK / spaCy if precision
    becomes a concern.
    """
    cleaned = text.strip()
    if not cleaned:
        return []
    parts = _SENT_SPLIT_RE.split(cleaned)
    return [p.strip() for p in parts if p.strip()]


def chunk_document(
    doc_id: str,
    text: str,
    target_tokens: int = 150,
    overlap_tokens: int = 30,
) -> list[Chunk]:
    """Pack sentences into windows close to `target_tokens` with `overlap_tokens` overlap.

    Algorithm:
      1. Split into sentences.
      2. Greedily grow a window until adding the next sentence would exceed target_tokens.
      3. Emit the window, then back up by `overlap_tokens` worth of trailing sentences
         to seed the next window.

    Args:
        doc_id: identifier for the source document (used in chunk_id).
        text: raw document text.
        target_tokens: approximate maximum tokens per chunk.
        overlap_tokens: minimum tokens of overlap between adjacent chunks.

    Returns:
        Ordered list of Chunk objects covering the document.
    """
    if target_tokens <= 0:
        raise ValueError("target_tokens must be positive")
    if overlap_tokens < 0 or overlap_tokens >= target_tokens:
        raise ValueError("overlap_tokens must be in [0, target_tokens)")

    sentences = split_sentences(text)
    if not sentences:
        return []

    sent_tokens = [_approx_tokens(s) for s in sentences]
    chunks: list[Chunk] = []
    i = 0
    idx = 0
    n = len(sentences)

    while i < n:
        # Grow window from i.
        j = i
        running = 0
        while j < n and (running + sent_tokens[j] <= target_tokens or j == i):
            running += sent_tokens[j]
            j += 1

        window_text = " ".join(sentences[i:j]).strip()
        chunks.append(
            Chunk(
                chunk_id=f"{doc_id}:{idx}",
                doc_id=doc_id,
                idx=idx,
                text=window_text,
                n_tokens=running,
            )
        )
        idx += 1

        if j >= n:
            break

        # Back up to create overlap.
        overlap_running = 0
        k = j
        while k > i + 1 and overlap_running < overlap_tokens:
            k -= 1
            overlap_running += sent_tokens[k]
        i = k

    return chunks
