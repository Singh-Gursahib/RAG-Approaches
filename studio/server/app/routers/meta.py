"""Metadata + health endpoints (no API key required)."""
from __future__ import annotations

from fastapi import APIRouter

from .. import __version__ as api_version
from ..catalog import APPROACH_CATALOG
from ..pricing import default_price_dict

router = APIRouter(tags=["meta"])


def _ragureap_version() -> str:
    try:
        import ragureap

        return getattr(ragureap, "__version__", "unknown")
    except Exception:  # pragma: no cover - import guard
        return "not-installed"


def _default_model() -> str:
    try:
        from ragureap.config import Settings

        # Read the default without requiring a key to be present.
        return Settings.model_fields["llm_model"].default
    except Exception:  # pragma: no cover
        return "gemini-3-flash-preview"


@router.get("/health")
def health() -> dict:
    """Liveness + wiring check. Proves the `ragureap` package is importable."""
    return {
        "status": "ok",
        "service": "rag-atlas-api",
        "api_version": api_version,
        "ragureap_version": _ragureap_version(),
        "model_default": _default_model(),
        "provider": "gemini",
    }


@router.get("/approaches")
def approaches() -> dict:
    """Canonical approach metadata — the frontend renders from this so labels and
    families never drift from the research code."""
    return {"approaches": APPROACH_CATALOG}


@router.get("/pricing")
def pricing() -> dict:
    """Default per-million-token price model (overridable per request)."""
    return default_price_dict()
