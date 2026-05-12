"""Aggregate everything the Next.js dashboard needs into a single JSON file.

Produces `frontend/web/lib/data.json` consumed at build time by the dashboard.

Mode:
  - If sweep runs (matching `<approach>_T<NN>_seed<n>/`) exist, prefer them
    and aggregate across seeds for each approach. This is the Phase 9+ mode.
  - Otherwise fall back to the latest single-seed run per approach.

Run manually after every new experimental run:
    .venv/bin/python scripts/build_dashboard_data.py
"""
from __future__ import annotations

import json
import re
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

from ragureap.analysis import collect_runs, headline_table, per_probe_table, pairwise_significance, _load_predictions, _grade_predictions
from ragureap.eval.stats import bootstrap_ci


SWEEP_PATTERN = re.compile(r"^(?P<approach>[a-z_]+)_T(?P<temp_x10>\d{2})_seed(?P<seed>\d+)$")
OUT_PATH = Path("frontend/web/lib/data.json")


def _collect_sweep(runs_root: Path):
    """Return {approach: [{run_id, seed, temperature, metrics, grades}]}"""
    by_approach: dict[str, list[dict]] = defaultdict(list)
    for d in sorted(runs_root.iterdir()):
        if not d.is_dir():
            continue
        m = SWEEP_PATTERN.match(d.name)
        if not m:
            continue
        approach = m.group("approach")
        seed = int(m.group("seed"))
        temp = int(m.group("temp_x10")) / 10
        metrics_path = d / "metrics.json"
        if not metrics_path.is_file():
            continue
        metrics = json.loads(metrics_path.read_text())
        grades = _grade_predictions(_load_predictions(d))
        by_approach[approach].append({
            "run_id": d.name, "seed": seed, "temperature": temp,
            "metrics": metrics, "grades": grades,
        })
    return by_approach


