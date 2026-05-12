"""Generate additional paper figures beyond the 5 in make_paper_figures.py.

Adds:
  paper/figures/cost_quality_quadrant.pdf  — Pareto with quadrant labels for non-technical readers
  paper/figures/probe_heatmap.pdf          — approach × probe-type F1 heatmap
  paper/figures/cost_bar.pdf               — per-approach cost (USD) bars
  paper/figures/seed_variance.pdf          — std bars showing per-approach seed-to-seed variance
  paper/figures/honesty.pdf                — hallucination accuracy vs factoid accuracy 2D map
"""
from __future__ import annotations

from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from matplotlib.patches import FancyBboxPatch


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


def make_cost_quality_quadrant(headline: pd.DataFrame, out: Path) -> None:
    """Pareto scatter with quadrant labels (Best / Premium / Budget / Avoid)."""
    fig, ax = plt.subplots(figsize=(6.2, 4.0))
    cost_mid = headline["cost_mean"].median()
    f1_mid = headline["f1_seed_mean"].median()

    # Quadrant backgrounds.
    xmin, xmax = 0, headline["cost_mean"].max() * 1.12
    ymin, ymax = headline["f1_seed_mean"].min() * 0.9, 1.0
    ax.axvspan(xmin, cost_mid, ymin=(f1_mid - ymin) / (ymax - ymin), ymax=1,
               facecolor="#2d6a4f", alpha=0.06, zorder=0)
    ax.axvspan(cost_mid, xmax, ymin=(f1_mid - ymin) / (ymax - ymin), ymax=1,
               facecolor="#b8761a", alpha=0.05, zorder=0)
    ax.axvspan(xmin, cost_mid, ymin=0, ymax=(f1_mid - ymin) / (ymax - ymin),
               facecolor="#6b7280", alpha=0.04, zorder=0)
    ax.axvspan(cost_mid, xmax, ymin=0, ymax=(f1_mid - ymin) / (ymax - ymin),
               facecolor="#cf4520", alpha=0.06, zorder=0)

    # Quadrant labels.
    ax.text(cost_mid * 0.05, ymax - 0.02, "BEST VALUE", fontsize=8,
            color="#2d6a4f", weight="bold", alpha=0.55)
    ax.text(cost_mid * 1.05, ymax - 0.02, "PREMIUM", fontsize=8,
            color="#8b5a1a", weight="bold", alpha=0.55)
    ax.text(cost_mid * 0.05, ymin + 0.01, "BUDGET / BASIC", fontsize=8,
            color="#4b5563", weight="bold", alpha=0.55)
    ax.text(cost_mid * 1.05, ymin + 0.01, "DOMINATED", fontsize=8,
            color="#cf4520", weight="bold", alpha=0.55)

    # Median guides.
    ax.axvline(cost_mid, color="#86868b", linewidth=0.4, linestyle="--", alpha=0.7)
    ax.axhline(f1_mid, color="#86868b", linewidth=0.4, linestyle="--", alpha=0.7)

    for _, row in headline.iterrows():
        color = APPROACH_COLOR.get(row["approach"], "#000000")
        ax.errorbar(
            row["cost_mean"], row["f1_seed_mean"],
            yerr=row["f1_seed_std"],
            fmt="o", color=color, markersize=8,
            elinewidth=1.0, capsize=2.5, capthick=0.8,
        )
        # Offset label to avoid overlapping the dot.
        ax.annotate(
            APPROACH_LABEL.get(row["approach"], row["approach"]),
            (row["cost_mean"], row["f1_seed_mean"]),
            xytext=(8, 6), textcoords="offset points",
            fontsize=8, color="#1d1d1f", weight="medium",
        )

    ax.set_xlim(xmin, xmax)
    ax.set_ylim(ymin, ymax)
    ax.set_xlabel("Cost per full eval-set run (USD)")
    ax.set_ylabel("Token F1 (higher = better)")
    ax.set_title("Cost vs quality — where each approach sits", loc="left", pad=10, weight="bold")
    ax.grid(True, alpha=0.2, axis="y", linewidth=0.4)
    fig.savefig(out)
    plt.close(fig)


