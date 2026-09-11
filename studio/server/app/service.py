"""Orchestration: build indexes, run approaches live, grade eval sets.

This is the only module that touches the `ragureap` approaches. It reuses the
package's registry, approaches, metrics, and stats unchanged. Two seams are kept
injectable so tests run with zero model downloads and zero API spend:
    * `get_approach_class(name)` - resolve an Approach class.
    * `make_client(...)`        - build the LLM client.
Tests monkeypatch both.
"""
from __future__ import annotations

import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from typing import Any, Callable

import numpy as np

from ragureap.approaches.base import AnswerWithTrace
from ragureap.eval.cost import BudgetLedger, Price
from ragureap.eval.metrics import grade_one, is_refusal
from ragureap.eval.stats import bootstrap_ci, holm_correction, paired_wilcoxon
from ragureap.indexing import chroma_store as _chroma_store

from . import models_catalog, results_store
from .catalog import APPROACH_BY_KEY
from .deps import redact
from .openrouter import OpenRouterClient, request_max_tokens, resolve_reasoning
from .pricing import resolve_price
from .sessions import Session

# Populate ragureap's approach registry once.
from ragureap.runner import APPROACH_REGISTRY, _eager_register  # noqa: E402

_eager_register()

# Approaches whose answer() only touches the LLM client and read-only state, so
# questions can be answered concurrently. Retrieval approaches share the
# embedding and reranker models, so they stay sequential.
PARALLEL_SAFE = frozenset({"full_context", "sliding_window", "recursive_summary"})
EVAL_CONCURRENCY = 4

# Approaches that cache LLM output on the instance (per-document summaries). Each
# repeat gets a fresh instance so repeats are independent samples, like the
# paper's one-process-per-seed runs.
STATEFUL_APPROACHES = frozenset({"recursive_summary"})


# --- Chroma collection isolation ------------------------------------------
# The approaches build ChromaStore(embedder=...) with the default collection name
# "ragureap", and chromadb's in-memory clients share one system per process. The
# research runner used one process per approach, so that was safe. Here several
# approaches and sessions share a process, and building a second store deletes
# the first store's collection. Every store gets a unique name instead; this is a
# runtime shim and ragureap itself is unchanged.
if not getattr(_chroma_store.ChromaStore, "_ragatlas_isolated", False):
    _original_chroma_init = _chroma_store.ChromaStore.__init__

    def _isolated_chroma_init(self, embedder=None, collection_name="ragureap", persist_dir=None):
        if collection_name == "ragureap":
            collection_name = f"ragatlas_{uuid.uuid4().hex[:12]}"
        _original_chroma_init(
            self, embedder=embedder, collection_name=collection_name, persist_dir=persist_dir
        )

    _chroma_store.ChromaStore.__init__ = _isolated_chroma_init
    _chroma_store.ChromaStore._ragatlas_isolated = True


def _release_instance(instance: Any) -> None:
    """Drop the Chroma collections an approach instance created."""
    for attr in ("store", "vec"):
        store = getattr(instance, attr, None)
        client = getattr(store, "_client", None)
        name = getattr(store, "collection_name", None)
        if client is not None and name:
            try:
                client.delete_collection(name)
            except Exception:  # noqa: BLE001 - already gone
                pass


def release_session(session: Session) -> None:
    """Free every index a session built (used by one-shot replay sessions)."""
    with session.lock:
        instances = list(session._approach_cache.values())
        session._approach_cache.clear()
    for instance in instances:
        _release_instance(instance)


# --- injectable seams (patched in tests) ---------------------------------

def get_approach_class(name: str):
    cls = APPROACH_REGISTRY.get(name)
    if cls is None:
        raise KeyError(f"Unknown approach: {name}")
    return cls


