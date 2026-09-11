"""Import the paper's Gemini sweep as a saved RAG Atlas result.

Reads the 21 sweep runs (runs/<approach>_T03_seed<n>/), regrades every
prediction with the framework's metrics, and assembles the same results object
the app produces for a live replay. The app can then load the paper's Gemini 3
Flash results next to any new model's test. The import refuses to save unless
its numbers match paper/tables/sweep_headline.csv.

Usage (from the repo root):
    .venv/bin/python studio/server/scripts/import_paper_sweep.py
"""
from __future__ import annotations

import csv
import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from studio.server.app import results_store, service  # noqa: E402
from studio.server.app.models_catalog import PAPER_MODEL  # noqa: E402
from studio.server.app.routers.replay import PAPER_RESULT_ID  # noqa: E402

SWEEP_RUN = re.compile(r"^(?P<approach>[a-z_]+)_T03_seed(?P<seed>\d+)$")
APPROACH_ORDER = ["full_context", "sliding_window", "hyde", "naive", "rerank", "hybrid", "recursive_summary"]

# headline field -> paper/tables/sweep_headline.csv column
_PAPER_COLUMNS = {
    "em": "em_seed_mean",
    "em_seed_std": "em_seed_std",
    "em_lo": "em_pooled_lo",
    "em_hi": "em_pooled_hi",
    "f1": "f1_seed_mean",
    "f1_seed_std": "f1_seed_std",
    "f1_lo": "f1_pooled_lo",
    "f1_hi": "f1_pooled_hi",
    "cost_usd": "cost_mean",
    "p50_ms": "p50_ms_mean",
    "p95_ms": "p95_ms_mean",
}


def build_payload(repo_root: Path = REPO_ROOT) -> dict:
    from ragureap.data.corpus import load_corpus
    from ragureap.data.eval_set import load_eval_set

    questions = service.normalize_questions([
        {"id": q.id, "type": q.type, "question": q.question, "gold_answer": q.gold_answer}
        for q in load_eval_set(repo_root / "tests" / "eval_set.jsonl")
    ])

    records: dict[str, list[dict]] = {}
    timestamps: list[str] = []
    seeds: set[int] = set()
    for run_dir in sorted((repo_root / "runs").iterdir()):
        match = SWEEP_RUN.match(run_dir.name)
        if not match or not (run_dir / "predictions.jsonl").is_file():
            continue
        manifest = json.loads((run_dir / "manifest.json").read_text(encoding="utf-8"))
        if manifest.get("started_at"):
            timestamps.append(manifest["started_at"])
        rep = int(match["seed"])
        seeds.add(rep)
        for line in (run_dir / "predictions.jsonl").read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            p = json.loads(line)
            records.setdefault(match["approach"], []).append(service.make_record(
                rep=rep,
                qid=p["qid"],
                qtype=p["type"],
                question=p["question"],
                gold=p["gold_answer"],
                pred=p["prediction"],
                cost_usd=p["cost_usd"],
                latency_ms=p["latency_ms"],
                tokens_in=p["tokens_in"],
                tokens_out=p["tokens_out"],
            ))
    if not records:
        raise SystemExit("No sweep runs found under runs/ (expected <approach>_T03_seed<n>/).")

    repeats = len(seeds)
    ordered = {a: records[a] for a in APPROACH_ORDER if a in records}
    results = service.assemble_results(questions, ordered, repeats)
    return {
        "schema_version": 1,
        "id": PAPER_RESULT_ID,
        "created_at": max(timestamps) if timestamps else None,
        "source": "replay",
        "label": "Gemini 3 Flash · paper case study · 3 runs (published sweep)",
        "provider": "google-ai-studio",
        "model": {
            "id": PAPER_MODEL,
            "label": "Gemini 3 Flash",
            "lab": "Google",
            "name": "gemini-3-flash-preview (Google AI Studio API)",
            "open_weights": False,
            "hugging_face_id": None,
            "pricing_per_m": {"input": 0.30, "output": 2.50},
            "metadata_source": "paper",
        },
        "config": {
            "temperature": 0.3,
            "answer_token_budget": 512,
            "max_tokens_sent": 512,
            "reasoning_requested": "provider default",
            "reasoning_effort_sent": None,
            "repeats": repeats,
            "seeds": sorted(seeds),
            "retrieval": {"top_k": 5, "top_n_for_rerank": 20},
            "chunking": {"target_tokens": 150, "overlap_tokens": 30},
            "approaches": results["approaches"],
            "eval_concurrency": 1,
            "attribution_headers_sent": False,
            "note": (
                "Imported from the research sweep (runs/*_T03_seed*), called through the "
                "google-generativeai SDK. Costs use the research ledger's $0.30 / $2.50 per "
                "1M token estimate."
            ),
        },
        "dataset": {
            "name": "RAG_Ureap case study",
            "n_questions": len(questions),
            "n_docs": len(load_corpus(repo_root / "data" / "eval_corpus")),
            "questions": questions,
        },
        "runtime": {
            "started_at": min(timestamps) if timestamps else None,
            "finished_at": max(timestamps) if timestamps else None,
            "wall_s": None,
            "total_cost_usd": results["totals"]["cost_usd"],
            "llm_calls": None,
            "reasoning_tokens": None,
            "truncation_retries": 0,
            "per_approach": {},
        },
        "results": results,
    }


def compare_with_paper_table(results: dict, csv_path: Path) -> list[str]:
    """Differences between the assembled headline and the paper's table (empty = match)."""
    with open(csv_path, encoding="utf-8") as fh:
        paper = {row["approach"]: row for row in csv.DictReader(fh)}
    problems = []
    for row in results["headline"]:
        ref = paper.get(row["approach"])
        if ref is None:
            problems.append(f"{row['approach']}: missing from {csv_path.name}")
            continue
        for ours, theirs in _PAPER_COLUMNS.items():
            tolerance = 0.01 if ours.endswith("_ms") else 1e-4
            if abs(float(row[ours]) - float(ref[theirs])) > tolerance:
                problems.append(f"{row['approach']}.{ours}: {row[ours]:.6f} vs paper {ref[theirs]}")
    return problems


def main() -> int:
    payload = build_payload()
    problems = compare_with_paper_table(payload["results"], REPO_ROOT / "paper" / "tables" / "sweep_headline.csv")
    if problems:
        print("Not saving: assembled numbers differ from the paper table:")
        for problem in problems:
            print("  -", problem)
        return 1
    result_id = results_store.save_result(payload, result_id=PAPER_RESULT_ID)
    print(f"Saved {result_id} (matches paper/tables/sweep_headline.csv)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
