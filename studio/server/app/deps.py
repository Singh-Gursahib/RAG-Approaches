"""Request dependencies: the OpenRouter API key.

Resolution order for every request that spends money:
  1. the `X-OpenRouter-Key` header (bring your own key from the browser), else
  2. `OPENROUTER_API_KEY` in the server environment or the repo's `.env`
     (optional, for local or self-hosted use).
The key is only used to call OpenRouter. It is never logged, returned, or
written anywhere by this server, and `redact()` scrubs it from error strings.
"""
from __future__ import annotations

import os

from fastapi import Header, HTTPException

SERVER_KEY_ENV = "OPENROUTER_API_KEY"


def server_key() -> str | None:
    value = os.environ.get(SERVER_KEY_ENV, "").strip()
    return value or None


def require_key(
    x_openrouter_key: str | None = Header(default=None, alias="X-OpenRouter-Key"),
) -> str:
    """FastAPI dependency: the request's key, else the server key, else 401."""
    key = (x_openrouter_key or "").strip() or server_key()
    if not key:
        raise HTTPException(
            status_code=401,
            detail={
                "message": (
                    "Missing OpenRouter API key. Add your key in RAG Atlas; it is sent "
                    "with each request and never stored on the server."
                ),
                "code": "missing_key",
            },
        )
    return key


def redact(text: str, secret: str | None) -> str:
    """Remove a secret (the API key) from a string, defensively."""
    if not text:
        return text
    if secret and len(secret) >= 6 and secret in text:
        text = text.replace(secret, "••••redacted••••")
    return text
