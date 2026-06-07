"""Orchestration: build indexes, run approaches live, grade eval sets.

This is the only module that touches the `ragureap` approaches. It reuses the
package's registry, approaches, metrics, and stats unchanged. Two seams are kept
injectable so tests run with zero model downloads and zero API spend:
    * `get_approach_class(name)` — resolve an Approach class.
    * `make_client(...)`        — build the LLM client.
Tests monkeypatch both.
"""
from __future__ import annotations

import time
import uuid
from pathlib import Path
from typing import Any, Callable

from ragureap.approaches.base import AnswerWithTrace
from ragureap.eval.cost import BudgetLedger
from ragureap.eval.metrics import aggregate, grade_one
from ragureap.eval.stats import bootstrap_ci, holm_correction, paired_wilcoxon
from ragureap.llm.gemini import GeminiClient

from .catalog import APPROACH_BY_KEY
from .pricing import resolve_price
from .sessions import Session

# Populate ragureap's approach registry once.
from ragureap.runner import APPROACH_REGISTRY, _eager_register  # noqa: E402

_eager_register()

# A practically-unbounded cap when the user sets no soft cap.
_NO_CAP = 1e9


# --- injectable seams (patched in tests) ---------------------------------

def get_approach_class(name: str):
    cls = APPROACH_REGISTRY.get(name)
    if cls is None:
        raise KeyError(f"Unknown approach: {name}")
    return cls


def make_client(
    api_key: str,
    llm_cfg: dict,
    price,
    ledger: BudgetLedger,
    run_id: str,
) -> GeminiClient:
    return GeminiClient(
        model_name=llm_cfg.get("model", "gemini-3-flash-preview"),
        api_key=api_key,
        temperature=float(llm_cfg.get("temperature", 0.0)),
        max_output_tokens=int(llm_cfg.get("max_output_tokens", 512)),
        budget_ledger=ledger,
        price=price,
        run_id=run_id,
    )


# --- config assembly ------------------------------------------------------

def _build_config(session: Session, approach: str, retrieval: dict, llm_cfg: dict) -> dict:
    """Assemble the resolved-config dict an Approach.setup() expects."""
    return {
        "approach": approach,
        "llm": {
            "model": llm_cfg.get("model", "gemini-3-flash-preview"),
            "temperature": float(llm_cfg.get("temperature", 0.0)),
            "max_output_tokens": int(llm_cfg.get("max_output_tokens", 512)),
        },
        "embedding": {"model": "sentence-transformers/all-MiniLM-L6-v2"},
        "reranker": {"model": "BAAI/bge-reranker-base"},
        "chunking": dict(session.chunk_cfg),
        "retrieval": {
            "top_k": int(retrieval.get("top_k", 5)),
            "top_n_for_rerank": int(retrieval.get("top_n_for_rerank", 20)),
        },
        "sliding_window": {"window_unit": "document"},
        "paths": {"eval_corpus": str(session.tmp_dir)},
    }


def _retrieval_sig(approach: str, retrieval: dict) -> str:
    return f"{approach}|k={retrieval.get('top_k', 5)}|n={retrieval.get('top_n_for_rerank', 20)}"


def _get_or_build_approach(
    session: Session,
    approach: str,
    retrieval: dict,
    llm_cfg: dict,
    emit: Callable[[dict], None] | None,
) -> Any:
    """Return a cached, set-up Approach instance (builds + caches on first use).

    The embedding + reranker models are process-global singletons in ragureap, so
    a cache miss only re-embeds this corpus's chunks, not a model reload.
    """
    sig = _retrieval_sig(approach, retrieval)
    with session.lock:
        cached = session._approach_cache.get(sig)
        if cached is not None:
            return cached

    if emit:
        emit({"event": "index_building", "approach": approach})
    t0 = time.perf_counter()
    cfg = _build_config(session, approach, retrieval, llm_cfg)
    instance = get_approach_class(approach)()
    instance.setup(session.chunks, session.full_text, cfg)
    build_ms = (time.perf_counter() - t0) * 1000.0
    with session.lock:
        session._approach_cache[sig] = instance
    if emit:
        emit({"event": "index_ready", "approach": approach, "ms": round(build_ms, 1)})
    return instance