def _build_sweep_dashboard_payload(by_approach: dict[str, list[dict]]) -> dict:
    # Headline: mean across seeds, pooled bootstrap CI from all seed grades.
    headline = []
    for approach, runs in by_approach.items():
        em_means = [r["metrics"]["em"] for r in runs]
        f1_means = [r["metrics"]["f1"] for r in runs]
        costs = [r["metrics"]["cost_usd"] for r in runs]
        p50s = [r["metrics"]["latency_p50_ms"] for r in runs]
        p95s = [r["metrics"]["latency_p95_ms"] for r in runs]
        walls = [r["metrics"]["wall_clock_s"] for r in runs]
        toks_in = [r["metrics"]["tokens_in"] for r in runs]
        toks_out = [r["metrics"]["tokens_out"] for r in runs]

        pooled_em = [g["em"] for r in runs for g in r["grades"]]
        pooled_f1 = [g["f1"] for r in runs for g in r["grades"]]
        em_ci = bootstrap_ci(pooled_em, n_boot=2000, seed=0)
        f1_ci = bootstrap_ci(pooled_f1, n_boot=2000, seed=0)

        n_per_seed = len(runs[0]["grades"]) if runs else 0
        headline.append({
            "approach": approach,
            "run_id": f"{approach}_T03_pooled",
            "n": n_per_seed,
            "n_seeds": len(runs),
            "em": float(np.mean(em_means)),
            "em_lo": em_ci.ci_low,
            "em_hi": em_ci.ci_high,
            "em_seed_std": float(np.std(em_means, ddof=1)) if len(em_means) > 1 else 0.0,
            "f1": float(np.mean(f1_means)),
            "f1_lo": f1_ci.ci_low,
            "f1_hi": f1_ci.ci_high,
            "f1_seed_std": float(np.std(f1_means, ddof=1)) if len(f1_means) > 1 else 0.0,
            "cost_usd": float(np.mean(costs)),
            "tokens_in": int(np.mean(toks_in)),
            "tokens_out": int(np.mean(toks_out)),
            "p50_ms": float(np.mean(p50s)),
            "p95_ms": float(np.mean(p95s)),
            "wall_s": float(np.mean(walls)),
        })

    # Per-probe: aggregate across seeds (each seed contributes one EM and F1 mean per probe).
    per_probe = []
    for approach, runs in by_approach.items():
        # Collect grades grouped by probe type.
        by_type: dict[str, list[dict]] = defaultdict(list)
        for r in runs:
            for g in r["grades"]:
                by_type[g["type"]].append(g)
        for t, gs in by_type.items():
            em_vals = [g["em"] for g in gs]
            f1_vals = [g["f1"] for g in gs]
            em_ci = bootstrap_ci(em_vals, n_boot=1000, seed=0)
            f1_ci = bootstrap_ci(f1_vals, n_boot=1000, seed=0)
            per_probe.append({
                "approach": approach,
                "run_id": f"{approach}_T03_pooled",
                "probe_type": t,
                "n": len(gs),
                "em": em_ci.mean,
                "em_lo": em_ci.ci_low,
                "em_hi": em_ci.ci_high,
                "f1": f1_ci.mean,
                "f1_lo": f1_ci.ci_low,
                "f1_hi": f1_ci.ci_high,
            })

    # Per-question: one entry per question, with each approach's prediction summary
    # (using the first seed's prediction as representative, plus correctness rate across seeds).
    by_qid: dict[str, dict] = {}
    for approach, runs in by_approach.items():
        if not runs:
            continue
        per_q: dict[str, list[dict]] = defaultdict(list)
        for r in runs:
            for g in r["grades"]:
                per_q[g["qid"]].append(g)
        for qid, gs in per_q.items():
            rep = sorted(gs, key=lambda x: x.get("qid", ""))[0]  # any seed
            if qid not in by_qid:
                by_qid[qid] = {
                    "qid": qid,
                    "type": rep["type"],
                    "gold": rep["gold"],
                    "predictions": {},
                }
            correct_rate = float(np.mean([g["correct"] for g in gs]))
            by_qid[qid]["predictions"][approach] = {
                "pred": rep["prediction"],
                "em": int(round(np.mean([g["em"] for g in gs]))),
                "f1": float(np.mean([g["f1"] for g in gs])),
                "correct": int(round(correct_rate)),
                "correct_rate": correct_rate,
                "n_seeds": len(gs),
            }
    questions = sorted(by_qid.values(), key=lambda q: (q["type"], q["qid"]))

    # Win/Loss matrix: for each pair, fraction of (qid)s where row's mean EM > column's mean EM.
    approaches = sorted(by_approach.keys())
    em_means_by: dict[str, dict[str, float]] = defaultdict(dict)
    for approach, runs in by_approach.items():
        per_q: dict[str, list[float]] = defaultdict(list)
        for r in runs:
            for g in r["grades"]:
                per_q[g["qid"]].append(g["em"])
        for qid, vals in per_q.items():
            em_means_by[approach][qid] = float(np.mean(vals))
    win_matrix: dict[str, dict[str, dict]] = {}
    for a in approaches:
        win_matrix[a] = {}
        for b in approaches:
            if a == b:
                win_matrix[a][b] = {"wins": 0, "losses": 0, "ties": 0, "n": 0}
                continue
            wins = losses = ties = 0
            for qid in em_means_by[a].keys() & em_means_by[b].keys():
                if em_means_by[a][qid] > em_means_by[b][qid]:
                    wins += 1
                elif em_means_by[b][qid] > em_means_by[a][qid]:
                    losses += 1
                else:
                    ties += 1
            win_matrix[a][b] = {"wins": wins, "losses": losses, "ties": ties, "n": wins + losses + ties}

    return {
        "headline": headline,
        "per_probe": per_probe,
        "questions": questions,
        "win_matrix": win_matrix,
        "pairwise_em": {},  # placeholder; sweep version doesn't compute Wilcoxon over seeds yet
        "pairwise_f1": {},
        "is_sweep": True,
        "temperature": runs[0]["temperature"] if (runs := next(iter(by_approach.values()), None)) else None,
    }


