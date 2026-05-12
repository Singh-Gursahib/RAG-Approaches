"""Generate paper-ready PDF figures from the sweep results.

Reads:
  paper/tables/sweep_headline.csv         per-approach mean/std/CI
  paper/tables/sweep_per_question.csv     long-form for per-probe + bootstraps

Writes:
  paper/figures/pareto_cost_quality.pdf   cost × F1 scatter
  paper/figures/forest_em.pdf             EM forest plot with seed std
  paper/figures/forest_f1.pdf             F1 forest plot with seed std
  paper/figures/per_probe_em.pdf          per-probe-type EM bar chart
  paper/figures/win_loss.pdf              pairwise win-loss heatmap (EM)
"""
from __future__ import annotations

from collections import defaultdict
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd


APPROACH_COLOR = {
    "sliding_window": "#1d1d1f",
    "full_context": "#cf4520",
    "rerank": "#2d6a4f",
    "naive": "#6b7280",
    "hyde": "#b8761a",
    "hybrid": "#8b6f5e",
    "recursive_summary": "#9b1d20",
}

APPROACH_LABEL = {
    "sliding_window": "Sliding-Window",
    "full_context": "Full-Context",
    "rerank": "Reranker",
    "naive": "Naive RAG",
    "hyde": "HyDE",
    "hybrid": "Hybrid RAG",
    "recursive_summary": "Recursive Summary",
}


def _setup_style() -> None:
    plt.rcParams.update({
        "font.family": "serif",
        "font.serif": ["Charter", "Palatino", "DejaVu Serif"],
        "font.size": 9,
        "axes.titlesize": 10,
        "axes.labelsize": 9,
        "xtick.labelsize": 8,
        "ytick.labelsize": 8,
        "axes.spines.top": False,
        "axes.spines.right": False,
        "axes.edgecolor": "#86868b",
        "axes.linewidth": 0.6,
        "xtick.color": "#1d1d1f",
        "ytick.color": "#1d1d1f",
        "axes.labelcolor": "#1d1d1f",
        "savefig.bbox": "tight",
        "savefig.pad_inches": 0.08,
        "savefig.transparent": False,
    })


def make_pareto(headline: pd.DataFrame, out: Path) -> None:
    fig, ax = plt.subplots(figsize=(5.4, 3.6))
    for _, row in headline.iterrows():
        color = APPROACH_COLOR.get(row["approach"], "#000000")
        ax.errorbar(
            row["cost_mean"],
            row["f1_seed_mean"],
            yerr=row["f1_seed_std"],
            fmt="o",
            color=color,
            markersize=8,
            elinewidth=1.0,
            capsize=2.5,
            capthick=0.8,
        )
        ax.annotate(
            APPROACH_LABEL.get(row["approach"], row["approach"]),
            (row["cost_mean"], row["f1_seed_mean"]),
            xytext=(8, 4),
            textcoords="offset points",
            fontsize=8,
            color="#1d1d1f",
        )
    ax.set_xlabel("Cost (USD per full eval-set run)")
    ax.set_ylabel("Token F1 (mean across 3 seeds, T=0.3)")
    ax.set_title("Cost × Quality Pareto frontier", loc="left", pad=10, weight="bold")
    ax.grid(True, alpha=0.25, axis="y", linewidth=0.5)
    fig.savefig(out)
    plt.close(fig)


def make_forest(headline: pd.DataFrame, metric: str, out: Path) -> None:
    df = headline.sort_values(f"{metric}_seed_mean", ascending=True).copy()
    fig, ax = plt.subplots(figsize=(5.4, 0.45 * len(df) + 1.0))
    ys = np.arange(len(df))
    for y, (_, row) in zip(ys, df.iterrows()):
        color = APPROACH_COLOR.get(row["approach"], "#000000")
        mean = row[f"{metric}_seed_mean"]
        lo = row[f"{metric}_pooled_lo"]
        hi = row[f"{metric}_pooled_hi"]
        ax.plot([lo, hi], [y, y], color=color, linewidth=1.3, alpha=0.55)
        ax.plot(mean, y, "o", color=color, markersize=7)
        ax.annotate(f"{mean:.3f}", (mean, y), xytext=(8, -3), textcoords="offset points",
                    fontsize=7, color="#1d1d1f")
    ax.set_yticks(ys)
    ax.set_yticklabels([APPROACH_LABEL.get(a, a) for a in df["approach"]])
    ax.set_xlim(0, 1)
    ax.set_xlabel(f"{'Token F1' if metric == 'f1' else 'Exact Match'} (mean across 3 seeds · pooled bootstrap 95% CI)")
    ax.set_title(
        f"{'F1' if metric == 'f1' else 'EM'} forest plot",
        loc="left", pad=10, weight="bold",
    )
    ax.grid(True, alpha=0.25, axis="x", linewidth=0.5)
    fig.savefig(out)
    plt.close(fig)


