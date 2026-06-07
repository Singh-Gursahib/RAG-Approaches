"""Replay the paper's case study: the bundled 8K-token corpus + 34-question set.

Lets a user reproduce the published headline numbers with their own key.
"""
from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException

from .. import service
from ..deps import require_key
from ..schemas import LLMConfig, PriceConfig, ReplayRunRequest, RetrievalConfig
from ..sessions import STORE
from ..streaming import sse_response

router = APIRouter(tags=["replay"])

# routers/ -> app/ -> server/ -> studio/ -> repo root
_REPO_ROOT = Path(__file__).resolve().parents[4]
_CORPUS_DIR = _REPO_ROOT / "data" / "eval_corpus"
_EVAL_SET = _REPO_ROOT / "tests" / "eval_set.jsonl"

# Published case-study headline (3-seed sweep, T=0.3) from FINDINGS.md / PROGRESS.md,
# shown alongside the user's own reproduction.
PAPER_HEADLINE = [
    {"approach": "full_context", "em": 0.667, "f1": 0.881, "cost_usd": 0.0912},
    {"approach": "sliding_window", "em": 0.696, "f1": 0.875, "cost_usd": 0.0972},
    {"approach": "hyde", "em": 0.667, "f1": 0.838, "cost_usd": 0.0186},
    {"approach": "naive", "em": 0.667, "f1": 0.836, "cost_usd": 0.0122},
    {"approach": "rerank", "em": 0.667, "f1": 0.833, "cost_usd": 0.0123},
    {"approach": "hybrid", "em": 0.627, "f1": 0.797, "cost_usd": 0.0122},
    {"approach": "recursive_summary", "em": 0.206, "f1": 0.206, "cost_usd": 0.0068},
]


def _load_bundled():
    from ragureap.data.corpus import load_corpus
    from ragureap.data.eval_set import load_eval_set, summarize

    if not _CORPUS_DIR.is_dir() or not _EVAL_SET.is_file():
        raise HTTPException(
            status_code=503,
            detail={"message": "Bundled case-study assets not found in this checkout."},
        )
    docs = load_corpus(_CORPUS_DIR)
    questions = load_eval_set(_EVAL_SET)
    return docs, questions, summarize(questions)


@router.get("/replay/meta")
def replay_meta() -> dict:
    docs, questions, summary = _load_bundled()
    return {
        "corpus": {
            "n_docs": len(docs),
            "total_words": sum(d.n_tokens for d in docs),
            "documents": [{"doc_id": d.doc_id, "words": d.n_tokens} for d in docs],
        },
        "eval_set": {"n_questions": len(questions), "by_probe_type": summary},
        "paper_headline": PAPER_HEADLINE,
        "model": "gemini-3-flash-preview",
        "note": (
            "Reproduce the paper's case study on your own key. Small deltas from the "
            "published numbers are expected (model preview drift, temperature/seed)."
        ),
    }


@router.post("/replay/run")
def replay_run(
    req: ReplayRunRequest = ReplayRunRequest(),
    api_key: str = Depends(require_key),
):
    """Build a session from the bundled corpus + run the bundled eval set (SSE)."""
    docs, questions, _ = _load_bundled()
    chosen = req.approaches or [h["approach"] for h in PAPER_HEADLINE]

    session = STORE.create(
        [(d.doc_id, d.text) for d in docs],
        {"target_tokens": 150, "overlap_tokens": 30},
    )
    q_dicts = [
        {"id": q.id, "type": q.type, "question": q.question, "gold_answer": q.gold_answer}
        for q in questions
    ]

    def worker(emit):
        service.run_eval_worker(
            session=session,
            questions=q_dicts,
            approaches=chosen,
            retrieval=RetrievalConfig().model_dump(),
            llm_cfg=LLMConfig().model_dump(),
            price_cfg=PriceConfig().model_dump(),
            api_key=api_key,
            soft_cap_usd=None,
            emit=emit,
        )

    return sse_response(worker)
