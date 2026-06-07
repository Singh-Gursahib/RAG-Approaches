"""IEEE-grade paper figures.

Produces a redesigned, formal academic palette suitable for a 2-column IEEE
conference paper. Outputs land under `paper/figures_ieee/`, leaving the
earlier accessible-style figures untouched so the previous draft still
compiles.

Design choices
==============
* Palette: deep ink + cool slate accents, a single warm "spotlight" hue.
  Specifically chosen to read well in print at 1-column widths and to be
  distinguishable in greyscale (luminance separation).
* Typography: serif throughout; 8pt ticks; 9pt labels; bold caps for titles.
* Sizing: single-column targets ~3.4 in wide; full-column targets ~7.0 in.
* Aesthetics: subtle grids, hairline spines, no top-right spines.
"""
from __future__ import annotations

import os
from collections import defaultdict
from pathlib import Path

import matplotlib as mpl
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from matplotlib.patches import FancyBboxPatch


OUT_DIR = Path("paper/figures_ieee")

# Formal academic palette — deep blues with a coral spotlight + earth tones.
APPROACH_COLOR = {
    "sliding_window":    "#0b2545",  # deep ink-blue
    "full_context":      "#13315c",  # navy
    "rerank":            "#2e5984",  # steel
    "naive":             "#5e6472",  # graphite
    "hyde":              "#8d6e34",  # umber
    "hybrid":            "#7a3b25",  # rust
    "recursive_summary": "#9a1f1c",  # ox-blood (the failure)
}
APPROACH_LABEL = {
    "sliding_window":    "Sliding-Window",
    "full_context":      "Full-Context",
    "rerank":            "Reranker",
    "naive":             "Naive RAG",
    "hyde":              "HyDE",
    "hybrid":            "Hybrid RAG",
    "recursive_summary": "Recursive Summary",
}

# Probe colors in a single hue family — keeps the per-probe figure calm.
PROBE_COLOR = {
    "sanity":        "#5e6472",
    "hallucination": "#9a1f1c",
    "needle":        "#13315c",
    "multi_hop":     "#2e5984",
    "distractor":    "#8d6e34",
}


def _setup_style() -> None:
    mpl.rcParams.update({
        "font.family": "serif",
        "font.serif": ["TeX Gyre Termes", "Charter", "Palatino", "DejaVu Serif"],
        "mathtext.fontset": "stix",
        "font.size": 9,
        "axes.titlesize": 9.5,
        "axes.titleweight": "bold",
        "axes.labelsize": 8.5,
        "xtick.labelsize": 7.5,
        "ytick.labelsize": 7.5,
        "legend.fontsize": 7.5,
        "axes.spines.top": False,
        "axes.spines.right": False,
        "axes.edgecolor": "#222222",
        "axes.linewidth": 0.55,
        "xtick.color": "#222222",
        "ytick.color": "#222222",
        "axes.labelcolor": "#111111",
        "grid.color": "#e2e2e2",
        "grid.linewidth": 0.4,
        "savefig.bbox": "tight",
        "savefig.pad_inches": 0.04,
        "savefig.dpi": 600,  # vector PDF but ensure raster fallbacks are crisp
    })


# ----------------------------- figures -----------------------------

