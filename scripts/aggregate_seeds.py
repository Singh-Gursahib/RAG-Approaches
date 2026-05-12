"""Aggregate multi-seed sweep runs into a single per-approach summary.

Looks for `runs/<approach>_T*_seed*/` directories, groups by approach, and
computes mean ± std + 95% CI across seeds for each metric. Also re-grades
predictions at the per-question level to compute pooled bootstrap CIs.

Outputs:
    paper/tables/sweep_headline.csv         per-approach × per-metric summary
    paper/tables/sweep_per_question.csv     long-form per-question per-seed grades
"""
from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path
from typing import Iterable

import numpy as np
import pandas as pd

from ragureap.analysis import _load_predictions, _grade_predictions
from ragureap.eval.stats import bootstrap_ci


SWEEP_PATTERN = re.compile(r"^(?P<approach>[a-z_]+)_T(?P<temp_x10>\d{2})_seed(?P<seed>\d+)$")


def collect_sweep_runs(runs_root: Path = Path("runs")) -> dict[str, list[dict]]:
    """Return {approach -> [run_info, ...]} for every sweep-style run."""
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
        by_approach[approach].append(
            {"run_id": d.name, "seed": seed, "temperature": temp, "metrics": metrics, "grades": grades}
        )
    return by_approach


def _mean_std(values: Iterable[float]) -> tuple[float, float]:
    arr = np.asarray(list(values), dtype=float)
    if arr.size == 0:
        return float("nan"), float("nan")
    return float(arr.mean()), float(arr.std(ddof=1) if arr.size > 1 else 0.0)


def build_headline(by_approach: dict[str, list[dict]]) -> pd.DataFrame:
    rows = []
    for approach, runs in by_approach.items():
        if not runs:
            continue
        em_means = [r["metrics"]["em"] for r in runs]
        f1_means = [r["metrics"]["f1"] for r in runs]
        costs = [r["metrics"]["cost_usd"] for r in runs]
        p50s = [r["metrics"]["latency_p50_ms"] for r in runs]
        p95s = [r["metrics"]["latency_p95_ms"] for r in runs]

        # Pool grades across seeds for a bootstrap CI based on 34 * n_seeds points.
        pooled_em = [g["em"] for r in runs for g in r["grades"]]
        pooled_f1 = [g["f1"] for r in runs for g in r["grades"]]
        em_ci = bootstrap_ci(pooled_em, n_boot=2000, seed=0)
        f1_ci = bootstrap_ci(pooled_f1, n_boot=2000, seed=0)

        em_mu, em_sd = _mean_std(em_means)
        f1_mu, f1_sd = _mean_std(f1_means)
        cost_mu, cost_sd = _mean_std(costs)

        rows.append(
            {
                "approach": approach,
                "n_seeds": len(runs),
                "n_questions_per_seed": len(runs[0]["grades"]),
                "em_seed_mean": em_mu,
                "em_seed_std": em_sd,
                "em_pooled_lo": em_ci.ci_low,
                "em_pooled_hi": em_ci.ci_high,
                "f1_seed_mean": f1_mu,
                "f1_seed_std": f1_sd,
                "f1_pooled_lo": f1_ci.ci_low,
                "f1_pooled_hi": f1_ci.ci_high,
                "cost_mean": cost_mu,
                "cost_std": cost_sd,
                "p50_ms_mean": np.mean(p50s),
                "p95_ms_mean": np.mean(p95s),
            }
        )
    return pd.DataFrame(rows).sort_values("f1_seed_mean", ascending=False).reset_index(drop=True)


def build_per_question(by_approach: dict[str, list[dict]]) -> pd.DataFrame:
    rows = []
    for approach, runs in by_approach.items():
        for r in runs:
            for g in r["grades"]:
                rows.append(
                    {
                        "approach": approach,
                        "seed": r["seed"],
                        "qid": g["qid"],
                        "type": g["type"],
                        "em": g["em"],
                        "f1": g["f1"],
                        "correct": g["correct"],
                    }
                )
    return pd.DataFrame(rows)


def main() -> int:
    by_approach = collect_sweep_runs()
    if not by_approach:
        print("No sweep runs found (looking for `<approach>_T<NN>_seed<n>/` under runs/).")
        return 1

    print(f"Found {sum(len(v) for v in by_approach.values())} sweep runs across "
          f"{len(by_approach)} approaches.")
    for a, runs in sorted(by_approach.items()):
        print(f"  {a:<22} {len(runs)} seeds  "
              f"(seeds={[r['seed'] for r in runs]}, temps={sorted({r['temperature'] for r in runs})})")

    out_dir = Path("paper/tables")
    out_dir.mkdir(parents=True, exist_ok=True)

    headline = build_headline(by_approach)
    headline.to_csv(out_dir / "sweep_headline.csv", index=False, float_format="%.4f")
    print("\nSWEEP HEADLINE (mean across seeds ± std; pooled bootstrap CI)")
    pretty = headline.copy()
    for col in ("em_seed_mean", "em_seed_std", "f1_seed_mean", "f1_seed_std"):
        pretty[col] = pretty[col].map(lambda x: f"{x:.3f}")
    pretty["cost"] = pretty.apply(lambda r: f"${r['cost_mean']:.4f}±{r['cost_std']:.4f}", axis=1)
    print(pretty[["approach", "n_seeds", "em_seed_mean", "em_seed_std", "f1_seed_mean", "f1_seed_std", "cost"]]
          .to_string(index=False))

    per_q = build_per_question(by_approach)
    per_q.to_csv(out_dir / "sweep_per_question.csv", index=False)
    print(f"\nWrote {out_dir / 'sweep_headline.csv'} and {out_dir / 'sweep_per_question.csv'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
