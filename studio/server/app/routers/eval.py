"""Evaluation harness: grade a question set with gold answers (SSE) + cost estimate."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from .. import service
from ..deps import require_key
from ..models_catalog import label_for
from ..schemas import EstimateRequest, EstimateResponse, EvalRequest
from ..sessions import STORE
from ..streaming import sse_response

router = APIRouter(tags=["eval"])


@router.post("/eval")
def evaluate(req: EvalRequest, api_key: str = Depends(require_key)):
    """Stream grading progress. The terminal `eval_done` event carries the full results
    object (headline + per-probe CIs + pairwise significance + win-loss + per-question)
    and the id of the saved result file.
    """
    session = STORE.get(req.session_id)
    if session is None:
        raise HTTPException(
            status_code=404,
            detail={"message": "Session not found or expired. Re-upload your corpus.", "code": "no_session"},
        )

    questions = [q.model_dump() for q in req.questions]
    llm_cfg = req.llm.model_dump()

    def worker(emit):
        service.run_eval_worker(
            session=session,
            questions=questions,
            approaches=req.approaches,
            retrieval=req.retrieval.model_dump(),
            llm_cfg=llm_cfg,
            price_cfg=req.price.model_dump(),
            api_key=api_key,
            soft_cap_usd=req.soft_cap_usd,
            emit=emit,
            repeats=req.repeats,
            save_meta={
                "source": "custom",
                "label": req.label or f"{label_for(llm_cfg['model'])} · custom evaluation · {len(questions)} Q",
                "dataset": "custom",
            },
        )

    return sse_response(worker)


@router.post("/eval/estimate", response_model=EstimateResponse)
def estimate(req: EstimateRequest) -> EstimateResponse:
    """Pre-flight cost estimate. No API key, no spend."""
    out = service.estimate_cost(
        n_questions=req.n_questions,
        approaches=req.approaches,
        corpus_tokens=req.corpus_tokens,
        n_docs=req.n_docs,
        retrieval=req.retrieval.model_dump(),
        llm_cfg=req.llm.model_dump(),
        price_cfg=req.price.model_dump(),
        repeats=req.repeats,
    )
    return EstimateResponse(**out)