# --- retrieved-chunk extraction (for the answer inspector) ----------------

_ID_META_KEYS = ("chunk_ids", "fused_ids", "reranked_ids")


def _retrieved_chunks(session: Session, aw: AnswerWithTrace) -> list[dict]:
    by_id = session.chunk_by_id
    for step in aw.trace:
        for k in _ID_META_KEYS:
            ids = step.meta.get(k)
            if ids:
                scores = step.meta.get("scores") or step.meta.get("fused_scores") or step.meta.get(
                    "reranked_scores"
                )
                out = []
                for i, cid in enumerate(ids):
                    chunk = by_id.get(cid)
                    out.append(
                        {
                            "chunk_id": cid,
                            "doc_id": chunk.doc_id if chunk else None,
                            "text": chunk.text if chunk else "",
                            "score": float(scores[i]) if scores and i < len(scores) else None,
                        }
                    )
                return out
    return []


def _is_refusal(text: str) -> bool:
    from ragureap.eval.metrics import is_refusal

    return is_refusal(text)


# --- single-question run (SSE worker) ------------------------------------

def run_question_worker(
    session: Session,
    question: str,
    approaches: list[str],
    retrieval: dict,
    llm_cfg: dict,
    price_cfg: dict,
    api_key: str,
    soft_cap_usd: float | None,
    emit: Callable[[dict], None],
) -> None:
    price = resolve_price(price_cfg.get("input_per_m"), price_cfg.get("output_per_m"))
    cap = float(soft_cap_usd) if soft_cap_usd else _NO_CAP
    ledger = BudgetLedger(
        path=session.tmp_dir / f".ledger_{uuid.uuid4().hex[:6]}.jsonl",
        cap_usd=cap,
        warn_pct=0.5,
        abort_pct=0.95,
    )

    emit({
        "event": "run_start",
        "question": question,
        "approaches": approaches,
        "soft_cap_usd": None if cap >= _NO_CAP else cap,
    })

    run_total_cost = 0.0
    run_total_latency = 0.0

    for approach in approaches:
        meta = APPROACH_BY_KEY.get(approach, {})
        emit({"event": "approach_start", "approach": approach, "label": meta.get("label", approach)})
        try:
            instance = _get_or_build_approach(session, approach, retrieval, llm_cfg, emit)
            run_id = f"{session.session_id}:{approach}"
            client = make_client(api_key, llm_cfg, price, ledger, run_id)
            if hasattr(instance, "attach_llm"):
                instance.attach_llm(client)

            t0 = time.perf_counter()
            aw: AnswerWithTrace = instance.answer(question, qid="adhoc")
            wall_ms = (time.perf_counter() - t0) * 1000.0

            for i, step in enumerate(aw.trace):
                d = step.to_dict()
                emit({
                    "event": "step",
                    "approach": approach,
                    "index": i,
                    "n_steps": len(aw.trace),
                    **d,
                })

            cost = aw.total_cost_usd
            run_total_cost += cost
            run_total_latency += wall_ms
            emit({
                "event": "approach_done",
                "approach": approach,
                "answer": aw.answer,
                "refused": _is_refusal(aw.answer),
                "cost_usd": cost,
                "latency_ms": aw.total_latency_ms,
                "wall_ms": round(wall_ms, 1),
                "tokens_in": aw.total_tokens_in,
                "tokens_out": aw.total_tokens_out,
                "n_steps": len(aw.trace),
                "retrieved": _retrieved_chunks(session, aw),
            })
        except Exception as e:  # noqa: BLE001
            from .deps import redact

            emit({
                "event": "approach_error",
                "approach": approach,
                "message": redact(f"{type(e).__name__}: {e}", api_key),
            })

    emit({
        "event": "done",
        "cost_usd": round(run_total_cost, 6),
        "latency_ms": round(run_total_latency, 1),
    })


