"""Replay the paper's case study: the bundled 8K-token corpus + 34-question set.

Lets a user rerun the published evaluation on any OpenRouter model, repeated
several times like the paper's 3-seed sweep, and compare against the paper.
"""
from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException

from .. import results_store, service
from ..catalog import APPROACH_BY_KEY
from ..deps import require_key
from ..models_catalog import PAPER_MODEL, label_for
from ..schemas import PriceConfig, ReplayRunRequest, RetrievalConfig
from ..sessions import STORE
from ..streaming import sse_response

router = APIRouter(tags=["replay"])

# routers/ -> app/ -> server/ -> studio/ -> repo root
_REPO_ROOT = Path(__file__).resolve().parents[4]
_CORPUS_DIR = _REPO_ROOT / "data" / "eval_corpus"
_EVAL_SET = _REPO_ROOT / "tests" / "eval_set.jsonl"

# The paper's sweep, saved as a loadable result by scripts/import_paper_sweep.py.
PAPER_RESULT_ID = "20260512T163536Z_replay_google-gemini-3-flash-preview_paper-sweep"

# Published case-study headline (3-run sweep, T=0.3) from paper/tables/sweep_headline.csv.
PAPER_HEADLINE = [
    {"approach": "full_context", "em": 0.667, "em_std": 0.017, "f1": 0.881, "f1_std": 0.012, "f1_lo": 0.840, "f1_hi": 0.918, "cost_usd": 0.0912},
    {"approach": "sliding_window", "em": 0.696, "em_std": 0.045, "f1": 0.875, "f1_std": 0.025, "f1_lo": 0.826, "f1_hi": 0.920, "cost_usd": 0.0972},
    {"approach": "hyde", "em": 0.667, "em_std": 0.017, "f1": 0.838, "f1_std": 0.012, "f1_lo": 0.780, "f1_hi": 0.893, "cost_usd": 0.0186},
    {"approach": "naive", "em": 0.667, "em_std": 0.017, "f1": 0.836, "f1_std": 0.012, "f1_lo": 0.778, "f1_hi": 0.888, "cost_usd": 0.0122},
    {"approach": "rerank", "em": 0.667, "em_std": 0.017, "f1": 0.833, "f1_std": 0.009, "f1_lo": 0.774, "f1_hi": 0.887, "cost_usd": 0.0123},
    {"approach": "hybrid", "em": 0.627, "em_std": 0.017, "f1": 0.797, "f1_std": 0.010, "f1_lo": 0.728, "f1_hi": 0.857, "cost_usd": 0.0122},
    {"approach": "recursive_summary", "em": 0.206, "em_std": 0.000, "f1": 0.206, "f1_std": 0.000, "f1_lo": 0.128, "f1_hi": 0.284, "cost_usd": 0.0068},
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
        "paper_model": PAPER_MODEL,
        "paper_settings": {"temperature": 0.3, "repeats": 3, "answer_token_budget": 512},
        "paper_result_id": PAPER_RESULT_ID if results_store.load_result(PAPER_RESULT_ID) else None,
        "model": PAPER_MODEL,
        "note": (
            "The paper used Gemini 3 Flash at temperature 0.3, repeated 3 times. Differences "
            "from the published numbers come from the model, its reasoning settings, and "
            "run-to-run sampling."
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
    llm_cfg = req.llm.model_dump()
    label = f"{label_for(llm_cfg['model'])} · paper case study · {req.repeats} run{'s' if req.repeats != 1 else ''}"
    if set(chosen) != {h["approach"] for h in PAPER_HEADLINE}:
        label += " · " + ", ".join(APPROACH_BY_KEY[a]["label"] for a in chosen)
    effort = service.describe_llm(llm_cfg)["reasoning_effort_sent"]
    if effort:
        label += f" · {effort} reasoning"

    def worker(emit):
        try:
            service.run_eval_worker(
                session=session,
                questions=q_dicts,
                approaches=chosen,
                retrieval=RetrievalConfig().model_dump(),
                llm_cfg=llm_cfg,
                price_cfg=PriceConfig().model_dump(),
                api_key=api_key,
                soft_cap_usd=req.soft_cap_usd,
                emit=emit,
                repeats=req.repeats,
                save_meta={
                    "source": "replay",
                    "label": label,
                    "dataset": "RAG_Ureap case study",
                },
            )
        finally:
            service.release_session(session)
            STORE.delete(session.session_id)

    return sse_response(worker)
