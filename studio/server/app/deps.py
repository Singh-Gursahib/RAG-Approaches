"""Request dependencies — chiefly the BYO Gemini API key.

HARD RULE: the key is read from the X-Gemini-Key header per request, used to
construct a GeminiClient, and never logged or persisted. `redact()` scrubs the
key from any string (e.g. an upstream error) before it leaves the server.
"""
from __future__ import annotations

from fastapi import Header, HTTPException


def require_key(
    x_gemini_key: str | None = Header(default=None, alias="X-Gemini-Key"),
) -> str:
    """FastAPI dependency: 401 unless a non-empty key header is present."""
    if not x_gemini_key or not x_gemini_key.strip():
        raise HTTPException(
            status_code=401,
            detail={
                "message": (
                    "Missing Gemini API key. Add your key in RAG Atlas — it is sent "
                    "with each request and never stored on the server."
                ),
                "code": "missing_key",
            },
        )
    return x_gemini_key.strip()


def redact(text: str, secret: str | None) -> str:
    """Remove a secret (the API key) from a string, defensively."""
    if not text:
        return text
    if secret and len(secret) >= 6 and secret in text:
        text = text.replace(secret, "••••redacted••••")
    return text