def make_client(
    api_key: str,
    llm_cfg: dict,
    price: Price,
    ledger: BudgetLedger | None,
    run_id: str,
    seed: int | None = None,
) -> OpenRouterClient:
    model = llm_cfg.get("model") or models_catalog.DEFAULT_MODEL
    info = models_catalog.get_model_info(model)
    return OpenRouterClient(
        model,
        api_key,
        temperature=float(llm_cfg.get("temperature", 0.0)),
        max_output_tokens=int(llm_cfg.get("max_output_tokens", 512)),
        reasoning=llm_cfg.get("reasoning") or "lowest",
        reasoning_info=info.get("reasoning"),
        model_max_completion=info.get("max_completion_tokens"),
        seed=seed if seed is not None else llm_cfg.get("seed"),
        budget_ledger=ledger,
        price=price,
        run_id=run_id,
    )


# --- pricing + model description -----------------------------------------

def price_for(llm_cfg: dict, price_cfg: dict) -> Price:
    """Explicit price overrides win; otherwise the model's OpenRouter list price."""
    info = models_catalog.get_model_info(llm_cfg.get("model") or models_catalog.DEFAULT_MODEL)
    input_per_m = price_cfg.get("input_per_m")
    output_per_m = price_cfg.get("output_per_m")
    return resolve_price(
        input_per_m if input_per_m is not None else info.get("input_per_m"),
        output_per_m if output_per_m is not None else info.get("output_per_m"),
    )


def describe_llm(llm_cfg: dict) -> dict:
    """The exact model settings a run used, recorded with saved results."""
    model_id = llm_cfg.get("model") or models_catalog.DEFAULT_MODEL
    info = models_catalog.get_model_info(model_id)
    mode = llm_cfg.get("reasoning") or "lowest"
    effort = resolve_reasoning(mode, info.get("reasoning"))
    budget = int(llm_cfg.get("max_output_tokens", 512))
    return {
        "model": {
            "id": model_id,
            "label": models_catalog.label_for(model_id),
            "lab": models_catalog.lab_for(model_id),
            "name": info.get("name"),
            "open_weights": bool(info.get("hugging_face_id")),
            "hugging_face_id": info.get("hugging_face_id"),
            "pricing_per_m": {"input": info.get("input_per_m"), "output": info.get("output_per_m")},
            "metadata_source": info.get("source"),
        },
        "temperature": float(llm_cfg.get("temperature", 0.0)),
        "reasoning_requested": mode,
        "reasoning_effort_sent": effort,
        "answer_token_budget": budget,
        "max_tokens_sent": request_max_tokens(
            budget, effort, info.get("reasoning"), info.get("max_completion_tokens")
        ),
    }


def _ledger(session: Session, soft_cap_usd: float | None, prefix: str) -> BudgetLedger | None:
    """A per-run budget guard, only when the user set a soft cap."""
    if not soft_cap_usd:
        return None
    return BudgetLedger(
        path=session.tmp_dir / f".{prefix}_{uuid.uuid4().hex[:6]}.jsonl",
        cap_usd=float(soft_cap_usd),
        warn_pct=0.5,
        abort_pct=0.95,
    )


# --- config assembly ------------------------------------------------------