def fig_pareto(headline: pd.DataFrame, out: Path, two_col: bool = False) -> None:
    """Cost × F1 Pareto.

    Strategy for clean labels: distinct marker shapes per approach + a legend.
    Inline text labels overlap badly because four cheap RAG approaches cluster
    at ~$0.01 cost and two long-context approaches cluster at ~$0.09. A legend
    is the standard IEEE solution for tightly clustered scatter points.
    """
    # Distinct marker shapes — picked for visual separation when colors are
    # similar in greyscale print. Order matters: same order as legend.
    MARKERS = {
        "full_context":      "s",   # square
        "sliding_window":    "D",   # diamond
        "rerank":            "^",   # up triangle
        "naive":             "o",   # circle
        "hyde":              "v",   # down triangle
        "hybrid":            "P",   # plus (filled)
        "recursive_summary": "X",   # cross (filled)
    }
    # Plot order = same as legend so the legend reads top-to-bottom by F1.
    order = headline.sort_values("f1_seed_mean", ascending=False)["approach"].tolist()

    fig, ax = plt.subplots(figsize=(7.0 if two_col else 3.4, 2.7))
    handles = []
    by_approach = {row["approach"]: row for _, row in headline.iterrows()}
    for approach in order:
        row = by_approach[approach]
        color = APPROACH_COLOR.get(approach, "#000")
        marker = MARKERS.get(approach, "o")
        ax.errorbar(
            row["cost_mean"], row["f1_seed_mean"],
            yerr=row["f1_seed_std"],
            fmt=marker, color=color, markersize=6.0,
            markeredgecolor="white", markeredgewidth=0.5,
            elinewidth=0.8, capsize=2.0, capthick=0.6,
        )
        # Build legend entry separately so marker edge matches.
        h = plt.Line2D([0], [0], marker=marker, color="none",
                       markerfacecolor=color, markeredgecolor="white",
                       markeredgewidth=0.5, markersize=6.0,
                       label=APPROACH_LABEL.get(approach, approach))
        handles.append(h)

    ax.set_xlim(-0.005, 0.115)
    ax.set_ylim(0.0, 1.0)
    ax.set_xlabel(r"Cost per eval run (USD)")
    ax.set_ylabel(r"Token $F_1$")
    ax.set_title("Cost--quality Pareto frontier", loc="left")
    ax.grid(True, alpha=0.5, axis="y")
    ax.set_axisbelow(True)

    # Legend in the empty mid-right area (around cost ~0.04--0.07, F1 ~0.3--0.7).
    leg = ax.legend(
        handles=handles,
        loc="center right",
        bbox_to_anchor=(0.98, 0.42),
        frameon=True, framealpha=0.92,
        edgecolor="#cccccc",
        handletextpad=0.5, borderpad=0.5,
        labelspacing=0.35,
        fontsize=7.0,
    )
    leg.get_frame().set_linewidth(0.4)

    fig.savefig(out)
    plt.close(fig)


def fig_forest(headline: pd.DataFrame, metric: str, out: Path) -> None:
    df = headline.sort_values(f"{metric}_seed_mean", ascending=True)
    fig, ax = plt.subplots(figsize=(3.4, 0.36 * len(df) + 0.7))
    ys = np.arange(len(df))
    for y, (_, row) in zip(ys, df.iterrows()):
        color = APPROACH_COLOR.get(row["approach"], "#000")
        mean = row[f"{metric}_seed_mean"]
        lo = row[f"{metric}_pooled_lo"]
        hi = row[f"{metric}_pooled_hi"]
        ax.plot([lo, hi], [y, y], color=color, linewidth=1.0, alpha=0.55, solid_capstyle="round")
        ax.plot(mean, y, "o", color=color, markersize=4.5)
        ax.annotate(f"{mean:.3f}", (mean, y),
                    xytext=(6, -2), textcoords="offset points",
                    fontsize=6.8, color="#111")
    ax.set_yticks(ys)
    ax.set_yticklabels([APPROACH_LABEL.get(a, a) for a in df["approach"]])
    ax.set_xlim(0, 1)
    metric_name = "Exact Match" if metric == "em" else r"Token $F_1$"
    ax.set_xlabel(f"{metric_name} (mean across 3 seeds; pooled 95% CI)")
    title = "Exact Match" if metric == "em" else "Token $F_1$"
    ax.set_title(f"{title} forest plot", loc="left")
    ax.grid(True, alpha=0.5, axis="x")
    ax.set_axisbelow(True)
    fig.savefig(out)
    plt.close(fig)


