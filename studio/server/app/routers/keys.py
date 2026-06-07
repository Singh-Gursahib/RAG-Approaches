"""Validate a user's Gemini key with one tiny, cheap generation call."""
from __future__ import annotations

import tempfile
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends

from ..deps import redact, require_key

router = APIRouter(tags=["keys"])


@router.post("/key/check")
def key_check(api_key: str = Depends(require_key)) -> dict:
    """Returns {ok, model, latency_ms, cost_usd} or {ok:false, message}.

    Costs a fraction of a cent (max_output_tokens=5). Never raises on a bad key —
    returns a friendly ok:false so the UI can show a clear message.
    """
    from ragureap.eval.cost import BudgetLedger
    from ragureap.llm.gemini import GeminiClient

    model = "gemini-3-flash-preview"
    ledger = BudgetLedger(
        path=Path(tempfile.gettempdir()) / f".ragatlas_keycheck_{uuid.uuid4().hex[:6]}.jsonl",
        cap_usd=1.0,
    )
    try:
        client = GeminiClient(
            model_name=model,
            api_key=api_key,
            temperature=0.0,
            max_output_tokens=5,
            budget_ledger=ledger,
            run_id="key-check",
        )
        resp = client.generate("Reply with the single word: OK")
        return {
            "ok": True,
            "model": model,
            "latency_ms": round(resp.latency_ms, 1),
            "cost_usd": resp.cost_usd,
        }
    except Exception as e:  # noqa: BLE001
        return {
            "ok": False,
            "message": redact(f"{type(e).__name__}: {e}", api_key),
        }