def _build_config(session: Session, approach: str, retrieval: dict, llm_cfg: dict) -> dict:
    """Assemble the resolved-config dict an Approach.setup() expects."""
    return {
        "approach": approach,
        "llm": {
            "model": llm_cfg.get("model") or models_catalog.DEFAULT_MODEL,
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
    cache: bool = True,
) -> Any:
    """Return a set-up Approach instance, cached per session unless `cache=False`.

    The embedding + reranker models are process-global singletons in ragureap, so
    a cache miss only re-embeds this corpus's chunks, not a model reload.
    """
    sig = _retrieval_sig(approach, retrieval)
    if cache:
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
    if cache:
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
    price = price_for(llm_cfg, price_cfg)
    ledger = _ledger(session, soft_cap_usd, "ledger")
    model_id = llm_cfg.get("model") or models_catalog.DEFAULT_MODEL

    emit({
        "event": "run_start",
        "question": question,
        "approaches": approaches,
        "model": model_id,
        "soft_cap_usd": soft_cap_usd or None,
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
                emit({
                    "event": "step",
                    "approach": approach,
                    "index": i,
                    "n_steps": len(aw.trace),
                    **step.to_dict(),
                })

            cost = aw.total_cost_usd
            run_total_cost += cost
            run_total_latency += wall_ms
            stats = getattr(client, "stats", None) or {}
            emit({
                "event": "approach_done",
                "approach": approach,
                "answer": aw.answer,
                "refused": is_refusal(aw.answer),
                "cost_usd": cost,
                "latency_ms": aw.total_latency_ms,
                "wall_ms": round(wall_ms, 1),
                "tokens_in": aw.total_tokens_in,
                "tokens_out": aw.total_tokens_out,
                "reasoning_tokens": int(stats.get("reasoning_tokens", 0)),
                "model": model_id,
                "n_steps": len(aw.trace),
                "retrieved": _retrieved_chunks(session, aw),
            })
        except Exception as e:  # noqa: BLE001
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


# --- eval (grade a question set, optionally several times) ----------------

def _percentile(sorted_vals: list[float], p: float) -> float:
    if not sorted_vals:
        return 0.0
    i = max(0, min(len(sorted_vals) - 1, int(round(p * (len(sorted_vals) - 1)))))
    return sorted_vals[i]


def _std(values: list[float]) -> float:
    """Sample standard deviation across runs (0 for a single run)."""
    return float(np.std(values, ddof=1)) if len(values) > 1 else 0.0


def normalize_questions(questions: list[dict]) -> list[dict]:
    return [
        {
            "id": q.get("id") or f"q{i + 1:03d}",
            "type": q.get("type") or "sanity",
            "question": q["question"],
            "gold_answer": q["gold_answer"],
        }
        for i, q in enumerate(questions)
    ]


def make_record(
    *,
    rep: int,
    qid: str,
    qtype: str,
    question: str,
    gold: str,
    pred: str,
    cost_usd: float = 0.0,
    latency_ms: float = 0.0,
    tokens_in: int = 0,
    tokens_out: int = 0,
    error: str | None = None,
) -> dict:
    """One graded answer: the unit every eval statistic is built from."""
    grade = grade_one(qid, qtype, pred, gold)
    return {
        "rep": int(rep),
        "qid": qid,
        "type": qtype,
        "question": question,
        "gold": gold,
        "pred": pred,
        "em": int(grade.em),
        "f1": float(grade.f1),
        "correct": int(grade.correct),
        "cost_usd": float(cost_usd),
        "latency_ms": float(latency_ms),
        "tokens_in": int(tokens_in),
        "tokens_out": int(tokens_out),
        "error": error,
    }


def _answer_one(instance: Any, q: dict, rep: int, api_key: str) -> dict:
    started = time.perf_counter()
    try:
        aw: AnswerWithTrace = instance.answer(q["question"], qid=q["id"])
        return make_record(
            rep=rep, qid=q["id"], qtype=q["type"], question=q["question"], gold=q["gold_answer"],
            pred=aw.answer, cost_usd=aw.total_cost_usd, latency_ms=aw.total_latency_ms,
            tokens_in=aw.total_tokens_in, tokens_out=aw.total_tokens_out,
        )
    except Exception as e:  # noqa: BLE001 - one failed question must not abort the run
        return make_record(
            rep=rep, qid=q["id"], qtype=q["type"], question=q["question"], gold=q["gold_answer"],
            pred=f"[ERROR: {type(e).__name__}]",
            latency_ms=(time.perf_counter() - started) * 1000.0,
            error=redact(f"{type(e).__name__}: {e}", api_key)[:500],
        )


def _answer_all(
    instance: Any,
    questions: list[dict],
    rep: int,
    repeats: int,
    approach: str,
    emit: Callable[[dict], None],
    api_key: str,
    parallel: bool,
) -> list[dict]:
    """Answer every question once, emitting progress; results keep question order."""
    n = len(questions)
    out: list[dict | None] = [None] * n
    lock = threading.Lock()
    done = 0

    def finish(k: int, rec: dict) -> None:
        nonlocal done
        with lock:
            out[k] = rec
            done += 1
            count = done
        emit({
            "event": "question_done",
            "approach": approach,
            "qid": rec["qid"],
            "type": rec["type"],
            "repeat": rep,
            "n_repeats": repeats,
            "i": count,
            "n": n,
            "em": rec["em"],
            "f1": round(rec["f1"], 4),
            "correct": rec["correct"],
            "cost_usd": round(rec["cost_usd"], 6),
        })

    if not parallel or n <= 1:
        for k, q in enumerate(questions):
            finish(k, _answer_one(instance, q, rep, api_key))
    else:
        # The first question runs alone so per-instance state (e.g. document
        # summaries) is built exactly once before the rest run concurrently.
        finish(0, _answer_one(instance, questions[0], rep, api_key))
        with ThreadPoolExecutor(max_workers=EVAL_CONCURRENCY) as pool:
            futures = {
                pool.submit(_answer_one, instance, questions[k], rep, api_key): k for k in range(1, n)
            }
            for future in as_completed(futures):
                finish(futures[future], future.result())
    return [rec for rec in out if rec is not None]


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
    repeats: int = 1,
    save_meta: dict | None = None,
) -> None:
    repeats = max(1, int(repeats))
    started_at = datetime.now(timezone.utc)
    t_start = time.perf_counter()
    price = price_for(llm_cfg, price_cfg)
    ledger = _ledger(session, soft_cap_usd, "eval_ledger")
    norm = normalize_questions(questions)
    model_id = llm_cfg.get("model") or models_catalog.DEFAULT_MODEL

    emit({
        "event": "eval_start",
        "approaches": approaches,
        "n_questions": len(norm),
        "repeats": repeats,
        "model": model_id,
    })

    records: dict[str, list[dict]] = {}
    llm_stats: dict[str, dict] = {}

    for approach in approaches:
        emit({"event": "approach_eval_start", "approach": approach, "repeats": repeats})
        recs: list[dict] = []
        stats = {"llm_calls": 0, "reasoning_tokens": 0, "truncation_retries": 0}
        try:
            for rep in range(repeats):
                seed = rep if llm_cfg.get("seed") is None else int(llm_cfg["seed"]) + rep
                fresh = approach in STATEFUL_APPROACHES
                instance = _get_or_build_approach(
                    session, approach, retrieval, llm_cfg, emit, cache=not fresh
                )
                client = make_client(
                    api_key, llm_cfg, price, ledger, f"{session.session_id}:{approach}:r{rep}", seed=seed
                )
                if hasattr(instance, "attach_llm"):
                    instance.attach_llm(client)
                recs.extend(
                    _answer_all(
                        instance, norm, rep, repeats, approach, emit, api_key,
                        parallel=approach in PARALLEL_SAFE,
                    )
                )
                for key, value in (getattr(client, "stats", None) or {}).items():
                    stats[key] = stats.get(key, 0) + int(value)
                if fresh:
                    _release_instance(instance)
            if recs:
                emit({
                    "event": "approach_eval_done",
                    "approach": approach,
                    "em": round(float(np.mean([r["em"] for r in recs])), 4),
                    "f1": round(float(np.mean([r["f1"] for r in recs])), 4),
                    "cost_usd": round(sum(r["cost_usd"] for r in recs) / repeats, 6),
                })
        except Exception as e:  # noqa: BLE001
            emit({
                "event": "approach_eval_error",
                "approach": approach,
                "message": redact(f"{type(e).__name__}: {e}", api_key),
            })
        records[approach] = recs
        llm_stats[approach] = stats

    results = assemble_results(norm, records, repeats)
    for row in results["headline"]:
        s = llm_stats.get(row["approach"], {})
        row["llm_calls"] = round(s.get("llm_calls", 0) / repeats, 2)
        row["reasoning_tokens"] = round(s.get("reasoning_tokens", 0) / repeats, 1)
        row["truncation_retries"] = int(s.get("truncation_retries", 0))

    saved_id = None
    if save_meta is not None:
        payload = build_result_payload(
            save_meta=save_meta,
            llm_cfg=llm_cfg,
            retrieval=retrieval,
            chunking=session.chunk_cfg,
            repeats=repeats,
            questions=norm,
            results=results,
            started_at=started_at,
            finished_at=datetime.now(timezone.utc),
            wall_s=time.perf_counter() - t_start,
            llm_stats=llm_stats,
            n_docs=len(session.documents),
        )
        try:
            saved_id = results_store.save_result(payload)
        except Exception as e:  # noqa: BLE001 - never lose the in-browser results over a disk error
            emit({"event": "save_error", "message": str(e)})

    emit({"event": "eval_done", "results": results, "saved_result_id": saved_id})


def assemble_results(questions: list[dict], records: dict[str, list[dict]], repeats: int) -> dict:
    """Build the full results object from graded records (any number of repeats).

    Headline numbers follow the paper's multi-seed convention: EM and F1 are the
    mean of per-run means, `*_seed_std` is the sample standard deviation across
    runs, confidence intervals are percentile bootstraps over all pooled
    question-run grades (2000 resamples, seed 0), and cost, tokens and latency
    are means per full run.
    """
    order = {q["id"]: i for i, q in enumerate(questions)}
    approaches = [a for a, recs in records.items() if recs]
    ordered = {
        a: sorted(records[a], key=lambda r: (r["rep"], order.get(r["qid"], len(order))))
        for a in approaches
    }

    headline: list[dict] = []
    per_probe: list[dict] = []
    for a in approaches:
        recs = ordered[a]
        reps = sorted({r["rep"] for r in recs})
        runs = [[r for r in recs if r["rep"] == rep] for rep in reps]

        em_runs = [float(np.mean([r["em"] for r in run])) for run in runs]
        f1_runs = [float(np.mean([r["f1"] for r in run])) for run in runs]
        acc_runs = [float(np.mean([r["correct"] for r in run])) for run in runs]
        cost_runs = [float(sum(r["cost_usd"] for r in run)) for run in runs]
        tin_runs = [float(sum(r["tokens_in"] for r in run)) for run in runs]
        tout_runs = [float(sum(r["tokens_out"] for r in run)) for run in runs]
        p50_runs = [_percentile(sorted(r["latency_ms"] for r in run), 0.50) for run in runs]
        p95_runs = [_percentile(sorted(r["latency_ms"] for r in run), 0.95) for run in runs]
        em_ci = bootstrap_ci([float(r["em"]) for r in recs], n_boot=2000, seed=0)
        f1_ci = bootstrap_ci([float(r["f1"]) for r in recs], n_boot=2000, seed=0)

        headline.append({
            "approach": a,
            "n": len(recs),
            "n_seeds": len(runs),
            "n_questions_per_seed": len(runs[0]) if runs else 0,
            "em": float(np.mean(em_runs)),
            "em_seed_std": _std(em_runs),
            "em_lo": em_ci.ci_low,
            "em_hi": em_ci.ci_high,
            "f1": float(np.mean(f1_runs)),
            "f1_seed_std": _std(f1_runs),
            "f1_lo": f1_ci.ci_low,
            "f1_hi": f1_ci.ci_high,
            "accuracy": float(np.mean(acc_runs)),
            "cost_usd": float(np.mean(cost_runs)),
            "cost_seed_std": _std(cost_runs),
            "cost_total_usd": float(sum(cost_runs)),
            "tokens_in": float(np.mean(tin_runs)),
            "tokens_out": float(np.mean(tout_runs)),
            "p50_ms": float(np.mean(p50_runs)),
            "p95_ms": float(np.mean(p95_runs)),
            "errors": sum(1 for r in recs if r.get("error")),
        })

        types: list[str] = []
        for r in recs:
            if r["type"] not in types:
                types.append(r["type"])
        for t in types:
            group = [r for r in recs if r["type"] == t]
            e = bootstrap_ci([float(r["em"]) for r in group], n_boot=2000, seed=0)
            f = bootstrap_ci([float(r["f1"]) for r in group], n_boot=2000, seed=0)
            per_probe.append({
                "approach": a,
                "probe_type": t,
                "n": len(group),
                "em": e.mean,
                "em_lo": e.ci_low,
                "em_hi": e.ci_high,
                "f1": f.mean,
                "f1_lo": f.ci_low,
                "f1_hi": f.ci_high,
            })

    questions_out = []
    for q in questions:
        preds = {}
        for a in approaches:
            rs = [r for r in ordered[a] if r["qid"] == q["id"]]
            if not rs:
                continue
            rate = float(np.mean([r["correct"] for r in rs]))
            preds[a] = {
                "pred": rs[0]["pred"],
                "em": float(np.mean([r["em"] for r in rs])),
                "f1": round(float(np.mean([r["f1"] for r in rs])), 4),
                "correct": 1 if rate >= 0.5 else 0,
                "correct_rate": round(rate, 4),
                "n_seeds": len(rs),
                "preds": [
                    {
                        "repeat": r["rep"],
                        "pred": r["pred"],
                        "em": r["em"],
                        "f1": round(r["f1"], 4),
                        "correct": r["correct"],
                        "cost_usd": r["cost_usd"],
                        "latency_ms": round(r["latency_ms"], 1),
                        "error": r.get("error"),
                    }
                    for r in rs
                ],
            }
        questions_out.append({
            "qid": q["id"],
            "type": q["type"],
            "gold": q["gold_answer"],
            "question_text": q["question"],
            "predictions": preds,
        })

    return {
        "approaches": approaches,
        "headline": headline,
        "per_probe": per_probe,
        "pairwise_em": _pairwise(approaches, ordered, "em"),
        "pairwise_f1": _pairwise(approaches, ordered, "f1"),
        "win_matrix": _win_matrix(approaches, ordered),
        "questions": questions_out,
        "totals": {
            "cost_usd": float(sum(r["cost_usd"] for a in approaches for r in ordered[a])),
            "n_questions": len(questions),
            "repeats": repeats,
            "n_graded": sum(len(ordered[a]) for a in approaches),
        },
    }


def _pairwise(approaches: list[str], records: dict[str, list[dict]], metric: str) -> dict[str, dict[str, float]]:
    """Holm-corrected paired Wilcoxon p-values, pairing grades by (run, question)."""
    keyed = {a: {(r["rep"], r["qid"]): float(r[metric]) for r in records[a]} for a in approaches}
    pairs, raw_p = [], []
    for i, a in enumerate(approaches):
        for b in approaches[i + 1:]:
            common = sorted(set(keyed[a]) & set(keyed[b]))
            if common:
                res = paired_wilcoxon([keyed[a][k] for k in common], [keyed[b][k] for k in common])
                pairs.append((a, b))
                raw_p.append(res.p_value)
    adjusted = holm_correction(raw_p) if raw_p else []

    matrix: dict[str, dict[str, float]] = {a: {a: 1.0} for a in approaches}
    for (a, b), p in zip(pairs, adjusted):
        matrix[a][b] = p
        matrix[b][a] = p
    return matrix


def _win_matrix(approaches: list[str], records: dict[str, list[dict]]) -> dict[str, dict[str, dict]]:
    """Head-to-head correctness counts over (run, question) pairs."""
    correct = {a: {(r["rep"], r["qid"]): bool(r["correct"]) for r in records[a]} for a in approaches}
    matrix: dict[str, dict[str, dict]] = {a: {} for a in approaches}
    for a in approaches:
        for b in approaches:
            if a == b:
                matrix[a][b] = {"wins": 0, "losses": 0, "ties": 0, "n": 0}
                continue
            wins = losses = ties = 0
            common = set(correct[a]) & set(correct[b])
            for key in common:
                ca, cb = correct[a][key], correct[b][key]
                if ca and not cb:
                    wins += 1
                elif cb and not ca:
                    losses += 1
                else:
                    ties += 1
            matrix[a][b] = {"wins": wins, "losses": losses, "ties": ties, "n": len(common)}
    return matrix


def build_result_payload(
    *,
    save_meta: dict,
    llm_cfg: dict,
    retrieval: dict,
    chunking: dict,
    repeats: int,
    questions: list[dict],
    results: dict,
    started_at: datetime,
    finished_at: datetime,
    wall_s: float,
    llm_stats: dict[str, dict],
    n_docs: int,
) -> dict:
    """Everything needed to reopen a finished test exactly as it ran."""
    llm = describe_llm(llm_cfg)
    seed0 = llm_cfg.get("seed")
    return {
        "schema_version": 1,
        "created_at": finished_at.isoformat(),
        "source": save_meta.get("source", "custom"),
        "label": save_meta.get("label") or f"{llm['model']['label']} · {len(questions)} questions",
        "provider": "openrouter",
        "model": llm["model"],
        "config": {
            "temperature": llm["temperature"],
            "answer_token_budget": llm["answer_token_budget"],
            "max_tokens_sent": llm["max_tokens_sent"],
            "reasoning_requested": llm["reasoning_requested"],
            "reasoning_effort_sent": llm["reasoning_effort_sent"],
            "repeats": repeats,
            "seeds": [rep if seed0 is None else int(seed0) + rep for rep in range(repeats)],
            "retrieval": dict(retrieval),
            "chunking": dict(chunking),
            "approaches": results["approaches"],
            "eval_concurrency": EVAL_CONCURRENCY,
            "attribution_headers_sent": False,
        },
        "dataset": {
            "name": save_meta.get("dataset", "custom"),
            "n_questions": len(questions),
            "n_docs": n_docs,
            "questions": questions,
        },
        "runtime": {
            "started_at": started_at.isoformat(),
            "finished_at": finished_at.isoformat(),
            "wall_s": round(wall_s, 1),
            "total_cost_usd": results["totals"]["cost_usd"],
            "llm_calls": sum(s.get("llm_calls", 0) for s in llm_stats.values()),
            "reasoning_tokens": sum(s.get("reasoning_tokens", 0) for s in llm_stats.values()),
            "truncation_retries": sum(s.get("truncation_retries", 0) for s in llm_stats.values()),
            "per_approach": llm_stats,
        },
        "results": results,
    }


# --- pre-flight cost estimate (no key, no spend) -------------------------

def estimate_cost(
    n_questions: int,
    approaches: list[str],
    corpus_tokens: int,
    n_docs: int,
    retrieval: dict,
    llm_cfg: dict,
    price_cfg: dict,
    repeats: int = 1,
) -> dict:
    price = price_for(llm_cfg, price_cfg)
    repeats = max(1, int(repeats))
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
        else:  # naive, hybrid, rerank: single answer call over top_k chunks
            calls = n_questions
            tin = n_questions * (top_k * chunk_tokens + prompt_overhead)
            tout = n_questions * min(max_out, 40)
        calls, tin, tout = calls * repeats, tin * repeats, tout * repeats
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
            "Rough estimate from token heuristics and the model's OpenRouter list price. "
            "Reasoning tokens are not included, and actual cost depends on answer length. "
            "Sliding-Window and Full-Context dominate cost at large corpus sizes."
        ),
    }
