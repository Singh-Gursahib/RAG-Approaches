"""Saved test results: one JSON file per completed evaluation or replay.

Files live in `studio/results/` so a finished test can be reopened later with
exactly the numbers it produced. Writes are atomic, and ids are validated so a
request can never read outside the directory.
"""
from __future__ import annotations

import json
import os
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path

RESULTS_DIR = Path(__file__).resolve().parents[2] / "results"
_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$")


def slug(text: str) -> str:
    return re.sub(r"[^A-Za-z0-9]+", "-", text).strip("-").lower() or "model"


def new_result_id(source: str, model_id: str, when: datetime | None = None) -> str:
    when = when or datetime.now(timezone.utc)
    return f"{when:%Y%m%dT%H%M%SZ}_{slug(source)}_{slug(model_id)}_{uuid.uuid4().hex[:6]}"


def _path(result_id: str) -> Path | None:
    if not isinstance(result_id, str) or not _ID_RE.match(result_id):
        return None
    return RESULTS_DIR / f"{result_id}.json"


def _json_default(obj):
    try:
        import numpy as np

        if isinstance(obj, np.integer):
            return int(obj)
        if isinstance(obj, np.floating):
            return float(obj)
    except ImportError:  # pragma: no cover
        pass
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Not JSON serializable: {type(obj).__name__}")


def save_result(payload: dict, result_id: str | None = None) -> str:
    model_id = (payload.get("model") or {}).get("id", "model")
    result_id = result_id or new_result_id(payload.get("source", "test"), model_id)
    path = _path(result_id)
    if path is None:
        raise ValueError(f"Invalid result id: {result_id!r}")
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    payload = {**payload, "id": result_id}
    tmp = path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(payload, indent=2, default=_json_default), encoding="utf-8")
    os.replace(tmp, path)
    return result_id


def summarize(payload: dict) -> dict:
    results = payload.get("results") or {}
    headline = results.get("headline") or []
    best = max(headline, key=lambda r: r.get("f1", 0), default=None)
    config = payload.get("config") or {}
    dataset = payload.get("dataset") or {}
    return {
        "id": payload.get("id"),
        "created_at": payload.get("created_at"),
        "source": payload.get("source"),
        "label": payload.get("label"),
        "provider": payload.get("provider"),
        "model": payload.get("model"),
        "temperature": config.get("temperature"),
        "repeats": config.get("repeats"),
        "reasoning_effort_sent": config.get("reasoning_effort_sent"),
        "dataset": dataset.get("name"),
        "n_questions": dataset.get("n_questions"),
        "approaches": results.get("approaches") or [],
        "total_cost_usd": (payload.get("runtime") or {}).get("total_cost_usd"),
        "best": {"approach": best.get("approach"), "f1": best.get("f1")} if best else None,
    }


def list_results() -> list[dict]:
    if not RESULTS_DIR.is_dir():
        return []
    out = []
    for path in RESULTS_DIR.glob("*.json"):
        try:
            out.append(summarize(json.loads(path.read_text(encoding="utf-8"))))
        except (OSError, ValueError):
            continue
    return sorted(out, key=lambda s: s.get("created_at") or "", reverse=True)


def load_result(result_id: str) -> dict | None:
    path = _path(result_id)
    if path is None or not path.is_file():
        return None
    return json.loads(path.read_text(encoding="utf-8"))