def _build_single_seed_payload() -> dict:
    runs = collect_runs(Path("runs"), latest_only=True)
    # Filter out sweep-tagged single-seed runs (they're handled by sweep path).
    runs = {k: v for k, v in runs.items() if not SWEEP_PATTERN.match(v["run_id"])}
    headline = headline_table(runs).to_dict(orient="records")
    per_probe = per_probe_table(runs).to_dict(orient="records")
    pairwise_em = pairwise_significance(runs, metric="em").to_dict(orient="index")
    pairwise_f1 = pairwise_significance(runs, metric="f1").to_dict(orient="index")

    by_qid: dict[str, dict] = {}
    for key, r in runs.items():
        approach = r["approach"]
        for g in r["grades"]:
            qid = g["qid"]
            if qid not in by_qid:
                by_qid[qid] = {"qid": qid, "type": g["type"], "gold": g["gold"], "predictions": {}}
            by_qid[qid]["predictions"][approach] = {
                "pred": g["prediction"], "em": int(g["em"]),
                "f1": float(g["f1"]), "correct": int(g["correct"]),
            }
    questions = sorted(by_qid.values(), key=lambda q: (q["type"], q["qid"]))

    approaches = sorted({r["approach"] for r in runs.values()})
    by_approach = {a: next(r for r in runs.values() if r["approach"] == a) for a in approaches}
    win_matrix: dict[str, dict[str, dict]] = {}
    for a in approaches:
        win_matrix[a] = {}
        a_grades = {g["qid"]: g for g in by_approach[a]["grades"]}
        for b in approaches:
            if a == b:
                win_matrix[a][b] = {"wins": 0, "losses": 0, "ties": 0, "n": 0}
                continue
            b_grades = {g["qid"]: g for g in by_approach[b]["grades"]}
            shared = sorted(set(a_grades) & set(b_grades))
            w = l = t = 0
            for q in shared:
                ea, eb = a_grades[q]["em"], b_grades[q]["em"]
                if ea > eb: w += 1
                elif eb > ea: l += 1
                else: t += 1
            win_matrix[a][b] = {"wins": w, "losses": l, "ties": t, "n": len(shared)}

    return {
        "headline": headline,
        "per_probe": per_probe,
        "questions": questions,
        "win_matrix": win_matrix,
        "pairwise_em": pairwise_em,
        "pairwise_f1": pairwise_f1,
        "is_sweep": False,
        "temperature": 0.0,
    }


def main() -> None:
    sweep_by_approach = _collect_sweep(Path("runs"))
    # Use sweep payload only if we have at least 2 approaches with at least 2 seeds each
    # (otherwise the std/CI machinery is misleading).
    has_real_sweep = (
        len(sweep_by_approach) >= 2 and
        sum(1 for runs in sweep_by_approach.values() if len(runs) >= 2) >= 2
    )

    if has_real_sweep:
        payload = _build_sweep_dashboard_payload(sweep_by_approach)
        print(f"Using SWEEP data: {len(sweep_by_approach)} approaches, "
              f"{sum(len(v) for v in sweep_by_approach.values())} total runs")
    else:
        payload = _build_single_seed_payload()
        print("Using SINGLE-SEED data (no usable sweep runs found yet)")

    # --- Eval set stats ---
    eval_set_rows = [
        json.loads(l) for l in Path("tests/eval_set.jsonl").read_text().splitlines() if l.strip()
    ]
    probe_counts: dict[str, int] = defaultdict(int)
    for q in eval_set_rows:
        probe_counts[q["type"]] += 1

    # --- Corpus stats ---
    corpus_dir = Path("data/eval_corpus")
    corpus_docs = []
    for p in sorted(corpus_dir.glob("*.txt")):
        text = p.read_text(encoding="utf-8")
        corpus_docs.append({"doc_id": p.stem, "words": len(text.split()), "chars": len(text)})

    # --- Cumulative project spend from ledger ---
    ledger_path = Path("runs/.budget_ledger.jsonl")
    cumulative_spend = 0.0
    n_calls = 0
    if ledger_path.is_file():
        for line in ledger_path.read_text(encoding="utf-8").splitlines():
            if not line.strip(): continue
            try: entry = json.loads(line)
            except json.JSONDecodeError: continue
            cumulative_spend += float(entry.get("cost_usd", 0.0))
            n_calls += 1

    data = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "project": {
            "name": "RAG_Ureap",
            "budget_cap_usd": 5.0,
            "cumulative_spend_usd": round(cumulative_spend, 4),
            "spend_pct": round(cumulative_spend / 5.0 * 100, 2),
            "total_llm_calls": n_calls,
            "model": "gemini-3-flash-preview",
        },
        "corpus": {
            "n_docs": len(corpus_docs),
            "total_words": sum(d["words"] for d in corpus_docs),
            "documents": corpus_docs,
        },
        "eval_set": {
            "n_questions": len(eval_set_rows),
            "by_probe_type": dict(probe_counts),
        },
        **payload,
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(data, indent=2, default=float), encoding="utf-8")
    n_headline = len(data["headline"])
    n_q = len(data["questions"])
    print(f"Wrote {OUT_PATH}")
    print(f"  {n_headline} approaches · {n_q} questions · "
          f"{'sweep T=' + str(payload['temperature']) if payload['is_sweep'] else 'single-seed T=0'}")
    print(f"  spend ${cumulative_spend:.4f} / $5.00 ({100 * cumulative_spend / 5:.1f}%)")


if __name__ == "__main__":
    main()