# --- eval (grade a question set) -----------------------------------------

def _percentile(sorted_vals: list[float], p: float) -> float:
    if not sorted_vals:
        return 0.0
    i = max(0, min(len(sorted_vals) - 1, int(round(p * (len(sorted_vals) - 1)))))
    return sorted_vals[i]


def run_eval_worker(
    session: Session,
    questions: list[dict],
    approaches: list[str],
    retrieval: dict,
    llm_cfg: dict,
    price_cfg: dict,
    api_key: str,
    soft_cap_usd: float | None,
    emit: Callable[[dict], None],
) -> None:
    price = resolve_price(price_cfg.get("input_per_m"), price_cfg.get("output_per_m"))
    cap = float(soft_cap_usd) if soft_cap_usd else _NO_CAP
    ledger = BudgetLedger(
        path=session.tmp_dir / f".eval_ledger_{uuid.uuid4().hex[:6]}.jsonl",
        cap_usd=cap,
        warn_pct=0.5,
        abort_pct=0.95,
    )

    # Normalize questions: ensure id + type.
    norm: list[dict] = []
    for i, q in enumerate(questions):
        norm.append({
            "id": q.get("id") or f"q{i + 1:03d}",
            "type": q.get("type") or "sanity",
            "question": q["question"],
            "gold_answer": q["gold_answer"],
        })

    emit({"event": "eval_start", "approaches": approaches, "n_questions": len(norm)})

    # per_approach[approach] = {grades, costs, latencies, tokens_in, tokens_out, preds}
    results: dict[str, dict] = {}

    for approach in approaches:
        emit({"event": "approach_eval_start", "approach": approach})
        per = {"grades": [], "cost": 0.0, "latencies": [], "tokens_in": 0, "tokens_out": 0}
        try:
            instance = _get_or_build_approach(session, approach, retrieval, llm_cfg, emit)
            run_id = f"{session.session_id}:{approach}:eval"
            client = make_client(api_key, llm_cfg, price, ledger, run_id)
            if hasattr(instance, "attach_llm"):
                instance.attach_llm(client)

            for k, q in enumerate(norm):
                t0 = time.perf_counter()
                try:
                    aw = instance.answer(q["question"], qid=q["id"])
                    pred = aw.answer
                    cost = aw.total_cost_usd
                    lat = aw.total_latency_ms
                    tin, tout = aw.total_tokens_in, aw.total_tokens_out
                except Exception as e:  # noqa: BLE001
                    pred = f"[ERROR: {type(e).__name__}]"
                    cost, lat, tin, tout = 0.0, (time.perf_counter() - t0) * 1000.0, 0, 0
                grade = grade_one(q["id"], q["type"], pred, q["gold_answer"])
                per["grades"].append(grade)
                per["cost"] += cost
                per["latencies"].append(lat)
                per["tokens_in"] += tin
                per["tokens_out"] += tout
                emit({
                    "event": "question_done",
                    "approach": approach,
                    "qid": q["id"],
                    "type": q["type"],
                    "i": k + 1,
                    "n": len(norm),
                    "em": int(grade.em),
                    "f1": round(grade.f1, 4),
                    "correct": int(grade.correct),
                    "cost_usd": round(cost, 6),
                })

            agg = aggregate(per["grades"])
            emit({
                "event": "approach_eval_done",
                "approach": approach,
                "em": round(agg["overall"]["em"], 4),
                "f1": round(agg["overall"]["f1"], 4),
                "cost_usd": round(per["cost"], 6),
            })
        except Exception as e:  # noqa: BLE001
            from .deps import redact

            emit({
                "event": "approach_eval_error",
                "approach": approach,
                "message": redact(f"{type(e).__name__}: {e}", api_key),
            })
        results[approach] = per

    emit({"event": "eval_done", "results": _assemble_eval_results(norm, results)})