def make_per_probe(per_q: pd.DataFrame, out: Path) -> None:
    PROBE_ORDER = ["sanity", "hallucination", "needle", "multi_hop", "distractor"]
    approaches = sorted(per_q["approach"].unique(),
                        key=lambda a: per_q[per_q["approach"] == a]["f1"].mean(),
                        reverse=True)
    # Compute mean EM per (approach, probe), averaging across rows.
    summary = (
        per_q.groupby(["approach", "type"])["em"].mean().unstack()
        .reindex(index=approaches, columns=PROBE_ORDER)
    )
    fig, ax = plt.subplots(figsize=(6.2, 3.4))
    x = np.arange(len(PROBE_ORDER))
    width = 0.10
    for i, a in enumerate(approaches):
        color = APPROACH_COLOR.get(a, "#000000")
        ax.bar(x + (i - len(approaches) / 2) * width + width / 2,
               summary.loc[a].values, width, color=color,
               label=APPROACH_LABEL.get(a, a), linewidth=0)
    ax.set_xticks(x)
    ax.set_xticklabels([p.replace("_", "-") for p in PROBE_ORDER])
    ax.set_ylim(0, 1.05)
    ax.set_ylabel("Mean EM across seeds")
    ax.set_title("EM by probe type", loc="left", pad=10, weight="bold")
    ax.legend(loc="upper right", frameon=False, fontsize=7, ncol=2)
    ax.grid(True, alpha=0.25, axis="y", linewidth=0.5)
    fig.savefig(out)
    plt.close(fig)


def make_win_loss(per_q: pd.DataFrame, out: Path) -> None:
    approaches = sorted(per_q["approach"].unique(),
                        key=lambda a: per_q[per_q["approach"] == a]["f1"].mean(),
                        reverse=True)
    # For each pair (a, b), compute the fraction of (qid, seed) where a's EM > b's EM.
    # We compare same (qid, seed) tuples — but seeds are independent across approaches,
    # so pair on qid only and average across the cross product of seeds.
    grades_by_pair: dict[tuple[str, str], tuple[int, int, int]] = defaultdict(lambda: (0, 0, 0))
    by_approach_qid = defaultdict(lambda: defaultdict(list))
    for _, r in per_q.iterrows():
        by_approach_qid[r["approach"]][r["qid"]].append(r["em"])
    for a in approaches:
        for b in approaches:
            if a == b:
                grades_by_pair[(a, b)] = (0, 0, 0)
                continue
            w = l = t = 0
            for qid, a_ems in by_approach_qid[a].items():
                b_ems = by_approach_qid[b].get(qid, [])
                if not b_ems:
                    continue
                a_mean = np.mean(a_ems)
                b_mean = np.mean(b_ems)
                if a_mean > b_mean:
                    w += 1
                elif b_mean > a_mean:
                    l += 1
                else:
                    t += 1
            grades_by_pair[(a, b)] = (w, l, t)

    n = len(approaches)
    grid = np.zeros((n, n))
    for i, a in enumerate(approaches):
        for j, b in enumerate(approaches):
            if i == j:
                grid[i, j] = np.nan
            else:
                w, l, t = grades_by_pair[(a, b)]
                grid[i, j] = (w - l) / max(1, w + l + t)

    fig, ax = plt.subplots(figsize=(5.8, 5.0))
    im = ax.imshow(grid, cmap="RdBu_r", vmin=-1, vmax=1, aspect="auto")
    ax.set_xticks(np.arange(n))
    ax.set_yticks(np.arange(n))
    ax.set_xticklabels([APPROACH_LABEL.get(a, a) for a in approaches], rotation=45, ha="right")
    ax.set_yticklabels([APPROACH_LABEL.get(a, a) for a in approaches])
    for i in range(n):
        for j in range(n):
            if np.isnan(grid[i, j]):
                ax.text(j, i, "—", ha="center", va="center", color="#86868b", fontsize=8)
            else:
                v = grid[i, j]
                ax.text(j, i, f"{v:+.2f}",
                        ha="center", va="center",
                        color="#1d1d1f" if abs(v) < 0.5 else "white",
                        fontsize=7.5)
    ax.set_title("Head-to-head margin on EM (row − column)", loc="left", pad=10, weight="bold")
    cbar = fig.colorbar(im, ax=ax, shrink=0.7)
    cbar.set_label("Net margin", fontsize=8)
    fig.savefig(out)
    plt.close(fig)


def main() -> int:
    _setup_style()
    tbl = Path("paper/tables")
    fig_dir = Path("paper/figures")
    fig_dir.mkdir(parents=True, exist_ok=True)

    headline = pd.read_csv(tbl / "sweep_headline.csv")
    per_q = pd.read_csv(tbl / "sweep_per_question.csv")

    make_pareto(headline, fig_dir / "pareto_cost_quality.pdf")
    make_forest(headline, "em", fig_dir / "forest_em.pdf")
    make_forest(headline, "f1", fig_dir / "forest_f1.pdf")
    make_per_probe(per_q, fig_dir / "per_probe_em.pdf")
    make_win_loss(per_q, fig_dir / "win_loss.pdf")

    print(f"Wrote 5 PDFs to {fig_dir}/")
    for p in sorted(fig_dir.glob("*.pdf")):
        print(f"  {p}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
