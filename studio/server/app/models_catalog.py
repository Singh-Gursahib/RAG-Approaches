"""OpenRouter model catalog: curated picks plus live model metadata.

Metadata (pricing, context window, reasoning controls, Hugging Face id) comes
from OpenRouter's public `GET /api/v1/models` endpoint. That request carries no
API key and no attribution headers. It is cached in-process for an hour, and a
snapshot of the curated models (data/openrouter_models_snapshot.json) is used
when OpenRouter can't be reached.
"""
from __future__ import annotations

import json
import threading
import time
from pathlib import Path

import httpx

MODELS_URL = "https://openrouter.ai/api/v1/models"
DEFAULT_MODEL = "google/gemini-3-flash-preview"
PAPER_MODEL = "google/gemini-3-flash-preview"
REASONING_MODES = ["lowest", "default", "none", "minimal", "low", "medium", "high", "max"]

CURATED: list[dict] = [
    {
        "id": "google/gemini-3-flash-preview",
        "label": "Gemini 3 Flash",
        "lab": "Google",
        "note": "Generator used in the paper's case study",
    },
    {"id": "google/gemini-3.7-flash", "label": "Gemini 3.7 Flash", "lab": "Google", "note": None},
    {"id": "google/gemini-3.8-flash", "label": "Gemini 3.8 Flash", "lab": "Google", "note": None},
    {"id": "z-ai/glm-5.3-flash", "label": "GLM 5.3 Flash", "lab": "Z.ai", "note": None},
    {"id": "deepseek/deepseek-v4.1-flash", "label": "DeepSeek V4.1 Flash", "lab": "DeepSeek", "note": None},
]

_SNAPSHOT_PATH = Path(__file__).resolve().parent / "data" / "openrouter_models_snapshot.json"
_CACHE_TTL_S = 3600.0
_RETRY_AFTER_FAILURE_S = 60.0
_lock = threading.Lock()
_remote: dict = {"at": 0.0, "index": None, "failed_at": 0.0}


def _per_million(value) -> float | None:
    try:
        return round(float(value) * 1_000_000, 6)
    except (TypeError, ValueError):
        return None


def normalize(raw: dict) -> dict:
    """Reduce an OpenRouter model record to the fields the app uses."""
    pricing = raw.get("pricing") or {}
    top = raw.get("top_provider") or {}
    return {
        "id": raw.get("id"),
        "name": raw.get("name"),
        "input_per_m": _per_million(pricing.get("prompt")),
        "output_per_m": _per_million(pricing.get("completion")),
        "context_length": raw.get("context_length"),
        "max_completion_tokens": top.get("max_completion_tokens"),
        "hugging_face_id": raw.get("hugging_face_id") or None,
        "reasoning": raw.get("reasoning"),
        "supported_parameters": raw.get("supported_parameters") or [],
    }


def _fetch_remote(timeout: float = 8.0) -> list[dict]:
    """Anonymous fetch: no Authorization, no HTTP-Referer, no X-OpenRouter-Title."""
    with httpx.Client(timeout=timeout) as client:
        resp = client.get(MODELS_URL)
        resp.raise_for_status()
        return resp.json().get("data", [])


def _remote_index() -> dict[str, dict] | None:
    with _lock:
        now = time.time()
        if _remote["index"] is not None and now - _remote["at"] < _CACHE_TTL_S:
            return _remote["index"]
        if _remote["index"] is None and now - _remote["failed_at"] < _RETRY_AFTER_FAILURE_S:
            return None
    try:
        index = {m["id"]: normalize(m) for m in _fetch_remote() if m.get("id")}
    except Exception:  # noqa: BLE001 - offline or OpenRouter unavailable; fall back to the snapshot
        with _lock:
            _remote["failed_at"] = time.time()
        return None
    with _lock:
        _remote["index"], _remote["at"] = index, time.time()
    return index


def _snapshot() -> dict[str, dict]:
    try:
        return json.loads(_SNAPSHOT_PATH.read_text(encoding="utf-8"))["models"]
    except (OSError, ValueError, KeyError):
        return {}


def get_model_info(model_id: str) -> dict:
    """Metadata for any OpenRouter slug.

    `found` is True when the slug exists, False when OpenRouter's live list
    doesn't contain it, and None when it couldn't be checked (offline).
    """
    index = _remote_index()
    if index and model_id in index:
        return {**index[model_id], "found": True, "source": "live"}
    snapshot = _snapshot()
    if model_id in snapshot:
        return {**snapshot[model_id], "found": True, "source": "snapshot"}
    return {
        "id": model_id,
        "name": None,
        "input_per_m": None,
        "output_per_m": None,
        "context_length": None,
        "max_completion_tokens": None,
        "hugging_face_id": None,
        "reasoning": None,
        "supported_parameters": [],
        "found": None if index is None else False,
        "source": "unknown",
    }


def label_for(model_id: str) -> str:
    for entry in CURATED:
        if entry["id"] == model_id:
            return entry["label"]
    return model_id


def lab_for(model_id: str) -> str:
    for entry in CURATED:
        if entry["id"] == model_id:
            return entry["lab"]
    return model_id.lstrip("~").split("/", 1)[0]


def curated_models() -> list[dict]:
    out = []
    for entry in CURATED:
        info = get_model_info(entry["id"])
        out.append({
            **entry,
            "name": info.get("name"),
            "input_per_m": info.get("input_per_m"),
            "output_per_m": info.get("output_per_m"),
            "context_length": info.get("context_length"),
            "max_completion_tokens": info.get("max_completion_tokens"),
            "hugging_face_id": info.get("hugging_face_id"),
            "open_weights": bool(info.get("hugging_face_id")),
            "reasoning": info.get("reasoning"),
            "source": info.get("source"),
            "paper_model": entry["id"] == PAPER_MODEL,
        })
    return out