def _assemble_eval_results(questions: list[dict], results: dict[str, dict]) -> dict:
    """Build the full results object (mirrors the dashboard data shape)."""
    approaches = [a for a in results if results[a]["grades"]]

    headline = []
    per_probe = []
    for a in approaches:
        per = results[a]
        grades = per["grades"]
        agg = aggregate(grades)
        em_arr = [float(g.em) for g in grades]
        f1_arr = [g.f1 for g in grades]
        em_ci = bootstrap_ci(em_arr)
        f1_ci = bootstrap_ci(f1_arr)
        lat = sorted(per["latencies"])
        headline.append({
            "approach": a,
            "n": len(grades),
            "em": agg["overall"]["em"],
            "em_lo": em_ci.ci_low,
            "em_hi": em_ci.ci_high,
            "f1": agg["overall"]["f1"],
            "f1_lo": f1_ci.ci_low,
            "f1_hi": f1_ci.ci_high,
            "accuracy": agg["overall"]["accuracy"],
            "cost_usd": per["cost"],
            "tokens_in": per["tokens_in"],
            "tokens_out": per["tokens_out"],
            "p50_ms": _percentile(lat, 0.50),
            "p95_ms": _percentile(lat, 0.95),
        })
        # per-probe-type CIs
        by_type: dict[str, list] = {}
        for g in grades:
            by_type.setdefault(g.type, []).append(g)
        for t, gs in by_type.items():
            e = bootstrap_ci([float(g.em) for g in gs])
            f = bootstrap_ci([g.f1 for g in gs])
            per_probe.append({
                "approach": a,
                "probe_type": t,
                "n": len(gs),
                "em": e.mean,
                "em_lo": e.ci_low,
                "em_hi": e.ci_high,
                "f1": f.mean,
                "f1_lo": f.ci_low,
                "f1_hi": f.ci_high,
            })

    # Per-question record (gold + each approach's prediction/grade).
    grade_by_aq: dict[str, dict[str, Any]] = {}
    for a in approaches:
        for g in results[a]["grades"]:
            grade_by_aq.setdefault(g.qid, {})[a] = g
    questions_out = []
    qtype = {q["id"]: q["type"] for q in questions}
    qgold = {q["id"]: q["gold_answer"] for q in questions}
    for q in questions:
        preds = {}
        for a in approaches:
            g = grade_by_aq.get(q["id"], {}).get(a)
            if g is not None:
                preds[a] = {
                    "pred": g.pred,
                    "em": int(g.em),
                    "f1": round(g.f1, 4),
                    "correct": int(g.correct),
                }
        questions_out.append({
            "qid": q["id"],
            "type": qtype[q["id"]],
            "gold": qgold[q["id"]],
            "predictions": preds,
        })

    pairwise_em = _pairwise(approaches, results, metric="em")
    pairwise_f1 = _pairwise(approaches, results, metric="f1")
    win_matrix = _win_matrix(approaches, results)

    total_cost = sum(results[a]["cost"] for a in approaches)
    return {
        "approaches": approaches,
        "headline": headline,
        "per_probe": per_probe,
        "pairwise_em": pairwise_em,
        "pairwise_f1": pairwise_f1,
        "win_matrix": win_matrix,
        "questions": questions_out,
        "totals": {"cost_usd": total_cost, "n_questions": len(questions)},
    }


def _pairwise(approaches: list[str], results: dict, metric: str) -> dict[str, dict[str, float]]:
    """Holm-corrected paired Wilcoxon adjusted p-values between every approach pair."""
    arrays = {}
    for a in approaches:
        grades = results[a]["grades"]
        arrays[a] = [float(g.em) if metric == "em" else g.f1 for g in grades]

    pairs = []
    raw_p = []
    for i, a in enumerate(approaches):
        for b in approaches[i + 1:]:
            if len(arrays[a]) == len(arrays[b]) and len(arrays[a]) > 0:
                res = paired_wilcoxon(arrays[a], arrays[b])
                pairs.append((a, b))
                raw_p.append(res.p_value)
    adj = holm_correction(raw_p) if raw_p else []

    matrix: dict[str, dict[str, float]] = {a: {} for a in approaches}
    for a in approaches:
        matrix[a][a] = 1.0
    for (a, b), p in zip(pairs, adj):
        matrix[a][b] = p
        matrix[b][a] = p
    return matrix


