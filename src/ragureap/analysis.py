"""Aggregate runs/<id>/ artifacts into a comparison DataFrame + pairwise stats.

Run on the command line:
    python -m ragureap.analysis            # all runs in runs/
    python -m ragureap.analysis --latest   # keep only the latest run per approach

Outputs:
    paper/tables/headline.csv          headline metrics + bootstrap CIs
    paper/tables/per_probe.csv         per-probe-type breakdown
    paper/tables/pairwise_em.csv       paired-Wilcoxon p-values for EM (Holm-corrected)
    paper/tables/pairwise_f1.csv       same for F1
"""
from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path

import pandas as pd

from .data.eval_set import load_eval_set
from .eval.metrics import grade_one
from .eval.stats import bootstrap_ci, holm_correction, paired_wilcoxon


def _load_predictions(run_dir: Path) -> list[dict]:
    p = run_dir / "predictions.jsonl"
    if not p.is_file():
        return []
    return [json.loads(l) for l in p.read_text(encoding="utf-8").splitlines() if l.strip()]


def _grade_predictions(predictions: list[dict]) -> list[dict]:
    """Re-grade each prediction. Predictions store (prediction, gold_answer, type),
    so we don't need to re-load the eval set."""
    grades = []
    for r in predictions:
        g = grade_one(r["qid"], r["type"], r["prediction"], r["gold_answer"])
        grades.append(
            {
                "qid": g.qid,
                "type": g.type,
                "em": int(g.em),
                "f1": float(g.f1),
                "correct": int(g.correct),
                "prediction": r["prediction"],
                "gold": r["gold_answer"],
            }
        )
    return grades


def collect_runs(runs_root: Path = Path("runs"), latest_only: bool = False) -> dict[str, dict]:
    """Walk runs/, group by approach, optionally keep only the latest per approach.

    Returns a dict: approach_name -> {run_id, manifest, metrics, grades}.
    """
    candidates: dict[str, list[tuple[str, Path]]] = defaultdict(list)
    for d in sorted(runs_root.iterdir()):
        if not d.is_dir():
            continue
        manifest_path = d / "manifest.json"
        if not manifest_path.is_file():
            continue
        manifest = json.loads(manifest_path.read_text())
        approach = manifest.get("approach")
        if not approach:
            continue
        candidates[approach].append((manifest["run_id"], d))

    out: dict[str, dict] = {}
    for approach, runs in candidates.items():
        runs.sort()  # run_id includes a timestamp prefix, so lexicographic == chronological
        if latest_only:
            runs = [runs[-1]]
        for run_id, d in runs:
            manifest = json.loads((d / "manifest.json").read_text())
            metrics_path = d / "metrics.json"
            metrics = json.loads(metrics_path.read_text()) if metrics_path.is_file() else {}
            grades = _grade_predictions(_load_predictions(d))
            key = approach if latest_only else f"{approach}::{run_id}"
            out[key] = {
                "approach": approach,
                "run_id": run_id,
                "run_dir": d,
                "manifest": manifest,
                "metrics": metrics,
                "grades": grades,
            }
    return out


def headline_table(runs: dict[str, dict]) -> pd.DataFrame:
    """One row per run/approach. Includes bootstrap CIs for EM and F1."""
    rows = []
    for key, r in runs.items():
        em_vals = [g["em"] for g in r["grades"]]
        f1_vals = [g["f1"] for g in r["grades"]]
        em_ci = bootstrap_ci(em_vals)
        f1_ci = bootstrap_ci(f1_vals)
        m = r["metrics"]
        rows.append(
            {
                "approach": r["approach"],
                "run_id": r["run_id"],
                "n": len(r["grades"]),
                "em": em_ci.mean,
                "em_lo": em_ci.ci_low,
                "em_hi": em_ci.ci_high,
                "f1": f1_ci.mean,
                "f1_lo": f1_ci.ci_low,
                "f1_hi": f1_ci.ci_high,
                "cost_usd": m.get("cost_usd", float("nan")),
                "tokens_in": m.get("tokens_in", 0),
                "tokens_out": m.get("tokens_out", 0),
                "p50_ms": m.get("latency_p50_ms", float("nan")),
                "p95_ms": m.get("latency_p95_ms", float("nan")),
                "wall_s": m.get("wall_clock_s", float("nan")),
            }
        )
    df = pd.DataFrame(rows).sort_values("f1", ascending=False).reset_index(drop=True)
    return df


