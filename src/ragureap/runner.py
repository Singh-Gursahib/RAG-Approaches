"""Run a single approach over the eval set, write all four artifacts in runs/<id>/.

Outputs:
  manifest.json     — git SHA (if available), config hash, dataset hash, env, timing summary.
  predictions.jsonl — one row per question: qid, question, gold, prediction, telemetry.
  metrics.json      — aggregated EM/F1/accuracy + per-probe-type + cost + latency.
  trace.jsonl       — one row per pipeline step across all questions.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import platform
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from . import __version__
from .approaches.base import Approach, AnswerWithTrace
from .config import load_settings, load_yaml
from .data.corpus import chunk_corpus, load_corpus
from .data.eval_set import EvalQuestion, load_eval_set
from .eval.cost import BudgetLedger, Price
from .eval.metrics import aggregate, grade_one
from .llm.gemini import GeminiClient


APPROACH_REGISTRY: dict[str, type[Approach]] = {}


def register(name: str):
    def deco(cls):
        APPROACH_REGISTRY[name] = cls
        cls.name = name
        return cls

    return deco


def _eager_register():
    """Import every approach so the registry is populated. Add new approaches here."""
    from .approaches.full_context import FullContextInjection  # noqa: F401
    from .approaches.hybrid import HybridRAG  # noqa: F401
    from .approaches.hyde import HyDERAG  # noqa: F401
    from .approaches.naive import NaiveRAG  # noqa: F401
    from .approaches.recursive_summary import RecursiveSummarization  # noqa: F401
    from .approaches.rerank import RerankRAG  # noqa: F401
    from .approaches.sliding_window import SlidingWindowReasoning  # noqa: F401

    APPROACH_REGISTRY.setdefault("naive", NaiveRAG)
    APPROACH_REGISTRY.setdefault("hybrid", HybridRAG)
    APPROACH_REGISTRY.setdefault("hyde", HyDERAG)
    APPROACH_REGISTRY.setdefault("rerank", RerankRAG)
    APPROACH_REGISTRY.setdefault("full_context", FullContextInjection)
    APPROACH_REGISTRY.setdefault("recursive_summary", RecursiveSummarization)
    APPROACH_REGISTRY.setdefault("sliding_window", SlidingWindowReasoning)


# --- config helpers ---


def _merge(base: dict, override: dict) -> dict:
    """Deep-merge override into base (override wins on scalar leaves)."""
    out = dict(base)
    for k, v in (override or {}).items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _merge(out[k], v)
        else:
            out[k] = v
    return out


def load_resolved_config(approach_yaml: str | Path) -> dict[str, Any]:
    base = load_yaml(Path("configs") / "base.yaml")
    approach = load_yaml(approach_yaml)
    return _merge(base, approach)


def _hash_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]


def _hash_corpus(corpus_dir: Path) -> str:
    h = hashlib.sha256()
    for p in sorted(corpus_dir.glob("*.txt")):
        h.update(p.name.encode())
        h.update(p.read_bytes())
    return h.hexdigest()[:16]


def _hash_eval_set(path: Path) -> str:
    return _hash_text(path.read_text(encoding="utf-8"))


# --- main runner ---


def run(
    config_path: str | Path,
    run_id: str | None = None,
    out_root: str | Path = "runs",
    config_overrides: dict[str, Any] | None = None,
) -> Path:
    _eager_register()

    cfg = load_resolved_config(config_path)
    if config_overrides:
        cfg = _merge(cfg, config_overrides)
    approach_name = cfg.get("approach")
    if not approach_name:
        raise ValueError(f"Config {config_path} is missing required key 'approach'.")
    if approach_name not in APPROACH_REGISTRY:
        raise ValueError(
            f"Unknown approach {approach_name!r}. Known: {sorted(APPROACH_REGISTRY)}"
        )

    settings = load_settings()
    corpus_dir = Path(cfg.get("paths", {}).get("eval_corpus", "data/eval_corpus"))
    eval_set_path = Path(cfg.get("paths", {}).get("eval_set", "tests/eval_set.jsonl"))

    docs = load_corpus(corpus_dir)
    chunks = chunk_corpus(
        docs,
        target_tokens=int(cfg["chunking"]["target_tokens"]),
        overlap_tokens=int(cfg["chunking"]["overlap_tokens"]),
    )
    full_text = "\n\n".join(d.text for d in docs)
    questions = load_eval_set(eval_set_path)

    # Identifiers.
    run_id = run_id or f"{approach_name}_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"
    out_dir = Path(out_root) / run_id
    out_dir.mkdir(parents=True, exist_ok=True)

    config_hash = _hash_text(json.dumps(cfg, sort_keys=True))
    corpus_hash = _hash_corpus(corpus_dir)
    eval_set_hash = _hash_eval_set(eval_set_path)

    # Budget ledger + LLM client.
    budget = BudgetLedger(
        path=Path(out_root) / ".budget_ledger.jsonl",
        cap_usd=float(cfg["budget"]["cap_usd"]),
        warn_pct=float(cfg["budget"]["warn_pct"]),
        abort_pct=float(cfg["budget"]["abort_pct"]),
    )
    price = Price.from_env()
    llm = GeminiClient(
        model_name=cfg["llm"]["model"],
        api_key=settings.google_api_key,
        temperature=float(cfg["llm"]["temperature"]),
        max_output_tokens=int(cfg["llm"]["max_output_tokens"]),
        budget_ledger=budget,
        price=price,
        run_id=run_id,
    )

    # Approach setup.
    ApproachCls = APPROACH_REGISTRY[approach_name]
    approach = ApproachCls()
    approach.setup(chunks, full_text, cfg)
    if hasattr(approach, "attach_llm"):
        approach.attach_llm(llm)

    # Run.
    predictions_path = out_dir / "predictions.jsonl"
    trace_path = out_dir / "trace.jsonl"
    grades = []
    answers: list[AnswerWithTrace] = []

    t_start = time.perf_counter()
    print(f"[runner] starting {run_id}  approach={approach_name}  n_questions={len(questions)}",
          flush=True)
    with predictions_path.open("w", encoding="utf-8") as pred_fh, \
         trace_path.open("w", encoding="utf-8") as trace_fh:
        for q in questions:
            t_q = time.perf_counter()
            try:
                aw = approach.answer(q.question, q.id)
            except Exception as e:
                # Record a failed prediction but keep going.
                aw = AnswerWithTrace(
                    qid=q.id, question=q.question, answer=f"[ERROR: {type(e).__name__}: {e}]",
                    trace=[],
                )
            elapsed = (time.perf_counter() - t_q) * 1000.0
            row = aw.to_prediction_row()
            row["gold_answer"] = q.gold_answer
            row["type"] = q.type
            row["total_latency_ms"] = elapsed
            pred_fh.write(json.dumps(row) + "\n")
            for step in aw.trace:
                trace_fh.write(json.dumps({"qid": q.id, **step.to_dict()}) + "\n")
            grades.append(grade_one(q.id, q.type, aw.answer, q.gold_answer))
            answers.append(aw)
            print(
                f"  [{len(grades):>2}/{len(questions)}] {q.id:<14} type={q.type:<14} "
                f"em={int(grades[-1].em)} f1={grades[-1].f1:.2f} "
                f"cost=${aw.total_cost_usd:.4f} t={elapsed:.0f}ms",
                flush=True,
            )

    elapsed_total_s = time.perf_counter() - t_start

    # Aggregate metrics.
    summary = aggregate(grades)
    total_cost = sum(a.total_cost_usd for a in answers)
    latencies = [a.total_latency_ms for a in answers]
    latencies.sort()

    def _pct(p: float) -> float:
        if not latencies:
            return 0.0
        i = max(0, min(len(latencies) - 1, int(round(p * (len(latencies) - 1)))))
        return latencies[i]

    metrics = {
        "run_id": run_id,
        "approach": approach_name,
        "n_questions": len(questions),
        "em": summary["overall"]["em"],
        "f1": summary["overall"]["f1"],
        "accuracy": summary["overall"]["accuracy"],
        "per_type": summary["per_type"],
        "cost_usd": total_cost,
        "tokens_in": sum(a.total_tokens_in for a in answers),
        "tokens_out": sum(a.total_tokens_out for a in answers),
        "latency_p50_ms": _pct(0.50),
        "latency_p95_ms": _pct(0.95),
        "wall_clock_s": elapsed_total_s,
        "cumulative_spend_usd": budget.cumulative(),
        "budget_cap_usd": budget.cap_usd,
    }
    (out_dir / "metrics.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")

    manifest = {
        "run_id": run_id,
        "approach": approach_name,
        "package_version": __version__,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "config_path": str(config_path),
        "config_hash": config_hash,
        "config_resolved": cfg,
        "corpus_dir": str(corpus_dir),
        "corpus_hash": corpus_hash,
        "eval_set_path": str(eval_set_path),
        "eval_set_hash": eval_set_hash,
        "n_questions": len(questions),
        "n_chunks": len(chunks),
        "env": {
            "python": sys.version.split()[0],
            "platform": platform.platform(),
            "model": cfg["llm"]["model"],
        },
    }
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    print(
        f"[runner] done {run_id}  EM={metrics['em']:.3f}  F1={metrics['f1']:.3f}  "
        f"acc={metrics['accuracy']:.3f}  cost=${metrics['cost_usd']:.4f}  "
        f"wall={metrics['wall_clock_s']:.1f}s",
        flush=True,
    )
    return out_dir


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run one ragureap approach end-to-end.")
    parser.add_argument("--config", required=True, help="Path to approach YAML (e.g., configs/approaches/naive.yaml)")
    parser.add_argument("--run-id", default=None, help="Override the auto-generated run id.")
    parser.add_argument("--out-root", default="runs", help="Root directory for run artifacts.")
    args = parser.parse_args(argv)
    out_dir = run(args.config, run_id=args.run_id, out_root=args.out_root)
    print(out_dir, flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