def fig_probe_heatmap(per_q: pd.DataFrame, out: Path) -> None:
    PROBE_ORDER = ["sanity", "hallucination", "needle", "multi_hop", "distractor"]
    approaches = (
        per_q.groupby("approach")["f1"].mean().sort_values(ascending=False).index.tolist()
    )
    grid = (
        per_q.groupby(["approach", "type"])["f1"].mean()
        .unstack().reindex(index=approaches, columns=PROBE_ORDER).values
    )

    # Build a custom navy-to-coral colormap for a formal feel.
    from matplotlib.colors import LinearSegmentedColormap
    cmap = LinearSegmentedColormap.from_list(
        "navy_to_warm", ["#0b2545", "#5e6472", "#dadada", "#c47a4a", "#c93c20"]
    )

    fig, ax = plt.subplots(figsize=(3.4, 2.6))
    im = ax.imshow(grid, cmap=cmap, vmin=0, vmax=1, aspect="auto")
    ax.set_xticks(np.arange(len(PROBE_ORDER)))
    ax.set_yticks(np.arange(len(approaches)))
    ax.set_xticklabels([p.replace("_", "-").title() for p in PROBE_ORDER], rotation=20, ha="right")
    ax.set_yticklabels([APPROACH_LABEL.get(a, a) for a in approaches])
    for i in range(len(approaches)):
        for j in range(len(PROBE_ORDER)):
            v = grid[i, j]
            color = "white" if (v < 0.25 or v > 0.85) else "#111"
            ax.text(j, i, f"{v:.2f}", ha="center", va="center", color=color, fontsize=7.0)
    ax.set_title(r"$F_1$ by probe type", loc="left")
    cbar = fig.colorbar(im, ax=ax, fraction=0.038, pad=0.03)
    cbar.set_label(r"$F_1$", fontsize=7.5)
    cbar.ax.tick_params(labelsize=7)
    fig.savefig(out)
    plt.close(fig)


def fig_cost_bar(headline: pd.DataFrame, out: Path) -> None:
    df = headline.sort_values("cost_mean", ascending=True)
    fig, ax = plt.subplots(figsize=(3.4, 2.6))
    ys = np.arange(len(df))
    colors = [APPROACH_COLOR.get(a, "#000") for a in df["approach"]]
    bars = ax.barh(ys, df["cost_mean"], color=colors, edgecolor="none", height=0.7)
    for bar, f1, em in zip(bars, df["f1_seed_mean"], df["em_seed_mean"]):
        w = bar.get_width()
        ax.annotate(
            f"  $F_1$={f1:.3f}  EM={em:.3f}",
            xy=(w, bar.get_y() + bar.get_height() / 2),
            va="center", ha="left", fontsize=6.8, color="#111",
        )
    ax.set_yticks(ys)
    ax.set_yticklabels([APPROACH_LABEL.get(a, a) for a in df["approach"]])
    ax.set_xlabel("Cost per eval run (USD)")
    ax.set_title("Per-approach cost", loc="left")
    ax.set_xlim(0, df["cost_mean"].max() * 1.55)
    ax.grid(True, alpha=0.5, axis="x")
    ax.set_axisbelow(True)
    fig.savefig(out)
    plt.close(fig)


def fig_seed_variance(headline: pd.DataFrame, out: Path) -> None:
    df = headline.sort_values("f1_seed_std", ascending=True)
    fig, ax = plt.subplots(figsize=(3.4, 2.2))
    ys = np.arange(len(df))
    colors = [APPROACH_COLOR.get(a, "#000") for a in df["approach"]]
    ax.barh(ys, df["f1_seed_std"], color=colors, edgecolor="none", height=0.7)
    ax.set_yticks(ys)
    ax.set_yticklabels([APPROACH_LABEL.get(a, a) for a in df["approach"]])
    ax.set_xlabel(r"$F_1$ std across 3 seeds")
    ax.set_title("Seed-to-seed reliability", loc="left")
    ax.grid(True, alpha=0.5, axis="x")
    ax.set_axisbelow(True)
    fig.savefig(out)
    plt.close(fig)