def per_probe_table(runs: dict[str, dict]) -> pd.DataFrame:
    """Long-format per-probe-type EM/F1 table."""
    rows = []
    for key, r in runs.items():
        by_type: dict[str, list[dict]] = defaultdict(list)
        for g in r["grades"]:
            by_type[g["type"]].append(g)
        for t, gs in by_type.items():
            em_vals = [g["em"] for g in gs]
            f1_vals = [g["f1"] for g in gs]
            em_ci = bootstrap_ci(em_vals)
            f1_ci = bootstrap_ci(f1_vals)
            rows.append(
                {
                    "approach": r["approach"],
                    "run_id": r["run_id"],
                    "probe_type": t,
                    "n": len(gs),
                    "em": em_ci.mean,
                    "em_lo": em_ci.ci_low,
                    "em_hi": em_ci.ci_high,
                    "f1": f1_ci.mean,
                    "f1_lo": f1_ci.ci_low,
                    "f1_hi": f1_ci.ci_high,
                }
            )
    return pd.DataFrame(rows)


def pairwise_significance(runs: dict[str, dict], metric: str = "em") -> pd.DataFrame:
    """Pairwise paired-Wilcoxon p-values across all approaches (Holm-corrected).

    Assumes one run per approach (use latest_only=True when collecting). Rows
    and columns are approach names; cell = adjusted p-value.
    """
    # Build per-approach grade arrays in shared question order.
    approaches = sorted({r["approach"] for r in runs.values()})
    # Group runs by approach; if multiple, pick the latest (largest run_id).
    by_approach: dict[str, dict] = {}
    for r in runs.values():
        a = r["approach"]
        if a not in by_approach or r["run_id"] > by_approach[a]["run_id"]:
            by_approach[a] = r

    # Align on qids.
    shared_qids = None
    for r in by_approach.values():
        qids = [g["qid"] for g in r["grades"]]
        shared_qids = set(qids) if shared_qids is None else shared_qids & set(qids)
    shared_qids = sorted(shared_qids or set())

    arrays: dict[str, list[float]] = {}
    for a, r in by_approach.items():
        by_qid = {g["qid"]: g for g in r["grades"]}
        arrays[a] = [by_qid[q][metric] for q in shared_qids]

    # Collect raw p-values across all pairs (upper triangle), then Holm-correct.
    pairs = []
    raw_ps = []
    for i, a in enumerate(approaches):
        for b in approaches[i + 1 :]:
            res = paired_wilcoxon(arrays[a], arrays[b])
            pairs.append((a, b))
            raw_ps.append(res.p_value)
    adj_ps = holm_correction(raw_ps)

    # Square symmetric matrix.
    p_by_pair = {pair: ap for pair, ap in zip(pairs, adj_ps)}
    matrix = pd.DataFrame(index=approaches, columns=approaches, dtype=float)
    for a in approaches:
        matrix.loc[a, a] = 1.0  # self vs self
    for (a, b), adj in p_by_pair.items():
        matrix.loc[a, b] = adj
        matrix.loc[b, a] = adj
    return matrix


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Aggregate ragureap runs.")
    parser.add_argument("--runs-root", default="runs", type=Path)
    parser.add_argument("--latest", action="store_true", help="Keep only the latest run per approach.")
    parser.add_argument("--out", default="paper/tables", type=Path)
    args = parser.parse_args(argv)

    runs = collect_runs(args.runs_root, latest_only=args.latest)
    if not runs:
        print(f"No runs found under {args.runs_root}.")
        return 1

    args.out.mkdir(parents=True, exist_ok=True)

    headline = headline_table(runs)
    headline.to_csv(args.out / "headline.csv", index=False, float_format="%.4f")
    print("\nHEADLINE (sorted by F1)")
    print(headline.to_string(index=False, float_format=lambda x: f"{x:.4f}"))

    per_probe = per_probe_table(runs)
    per_probe.to_csv(args.out / "per_probe.csv", index=False, float_format="%.4f")
    print("\nPER-PROBE EM (n questions, mean ± bootstrap 95% CI)")
    pivot = per_probe.pivot_table(index="approach", columns="probe_type", values="em")
    print(pivot.to_string(float_format=lambda x: f"{x:.3f}"))

    em_p = pairwise_significance(runs, metric="em")
    em_p.to_csv(args.out / "pairwise_em.csv", float_format="%.4f")
    f1_p = pairwise_significance(runs, metric="f1")
    f1_p.to_csv(args.out / "pairwise_f1.csv", float_format="%.4f")
    print("\nPAIRWISE EM p-values (Holm-corrected; lower = stronger evidence of difference)")
    print(em_p.to_string(float_format=lambda x: f"{x:.3f}"))

    print(f"\nArtifacts written to {args.out}/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