def make_probe_heatmap(per_q: pd.DataFrame, out: Path) -> None:
    """Heatmap: approach (rows, sorted by overall F1) × probe-type (columns), cells = F1."""
    PROBE_ORDER = ["sanity", "hallucination", "needle", "multi_hop", "distractor"]
    approaches = (
        per_q.groupby("approach")["f1"].mean().sort_values(ascending=False).index.tolist()
    )
    grid = (
        per_q.groupby(["approach", "type"])["f1"].mean()
        .unstack().reindex(index=approaches, columns=PROBE_ORDER)
    )

    fig, ax = plt.subplots(figsize=(6.4, 3.8))
    im = ax.imshow(grid.values, cmap="RdYlGn", vmin=0, vmax=1, aspect="auto")
    ax.set_xticks(np.arange(len(PROBE_ORDER)))
    ax.set_yticks(np.arange(len(approaches)))
    ax.set_xticklabels([p.replace("_", "-").title() for p in PROBE_ORDER])
    ax.set_yticklabels([APPROACH_LABEL.get(a, a) for a in approaches])
    plt.setp(ax.get_xticklabels(), rotation=0)

    for i in range(len(approaches)):
        for j in range(len(PROBE_ORDER)):
            v = grid.values[i, j]
            ax.text(j, i, f"{v:.2f}",
                    ha="center", va="center",
                    color="#1d1d1f" if 0.3 < v < 0.85 else "white" if v < 0.3 else "#1d1d1f",
                    fontsize=8.5, weight="medium")
    ax.set_title("Token F1 by probe type — where each approach excels", loc="left", pad=10, weight="bold")
    cbar = fig.colorbar(im, ax=ax, shrink=0.7)
    cbar.set_label("F1", fontsize=8)
    fig.savefig(out)
    plt.close(fig)


def make_cost_bar(headline: pd.DataFrame, out: Path) -> None:
    """Horizontal cost bar chart, sorted ascending, with F1 annotated."""
    df = headline.sort_values("cost_mean", ascending=True)
    fig, ax = plt.subplots(figsize=(6.4, 3.4))
    ys = np.arange(len(df))
    colors = [APPROACH_COLOR.get(a, "#000") for a in df["approach"]]
    bars = ax.barh(ys, df["cost_mean"], color=colors, edgecolor="none")
    for bar, f1, em in zip(bars, df["f1_seed_mean"], df["em_seed_mean"]):
        w = bar.get_width()
        ax.annotate(
            f"  F1 {f1:.3f}   EM {em:.3f}",
            xy=(w, bar.get_y() + bar.get_height() / 2),
            va="center", ha="left", fontsize=8, color="#1d1d1f",
        )
    ax.set_yticks(ys)
    ax.set_yticklabels([APPROACH_LABEL.get(a, a) for a in df["approach"]])
    ax.set_xlabel("Cost per full eval-set run (USD)")
    ax.set_title("How much does each approach cost?", loc="left", pad=10, weight="bold")
    ax.set_xlim(0, df["cost_mean"].max() * 1.35)
    ax.grid(True, alpha=0.2, axis="x", linewidth=0.4)
    fig.savefig(out)
    plt.close(fig)


def make_seed_variance(headline: pd.DataFrame, out: Path) -> None:
    """Bar chart of F1 std per approach — visualizing seed-to-seed reliability."""
    df = headline.sort_values("f1_seed_std", ascending=True)
    fig, ax = plt.subplots(figsize=(6.2, 3.0))
    ys = np.arange(len(df))
    colors = [APPROACH_COLOR.get(a, "#000") for a in df["approach"]]
    ax.barh(ys, df["f1_seed_std"], color=colors, edgecolor="none")
    ax.set_yticks(ys)
    ax.set_yticklabels([APPROACH_LABEL.get(a, a) for a in df["approach"]])
    ax.set_xlabel("F1 standard deviation across 3 seeds (lower = more reliable)")
    ax.set_title("How much do results vary run to run?", loc="left", pad=10, weight="bold")
    ax.grid(True, alpha=0.2, axis="x", linewidth=0.4)
    fig.savefig(out)
    plt.close(fig)


def make_honesty_plot(per_q: pd.DataFrame, out: Path) -> None:
    """2D plot: factoid accuracy (x) vs refusal-on-absent accuracy (y).

    Top-right = honest AND capable. Top-left = honest but limited. Bottom-right
    = capable but hallucinates. Bottom-left = useless.
    """
    factoid_acc = (
        per_q[per_q["type"] != "hallucination"]
        .groupby("approach")["em"].mean()
    )
    halluc_acc = (
        per_q[per_q["type"] == "hallucination"]
        .groupby("approach")["em"].mean()
    )

    fig, ax = plt.subplots(figsize=(5.4, 4.2))

    # Quadrant guides.
    ax.axvspan(0, 0.5, ymin=0, ymax=1, alpha=0)
    ax.axhline(0.5, color="#86868b", linewidth=0.4, linestyle="--", alpha=0.6)
    ax.axvline(0.5, color="#86868b", linewidth=0.4, linestyle="--", alpha=0.6)

    ax.text(0.05, 0.96, "Honest but limited", fontsize=8, color="#4b5563", alpha=0.6)
    ax.text(0.78, 0.96, "BOTH honest and\ncapable (best)", fontsize=8, color="#2d6a4f", weight="bold", alpha=0.7)
    ax.text(0.05, 0.04, "Useless", fontsize=8, color="#cf4520", alpha=0.6)
    ax.text(0.78, 0.04, "Capable but\nfabricates", fontsize=8, color="#cf4520", alpha=0.6)

    for approach in factoid_acc.index:
        x = factoid_acc[approach]
        y = halluc_acc.get(approach, 0)
        color = APPROACH_COLOR.get(approach, "#000")
        ax.scatter(x, y, s=90, c=color, edgecolors="none", zorder=3)
        ax.annotate(
            APPROACH_LABEL.get(approach, approach),
            (x, y), xytext=(8, 6), textcoords="offset points",
            fontsize=8, color="#1d1d1f",
        )

    ax.set_xlim(0, 1)
    ax.set_ylim(-0.04, 1.04)
    ax.set_xlabel("Factoid accuracy (EM on questions whose answer IS in the corpus)")
    ax.set_ylabel("Honesty (correct refusal on questions whose answer is NOT)")
    ax.set_title("The trust map — can you trust each approach?",
                 loc="left", pad=10, weight="bold")
    ax.grid(True, alpha=0.2, linewidth=0.4)
    fig.savefig(out)
    plt.close(fig)


