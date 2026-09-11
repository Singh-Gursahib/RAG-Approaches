"""Validate an OpenRouter key without spending anything (GET /api/v1/key)."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Header

from ..deps import redact, require_key
from ..openrouter import OpenRouterError, fetch_key_info

router = APIRouter(tags=["keys"])


@router.post("/key/check")
def key_check(
    x_openrouter_key: Optional[str] = Header(default=None, alias="X-OpenRouter-Key"),
    api_key: str = Depends(require_key),
) -> dict:
    """Returns {ok, source, ...} or {ok: false, message}. Never raises on a bad key.

    Only non-identifying fields are passed back: the key's label and creator id
    are dropped.
    """
    source = "browser" if (x_openrouter_key or "").strip() else "server"
    try:
        info = fetch_key_info(api_key)
    except OpenRouterError as e:
        return {"ok": False, "source": source, "message": redact(str(e), api_key)}
    return {
        "ok": True,
        "source": source,
        "is_free_tier": info.get("is_free_tier"),
        "limit_remaining": info.get("limit_remaining"),
        "usage_usd": info.get("usage"),
    }
