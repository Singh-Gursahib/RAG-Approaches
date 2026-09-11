"""Metadata endpoints: health, approaches, models, pricing (no API key required)."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Query

from .. import __version__ as api_version
from ..catalog import APPROACH_CATALOG
from ..deps import server_key
from ..models_catalog import (
    DEFAULT_MODEL,
    PAPER_MODEL,
    REASONING_MODES,
    curated_models,
    get_model_info,
)
from ..pricing import default_price_dict

router = APIRouter(tags=["meta"])


def _ragureap_version() -> str:
    try:
        import ragureap

        return getattr(ragureap, "__version__", "unknown")
    except Exception:  # pragma: no cover - import guard
        return "not-installed"


@router.get("/health")
def health() -> dict:
    """Liveness + wiring check. Proves the `ragureap` package is importable."""
    return {
        "status": "ok",
        "service": "rag-atlas-api",
        "api_version": api_version,
        "ragureap_version": _ragureap_version(),
        "model_default": DEFAULT_MODEL,
        "provider": "openrouter",
        "server_key_configured": server_key() is not None,
    }


@router.get("/approaches")
def approaches() -> dict:
    """Canonical approach metadata, so labels and families never drift from the research code."""
    return {"approaches": APPROACH_CATALOG}


@router.get("/models")
def models() -> dict:
    """Curated OpenRouter models with live pricing and reasoning controls."""
    return {
        "default": DEFAULT_MODEL,
        "paper_model": PAPER_MODEL,
        "reasoning_modes": REASONING_MODES,
        "models": curated_models(),
    }


@router.get("/models/lookup")
def model_lookup(id: str = Query(..., min_length=3, max_length=200)) -> dict:
    """Check a custom model slug against OpenRouter's model list."""
    return get_model_info(id.strip())


@router.get("/pricing")
def pricing(model: Optional[str] = None) -> dict:
    """Per-million-token list price for a model (default model if omitted)."""
    return default_price_dict(model)