def fig_honesty(per_q: pd.DataFrame, out: Path) -> None:
    """Honesty vs capability scatter.

    Strategy: distinct marker shapes per approach + a legend. Six approaches
    cluster at the top-right ``honest and capable'' regime so inline labels
    are infeasible; only the Recursive Summary outlier sits alone.
    """
    factoid_acc = (
        per_q[per_q["type"] != "hallucination"]
        .groupby("approach")["em"].mean()
    )
    halluc_acc = (
        per_q[per_q["type"] == "hallucination"]
        .groupby("approach")["em"].mean()
    )
    MARKERS = {
        "full_context":      "s",
        "sliding_window":    "D",
        "rerank":            "^",
        "naive":             "o",
        "hyde":              "v",
        "hybrid":            "P",
        "recursive_summary": "X",
    }
    # Legend order = best-to-worst factoid accuracy.
    order = factoid_acc.sort_values(ascending=False).index.tolist()

    fig, ax = plt.subplots(figsize=(3.4, 3.1))
    ax.axhline(0.5, color="#bbbbbb", linewidth=0.4, linestyle=":")
    ax.axvline(0.5, color="#bbbbbb", linewidth=0.4, linestyle=":")
    # Quadrant labels in corners, away from data points.
    ax.text(0.02, 0.97, "honest but limited", fontsize=6.3,
            color="#5e6472", alpha=0.75, va="top")
    ax.text(0.98, 0.97, "honest & capable", fontsize=6.3,
            color="#0b2545", weight="bold", alpha=0.85, ha="right", va="top")
    ax.text(0.02, 0.03, "low quality", fontsize=6.3,
            color="#9a1f1c", alpha=0.75, va="bottom")
    ax.text(0.98, 0.03, "fabricates", fontsize=6.3,
            color="#9a1f1c", alpha=0.75, ha="right", va="bottom")

    handles = []
    for approach in order:
        x = factoid_acc[approach]
        y = halluc_acc.get(approach, 0)
        color = APPROACH_COLOR.get(approach, "#000")
        marker = MARKERS.get(approach, "o")
        ax.scatter(x, y, s=55, c=color, marker=marker,
                   edgecolors="white", linewidth=0.6, zorder=3)
        h = plt.Line2D([0], [0], marker=marker, color="none",
                       markerfacecolor=color, markeredgecolor="white",
                       markeredgewidth=0.5, markersize=6.0,
                       label=APPROACH_LABEL.get(approach, approach))
        handles.append(h)

    ax.set_xlim(0, 1)
    ax.set_ylim(-0.02, 1.06)
    ax.set_xlabel("Factoid accuracy (EM on answerable Qs)")
    ax.set_ylabel("Honesty (refusal on unanswerable Qs)")
    ax.set_title("Honesty vs capability", loc="left")
    ax.grid(True, alpha=0.5)
    ax.set_axisbelow(True)

    # Legend placed in the empty mid-left region (factoid 0--0.5, honesty ~0.5).
    leg = ax.legend(
        handles=handles,
        loc="center left",
        bbox_to_anchor=(0.03, 0.55),
        frameon=True, framealpha=0.92,
        edgecolor="#cccccc",
        handletextpad=0.5, borderpad=0.45,
        labelspacing=0.32,
        fontsize=6.5,
    )
    leg.get_frame().set_linewidth(0.4)

    fig.savefig(out)
    plt.close(fig)


def fig_win_loss(per_q: pd.DataFrame, out: Path) -> None:
    approaches = (
        per_q.groupby("approach")["f1"].mean().sort_values(ascending=False).index.tolist()
    )
    by_approach_qid = defaultdict(lambda: defaultdict(list))
    for _, r in per_q.iterrows():
        by_approach_qid[r["approach"]][r["qid"]].append(r["em"])

    n = len(approaches)
    grid = np.zeros((n, n))
    for i, a in enumerate(approaches):
        for j, b in enumerate(approaches):
            if i == j:
                grid[i, j] = np.nan
                continue
            wins = losses = ties = 0
            for qid in by_approach_qid[a]:
                a_em = float(np.mean(by_approach_qid[a][qid]))
                b_em = float(np.mean(by_approach_qid[b].get(qid, [])))
                if a_em > b_em: wins += 1
                elif b_em > a_em: losses += 1
                else: ties += 1
            grid[i, j] = (wins - losses) / max(1, wins + losses + ties)

    from matplotlib.colors import LinearSegmentedColormap
    cmap = LinearSegmentedColormap.from_list(
        "loss_to_win", ["#9a1f1c", "#cf7a52", "#f7f4ef", "#5e7da7", "#0b2545"]
    )

    fig, ax = plt.subplots(figsize=(3.4, 3.0))
    im = ax.imshow(grid, cmap=cmap, vmin=-1, vmax=1, aspect="auto")
    ax.set_xticks(np.arange(n))
    ax.set_yticks(np.arange(n))
    ax.set_xticklabels([APPROACH_LABEL[a] for a in approaches], rotation=45, ha="right")
    ax.set_yticklabels([APPROACH_LABEL[a] for a in approaches])
    for i in range(n):
        for j in range(n):
            if np.isnan(grid[i, j]):
                ax.text(j, i, "--", ha="center", va="center", color="#888", fontsize=7)
            else:
                v = grid[i, j]
                color = "white" if abs(v) > 0.5 else "#111"
                ax.text(j, i, f"{v:+.2f}", ha="center", va="center", color=color, fontsize=6.5)
    ax.set_title("Head-to-head margin (row $-$ column, EM)", loc="left")
    cbar = fig.colorbar(im, ax=ax, fraction=0.038, pad=0.03)
    cbar.set_label("Net margin", fontsize=7.5)
    cbar.ax.tick_params(labelsize=7)
    fig.savefig(out)
    plt.close(fig)