def _win_matrix(approaches: list[str], results: dict) -> dict[str, dict[str, dict]]:
    correct = {a: {g.qid: bool(g.correct) for g in results[a]["grades"]} for a in approaches}
    qids = sorted({qid for a in approaches for qid in correct[a]})
    matrix: dict[str, dict[str, dict]] = {a: {} for a in approaches}
    for a in approaches:
        for b in approaches:
            if a == b:
                matrix[a][b] = {"wins": 0, "losses": 0, "ties": 0, "n": 0}
                continue
            wins = losses = ties = n = 0
            for qid in qids:
                ca, cb = correct[a].get(qid), correct[b].get(qid)
                if ca is None or cb is None:
                    continue
                n += 1
                if ca and not cb:
                    wins += 1
                elif cb and not ca:
                    losses += 1
                else:
                    ties += 1
            matrix[a][b] = {"wins": wins, "losses": losses, "ties": ties, "n": n}
    return matrix


# --- pre-flight cost estimate (no key, no spend) -------------------------

def estimate_cost(
    n_questions: int,
    approaches: list[str],
    corpus_tokens: int,
    n_docs: int,
    retrieval: dict,
    llm_cfg: dict,
    price_cfg: dict,
) -> dict:
    price = resolve_price(price_cfg.get("input_per_m"), price_cfg.get("output_per_m"))
    max_out = int(llm_cfg.get("max_output_tokens", 512))
    top_k = int(retrieval.get("top_k", 5))
    # crude: a 150-token chunk ≈ 150 tokens; answer prompt overhead ≈ 80 tokens.
    chunk_tokens = 150
    prompt_overhead = 80
    avg_doc_tokens = max(1, corpus_tokens // max(1, n_docs))

    per_approach = []
    total_calls = 0
    total_cost = 0.0
    for a in approaches:
        if a == "full_context":
            calls = n_questions
            tin = n_questions * (corpus_tokens + prompt_overhead)
            tout = n_questions * min(max_out, 40)
        elif a == "recursive_summary":
            # one summarization pass over the corpus (amortized) + 1 answer/question.
            summary_in = corpus_tokens + n_docs * 40
            summary_out = min(corpus_tokens // 2, n_docs * max_out)
            calls = n_docs + n_questions
            tin = summary_in + n_questions * (summary_out + prompt_overhead)
            tout = summary_out + n_questions * min(max_out, 40)
        elif a == "sliding_window":
            calls = n_questions * n_docs
            tin = n_questions * n_docs * (avg_doc_tokens + prompt_overhead)
            tout = n_questions * n_docs * min(max_out, 40)
        elif a == "hyde":
            # rewrite (out ~120) + answer
            calls = n_questions * 2
            tin = n_questions * (prompt_overhead + top_k * chunk_tokens + prompt_overhead)
            tout = n_questions * (120 + min(max_out, 40))
        else:  # naive, hybrid, rerank — single answer call over top_k chunks
            calls = n_questions
            tin = n_questions * (top_k * chunk_tokens + prompt_overhead)
            tout = n_questions * min(max_out, 40)
        cost = price.usd(tin, tout)
        per_approach.append({
            "approach": a,
            "llm_calls": calls,
            "est_tokens_in": int(tin),
            "est_tokens_out": int(tout),
            "est_cost_usd": round(cost, 6),
        })
        total_calls += calls
        total_cost += cost

    return {
        "per_approach": per_approach,
        "total_llm_calls": total_calls,
        "total_cost_usd": round(total_cost, 6),
        "note": (
            "Rough upper-bound estimate from token heuristics; actual cost depends "
            "on answer length and exact tokenization. Sliding-Window and Full-Context "
            "dominate cost at large corpus sizes."
        ),
    }
