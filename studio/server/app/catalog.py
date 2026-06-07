"""Canonical approach metadata, served to the frontend so labels/families never drift.

Mirrors src/ragureap/approaches/* and frontend/web/lib/colors.ts.
"""
from __future__ import annotations

APPROACH_CATALOG: list[dict] = [
    {
        "key": "naive",
        "label": "Naive RAG",
        "family": "RAG",
        "color": "#6b7280",
        "tagline": "Embed query → top-k → generate",
        "steps": ["retrieve", "generate"],
        "llm_calls_per_question": 1,
    },
    {
        "key": "hybrid",
        "label": "Hybrid RAG",
        "family": "RAG",
        "color": "#8b6f5e",
        "tagline": "BM25 + dense, fused via RRF",
        "steps": ["retrieve_hybrid", "generate"],
        "llm_calls_per_question": 1,
    },
    {
        "key": "hyde",
        "label": "HyDE",
        "family": "RAG",
        "color": "#b8761a",
        "tagline": "Hypothetical answer drives retrieval",
        "steps": ["hyde_rewrite", "retrieve_via_hypothetical", "generate"],
        "llm_calls_per_question": 2,
    },
    {
        "key": "rerank",
        "label": "Reranker",
        "family": "RAG",
        "color": "#2d6a4f",
        "tagline": "Dense top-20 → cross-encoder → top-5",
        "steps": ["retrieve_then_rerank", "generate"],
        "llm_calls_per_question": 1,
    },
    {
        "key": "full_context",
        "label": "Full-Context",
        "family": "non-RAG",
        "color": "#cf4520",
        "tagline": "Entire corpus in a single prompt",
        "steps": ["generate_full_context"],
        "llm_calls_per_question": 1,
    },
    {
        "key": "recursive_summary",
        "label": "Recursive Summary",
        "family": "non-RAG",
        "color": "#9b1d20",
        "tagline": "Per-doc summary → answer",
        "steps": ["summarize_corpus_amortized", "generate_over_summaries"],
        "llm_calls_per_question": 1,
    },
    {
        "key": "sliding_window",
        "label": "Sliding-Window",
        "family": "non-RAG",
        "color": "#1d1d1f",
        "tagline": "Per-document reasoning with running state",
        "steps": ["window_i_of_n"],
        "llm_calls_per_question": None,  # one per document window
    },
]

APPROACH_KEYS: list[str] = [a["key"] for a in APPROACH_CATALOG]
APPROACH_BY_KEY: dict[str, dict] = {a["key"]: a for a in APPROACH_CATALOG}