def make_approach_diagram(out: Path) -> None:
    """Stylized side-by-side pipeline diagrams for each approach.

    A single-page figure with 7 horizontal lanes. Each lane shows the steps
    that approach goes through: e.g. naive = (Embed query) → (Retrieve top-5)
    → (Generate). Designed to give a non-technical reader an at-a-glance
    sense of what each approach actually DOES.
    """
    fig, ax = plt.subplots(figsize=(7.0, 6.0))
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 8)
    ax.set_aspect("equal")
    ax.axis("off")

    rows = [
        ("Naive RAG", ["Embed query", "Top-5 chunks", "Answer"]),
        ("Hybrid RAG", ["Embed + BM25", "Fuse (RRF)", "Top-5 chunks", "Answer"]),
        ("HyDE", ["Hypothetical answer", "Embed hypothesis", "Top-5 chunks", "Answer"]),
        ("Reranker", ["Top-20 chunks", "Cross-encoder", "Top-5 chunks", "Answer"]),
        ("Full-Context", ["Entire corpus", "Single LLM call"]),
        ("Recursive Summary", ["Summarize each doc", "Combine summaries", "Answer"]),
        ("Sliding-Window", ["Doc 1 + state", "Doc 2 + state", "Doc 3 + state", "Doc 4 + state"]),
    ]

    for ri, (label, steps) in enumerate(rows):
        y = 7.3 - ri * 1.0
        color = APPROACH_COLOR.get(label.lower().replace("-", "_").replace(" rag", "").replace(" ", "_"), "#1d1d1f")
        # Approach label on the left.
        ax.text(-0.05, y, label, ha="right", va="center",
                fontsize=9, weight="bold", color=color)
        # Steps as a row of boxes.
        n = len(steps)
        slot_w = 9.4 / max(n, 1)
        for i, step in enumerate(steps):
            x = 0.3 + i * slot_w
            box = FancyBboxPatch(
                (x, y - 0.28), slot_w * 0.85, 0.56,
                boxstyle="round,pad=0.02,rounding_size=0.08",
                linewidth=0.8, edgecolor=color, facecolor="white",
            )
            ax.add_patch(box)
            ax.text(x + slot_w * 0.85 / 2, y, step,
                    ha="center", va="center",
                    fontsize=7.5, color="#1d1d1f")
            if i < n - 1:
                ax.annotate("", xy=(x + slot_w * 0.92, y),
                            xytext=(x + slot_w * 0.85, y),
                            arrowprops=dict(arrowstyle="->", color=color, lw=0.8))

    ax.set_title("What each approach does, step by step",
                 loc="left", pad=14, weight="bold", fontsize=10)
    fig.savefig(out, bbox_inches="tight", pad_inches=0.1)
    plt.close(fig)


def main() -> int:
    _setup_style()
    tbl = Path("paper/tables")
    fig_dir = Path("paper/figures")
    fig_dir.mkdir(parents=True, exist_ok=True)

    headline = pd.read_csv(tbl / "sweep_headline.csv")
    per_q = pd.read_csv(tbl / "sweep_per_question.csv")

    make_cost_quality_quadrant(headline, fig_dir / "cost_quality_quadrant.pdf")
    make_probe_heatmap(per_q, fig_dir / "probe_heatmap.pdf")
    make_cost_bar(headline, fig_dir / "cost_bar.pdf")
    make_seed_variance(headline, fig_dir / "seed_variance.pdf")
    make_honesty_plot(per_q, fig_dir / "honesty.pdf")
    make_approach_diagram(fig_dir / "approach_diagram.pdf")

    print(f"Wrote 6 additional PDFs to {fig_dir}/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
