"""Live single-question runs (SSE)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from .. import service
from ..deps import require_key
from ..schemas import RunRequest
from ..sessions import STORE
from ..streaming import sse_response

router = APIRouter(tags=["run"])


@router.post("/run")
def run(req: RunRequest, api_key: str = Depends(require_key)):
    """Stream an answer per approach over SSE.

    Event sequence: run_start → (per approach) approach_start [→ index_building →
    index_ready] → step* → approach_done | approach_error → done.
    """
    session = STORE.get(req.session_id)
    if session is None:
        raise HTTPException(
            status_code=404,
            detail={"message": "Session not found or expired. Re-upload your corpus.", "code": "no_session"},
        )

    def worker(emit):
        service.run_question_worker(
            session=session,
            question=req.question,
            approaches=req.approaches,
            retrieval=req.retrieval.model_dump(),
            llm_cfg=req.llm.model_dump(),
            price_cfg=req.price.model_dump(),
            api_key=api_key,
            soft_cap_usd=req.soft_cap_usd,
            emit=emit,
        )

    return sse_response(worker)