def fig_approach_diagram(out: Path) -> None:
    fig, ax = plt.subplots(figsize=(7.0, 3.6))
    ax.set_xlim(0, 11)
    ax.set_ylim(0, 8.4)
    ax.axis("off")

    rows = [
        ("naive_window", "Naive RAG", ["Embed query", "Dense top-5", "Generate"]),
        ("hybrid", "Hybrid RAG", ["Embed + BM25", "RRF fuse", "Top-5", "Generate"]),
        ("hyde", "HyDE", ["Hypothetical answer", "Embed", "Top-5", "Generate"]),
        ("rerank", "Reranker", ["Dense top-20", "Cross-encoder", "Top-5", "Generate"]),
        ("full_context", "Full-Context", ["Entire corpus", "Single generate"]),
        ("recursive_summary", "Recursive Summary", ["Per-doc summary", "Combine", "Generate"]),
        ("sliding_window", "Sliding-Window", ["Doc 1 + state", "Doc 2 + state", "Doc 3 + state", "Doc 4 + state"]),
    ]

    for ri, (key, label, steps) in enumerate(rows):
        y = 7.6 - ri * 1.08
        color = APPROACH_COLOR.get(key, "#0b2545")
        ax.text(-0.1, y, label, ha="right", va="center",
                fontsize=8.5, weight="bold", color=color)
        n = len(steps)
        usable_w = 10.6
        slot_w = usable_w / max(n, 1)
        for i, step in enumerate(steps):
            x = 0.4 + i * slot_w
            box = FancyBboxPatch(
                (x, y - 0.32), slot_w * 0.86, 0.62,
                boxstyle="round,pad=0.02,rounding_size=0.06",
                linewidth=0.55, edgecolor=color, facecolor="white",
            )
            ax.add_patch(box)
            ax.text(x + slot_w * 0.86 / 2, y, step,
                    ha="center", va="center",
                    fontsize=7.3, color="#111")
            if i < n - 1:
                ax.annotate("", xy=(x + slot_w * 0.92, y),
                            xytext=(x + slot_w * 0.87, y),
                            arrowprops=dict(arrowstyle="->", color=color, lw=0.7))

    ax.set_title("Pipeline steps for each approach (left to right)",
                 loc="left", weight="bold", fontsize=9.5, pad=8)
    fig.savefig(out, bbox_inches="tight", pad_inches=0.06)
    plt.close(fig)


def main() -> int:
    _setup_style()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    tbl = Path("paper/tables")
    headline = pd.read_csv(tbl / "sweep_headline.csv")
    per_q = pd.read_csv(tbl / "sweep_per_question.csv")

    fig_pareto(headline, OUT_DIR / "pareto.pdf", two_col=False)
    fig_pareto(headline, OUT_DIR / "pareto_wide.pdf", two_col=True)
    fig_forest(headline, "em", OUT_DIR / "forest_em.pdf")
    fig_forest(headline, "f1", OUT_DIR / "forest_f1.pdf")
    fig_probe_heatmap(per_q, OUT_DIR / "probe_heatmap.pdf")
    fig_cost_bar(headline, OUT_DIR / "cost_bar.pdf")
    fig_seed_variance(headline, OUT_DIR / "seed_variance.pdf")
    fig_honesty(per_q, OUT_DIR / "honesty.pdf")
    fig_win_loss(per_q, OUT_DIR / "win_loss.pdf")
    fig_approach_diagram(OUT_DIR / "pipelines.pdf")

    print(f"Wrote 10 IEEE-style PDFs to {OUT_DIR}/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
