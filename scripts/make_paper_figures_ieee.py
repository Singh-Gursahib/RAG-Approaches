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
* No overlapping points: scatter plots use a log cost axis and labels that are
  pushed apart with leader lines; categorical comparisons use dot plots with a
  fixed offset per model instead of a shared scatter.

Cross-model figures compare the paper's Gemini 3 Flash sweep with the GLM 5.3
Flash replication exported by `scripts/export_cross_model_tables.py`. They are
skipped when those tables are absent.
"""
from __future__ import annotations

from collections import defaultdict
from pathlib import Path

import matplotlib as mpl
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from matplotlib.colors import LinearSegmentedColormap
from matplotlib.patches import FancyBboxPatch
from matplotlib.ticker import FuncFormatter, LogLocator, NullFormatter


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
# Distinct marker shapes, for greyscale print.
MARKERS = {
    "full_context":      "s",
    "sliding_window":    "D",
    "rerank":            "^",
    "naive":             "o",
    "hyde":              "v",
    "hybrid":            "P",
    "recursive_summary": "X",
}
# The two generators in cross-model figures.
MODEL_STYLE = {
    "gemini": {"label": "Gemini 3 Flash", "color": "#13315c", "marker": "o"},
    "glm":    {"label": "GLM 5.3 Flash",  "color": "#c0582b", "marker": "^"},
}
HEADROOM_LABEL = "Full-Context, reasoning headroom"

# Probe colors in a single hue family — keeps the per-probe figure calm.
PROBE_COLOR = {
    "sanity":        "#5e6472",
    "hallucination": "#9a1f1c",
    "needle":        "#13315c",
    "multi_hop":     "#2e5984",
    "distractor":    "#8d6e34",
}
PROBE_ORDER = ["sanity", "hallucination", "needle", "multi_hop", "distractor"]


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


# ----------------------------- helpers -----------------------------

def _boxes_overlap(a: tuple, b: tuple, pad: float = 1.0) -> bool:
    return not (a[2] + pad <= b[0] or b[2] + pad <= a[0] or a[3] + pad <= b[1] or b[3] + pad <= a[1])


def _box_point_distance(box: tuple, x: float, y: float) -> float:
    dx = max(box[0] - x, 0.0, x - box[2])
    dy = max(box[1] - y, 0.0, y - box[3])
    return float(np.hypot(dx, dy))


def _repel_labels(ax, points: list[dict], fontsize: float = 6.6, marker_px: float = 5.0) -> None:
    """Label points so that no label overlaps another label or any marker.

    Labels are placed one at a time (top to bottom). Each tries positions to
    the right of its point, then to the left, stepping further up or down, and
    takes the closest position that clears every marker and every label
    already placed. A hairline leader joins a label that ended up away from
    its point. Axis limits must be final before calling.
    """
    fig = ax.figure
    fig.canvas.draw()
    renderer = fig.canvas.get_renderer()
    to_display = ax.transData.transform
    to_data = ax.transData.inverted().transform
    bounds = ax.get_window_extent(renderer)
    scale = fig.dpi / 72
    offset, marker = 5.0 * scale, marker_px * scale

    anchors = [to_display((p["x"], p["y"])) for p in points]
    obstacles = [(x - marker, y - marker, x + marker, y + marker) for x, y in anchors]
    placed: list[tuple] = []
    order = sorted(range(len(points)), key=lambda i: -anchors[i][1])

    for i in order:
        p, (px, py) = points[i], anchors[i]
        probe = ax.text(0, 0, p["text"], fontsize=fontsize)
        box = probe.get_window_extent(renderer)
        probe.remove()
        w, h = box.width, box.height
        step = h * 0.55

        def search(max_k: int, strict: bool):
            for k in range(0, max_k):
                for dy in ((0.0,) if k == 0 else (k * step, -k * step)):
                    for side in (1, -1):
                        x0 = px + offset if side == 1 else px - offset - w
                        cand = (x0, py + dy - h / 2, x0 + w, py + dy + h / 2)
                        if cand[0] < bounds.x0 or cand[2] > bounds.x1 or cand[1] < bounds.y0 or cand[3] > bounds.y1:
                            continue
                        if any(_boxes_overlap(cand, o) for o in obstacles) or any(_boxes_overlap(cand, q) for q in placed):
                            continue
                        # Without a leader line, a label must sit closer to its own point
                        # than to any other point, so it can't be read as a neighbour's.
                        if strict:
                            own = _box_point_distance(cand, px, py)
                            if any(_box_point_distance(cand, ox, oy) < own + 2.0 * scale
                                   for j, (ox, oy) in enumerate(anchors) if j != i):
                                continue
                        return cand, side, dy
            return None

        best, leader = search(8, strict=True), False
        if best is None:  # crowded: move further out and connect the label with a leader line
            best, leader = search(40, strict=False), True
        if best is None:
            best, leader = ((px + offset, py - h / 2, px + offset + w, py + h / 2), 1, 0.0), False
        cand, side, dy = best
        placed.append(cand)
        anchor_x = cand[0] if side == 1 else cand[2]
        tx, ty = to_data((anchor_x, py + dy))
        ax.text(tx, ty, p["text"], fontsize=fontsize, color=p.get("color", "#111"),
                ha="left" if side == 1 else "right", va="center", zorder=6)
        if leader or abs(dy) > h * 0.3:
            ex, ey = to_data((anchor_x - 1.0 * side * scale, py + dy))
            ax.plot([p["x"], ex], [p["y"], ey], color="#8a8a8a", linewidth=0.45, zorder=5)


def _dodge(ax, xs: list[float], ys: list[float], min_px: float = 8.0) -> list[float]:
    """Nudge x positions apart (in display space) for markers that would overlap.

    Only used on log-cost scatter plots; exact costs are reported in the tables.
    """
    fig = ax.figure
    to_display = ax.transData.transform
    to_data = ax.transData.inverted().transform
    limit = min_px * fig.dpi / 72
    disp = [list(to_display((x, y))) for x, y in zip(xs, ys)]
    for _ in range(50):
        moved = False
        for i in range(len(disp)):
            for j in range(i + 1, len(disp)):
                dx, dy = disp[j][0] - disp[i][0], disp[j][1] - disp[i][1]
                if abs(dx) < limit and abs(dy) < limit:
                    push = (limit - abs(dx)) / 2 + 0.1
                    direction = 1 if dx >= 0 else -1
                    disp[i][0] -= push * direction
                    disp[j][0] += push * direction
                    moved = True
        if not moved:
            break
    return [to_data(tuple(d))[0] for d in disp]


def _usd_log_axis(ax, lo: float, hi: float) -> None:
    ax.set_xscale("log")
    ax.set_xlim(lo, hi)
    ax.xaxis.set_major_locator(LogLocator(base=10, subs=(1.0, 2.0, 5.0)))
    ax.xaxis.set_minor_formatter(NullFormatter())
    ax.xaxis.set_major_formatter(FuncFormatter(lambda v, _: f"${v:g}"))


def _pareto_panel(ax, df: pd.DataFrame, title: str, headroom: pd.DataFrame | None = None) -> None:
    ax.set_ylim(0.1, 1.0)
    ax.set_autoscale_on(False)
    ax.figure.canvas.draw()

    rows = [(row["approach"], row, False) for _, row in df.iterrows()]
    if headroom is not None and len(headroom):
        rows.append(("full_context", headroom.iloc[0], True))
    xs = _dodge(ax, [r["cost_mean"] for _, r, _ in rows], [r["f1_seed_mean"] for _, r, _ in rows])

    points = []
    for (approach, row, hollow), x in zip(rows, xs):
        color = APPROACH_COLOR[approach]
        style = dict(markerfacecolor="white", markeredgecolor=color, markeredgewidth=0.9) if hollow else \
            dict(markeredgecolor="white", markeredgewidth=0.45)
        ax.errorbar(x, row["f1_seed_mean"], yerr=row["f1_seed_std"], fmt=MARKERS[approach], color=color,
                    markersize=5.0, elinewidth=0.7, capsize=1.6, capthick=0.5, zorder=4, **style)
        points.append({"x": x, "y": row["f1_seed_mean"], "text": HEADROOM_LABEL if hollow else APPROACH_LABEL[approach],
                       "color": color})
    if headroom is not None and len(headroom):
        base_i = next(i for i, (a, _, hollow) in enumerate(rows) if a == "full_context" and not hollow)
        head_i = len(rows) - 1
        ax.annotate("", xy=(xs[head_i], rows[head_i][1]["f1_seed_mean"]),
                    xytext=(xs[base_i], rows[base_i][1]["f1_seed_mean"]),
                    arrowprops=dict(arrowstyle="->", color=APPROACH_COLOR["full_context"], lw=0.6,
                                    linestyle="--", shrinkA=5, shrinkB=5),
                    zorder=3)
    ax.set_xlabel("Cost per eval run (USD, log scale)")
    ax.set_title(title, loc="left")
    ax.grid(True, alpha=0.5, which="major")
    ax.set_axisbelow(True)
    _repel_labels(ax, points)


def _probe_grid(per_q: pd.DataFrame, approaches: list[str]) -> np.ndarray:
    return (
        per_q.groupby(["approach", "type"])["f1"].mean()
        .unstack().reindex(index=approaches, columns=PROBE_ORDER).values
    )


# ----------------------------- figures -----------------------------

def fig_pareto(headline: pd.DataFrame, out: Path, two_col: bool = False) -> None:
    """Cost × F1 for the paper sweep, with directly labelled points."""
    fig, ax = plt.subplots(figsize=(7.0 if two_col else 3.4, 2.8))
    # Extra room on the left lets labels of the cheapest points sit beside them.
    _usd_log_axis(ax, headline["cost_mean"].min() / 3.0, headline["cost_mean"].max() * 2.6)
    _pareto_panel(ax, headline, "Cost–quality trade-off")
    ax.set_ylabel(r"Token $F_1$")
    fig.savefig(out)
    plt.close(fig)


def fig_pareto_cross_model(gem: pd.DataFrame, glm: pd.DataFrame, headroom: pd.DataFrame, out: Path) -> None:
    """Side-by-side cost × F1 for both generators on a shared log cost axis."""
    costs = pd.concat([gem["cost_mean"], glm["cost_mean"], headroom["cost_mean"]])
    lo, hi = costs.min() / 3.0, costs.max() * 3.2  # left room for labels of the cheapest points
    fig, axes = plt.subplots(1, 2, figsize=(7.0, 2.8), sharey=True)
    for ax in axes:
        _usd_log_axis(ax, lo, hi)
    _pareto_panel(axes[0], gem, "Gemini 3 Flash (paper sweep, estimated cost)")
    _pareto_panel(axes[1], glm, "GLM 5.3 Flash (replication, billed cost)", headroom)
    axes[0].set_ylabel(r"Token $F_1$")
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


def fig_cross_model_f1(gem: pd.DataFrame, glm: pd.DataFrame, headroom: pd.DataFrame, out: Path) -> None:
    """Forest plot with both generators per strategy, plus the headroom follow-up."""
    order = gem.sort_values("f1_seed_mean", ascending=True)["approach"].tolist()
    n_rows = len(order) + 1
    fig, ax = plt.subplots(figsize=(3.4, 0.34 * n_rows + 0.95))
    offset = 0.17
    for y, approach in enumerate(order):
        for key, df, dy in (("gemini", gem, offset), ("glm", glm, -offset)):
            row = df[df["approach"] == approach].iloc[0]
            style = MODEL_STYLE[key]
            ax.plot([row["f1_pooled_lo"], row["f1_pooled_hi"]], [y + dy] * 2,
                    color=style["color"], linewidth=1.0, alpha=0.55, solid_capstyle="round")
            ax.plot(row["f1_seed_mean"], y + dy, style["marker"], color=style["color"],
                    markersize=4.3, markeredgecolor="white", markeredgewidth=0.4)
    row = headroom.iloc[0]
    style = MODEL_STYLE["glm"]
    top = len(order)
    ax.plot([row["f1_pooled_lo"], row["f1_pooled_hi"]], [top] * 2,
            color=style["color"], linewidth=1.0, alpha=0.55, solid_capstyle="round")
    ax.plot(row["f1_seed_mean"], top, style["marker"], markerfacecolor="white",
            markeredgecolor=style["color"], markeredgewidth=0.9, markersize=4.6)
    ax.axhline(top - 0.5, color="#cccccc", linewidth=0.4, linestyle=":")

    ax.set_yticks(list(range(n_rows)))
    ax.set_yticklabels([APPROACH_LABEL[a] for a in order] + ["Full-Context,\nreasoning headroom"])
    ax.set_xlim(0.0, 1.0)
    ax.set_ylim(-0.6, n_rows - 0.4)
    ax.set_xlabel(r"Token $F_1$ (mean of 3 runs; pooled 95% CI)")
    ax.set_title(r"Token $F_1$ on two generators", loc="left")
    ax.grid(True, alpha=0.5, axis="x")
    ax.set_axisbelow(True)
    handles = [
        plt.Line2D([0], [0], marker=MODEL_STYLE["gemini"]["marker"], color=MODEL_STYLE["gemini"]["color"],
                   linestyle="none", markersize=4.5, label="Gemini 3 Flash"),
        plt.Line2D([0], [0], marker=MODEL_STYLE["glm"]["marker"], color=MODEL_STYLE["glm"]["color"],
                   linestyle="none", markersize=4.5, label="GLM 5.3 Flash"),
        plt.Line2D([0], [0], marker=MODEL_STYLE["glm"]["marker"], markerfacecolor="white",
                   markeredgecolor=MODEL_STYLE["glm"]["color"], linestyle="none", markersize=4.5,
                   label="GLM 5.3 Flash, high effort"),
    ]
    leg = ax.legend(handles=handles, loc="lower left", frameon=True, framealpha=0.94,
                    edgecolor="#cccccc", fontsize=6.4, handletextpad=0.3, borderpad=0.4, labelspacing=0.3)
    leg.get_frame().set_linewidth(0.4)
    fig.savefig(out)
    plt.close(fig)


def fig_probe_heatmap(per_q: pd.DataFrame, out: Path) -> None:
    approaches = (
        per_q.groupby("approach")["f1"].mean().sort_values(ascending=False).index.tolist()
    )
    grid = _probe_grid(per_q, approaches)
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


def fig_probe_heatmap_cross_model(gem_q: pd.DataFrame, glm_q: pd.DataFrame, headroom_q: pd.DataFrame, out: Path) -> None:
    """Per-probe F1 for both generators, same row order; GLM adds the headroom follow-up."""
    approaches = gem_q.groupby("approach")["f1"].mean().sort_values(ascending=False).index.tolist()
    blank = np.full((1, len(PROBE_ORDER)), np.nan)
    grids = [
        np.vstack([_probe_grid(gem_q, approaches), blank]),
        np.vstack([_probe_grid(glm_q, approaches), _probe_grid(headroom_q, ["full_context"])]),
    ]
    labels = [APPROACH_LABEL[a] for a in approaches] + [HEADROOM_LABEL]
    cmap = LinearSegmentedColormap.from_list(
        "navy_to_warm", ["#0b2545", "#5e6472", "#dadada", "#c47a4a", "#c93c20"]
    )
    cmap.set_bad("#f3f3f3")
    fig, axes = plt.subplots(1, 2, figsize=(7.0, 2.75), sharey=True)
    for ax, grid, title in zip(axes, grids, ("Gemini 3 Flash", "GLM 5.3 Flash")):
        im = ax.imshow(np.ma.masked_invalid(grid), cmap=cmap, vmin=0, vmax=1, aspect="auto")
        ax.set_xticks(np.arange(len(PROBE_ORDER)))
        ax.set_xticklabels([p.replace("_", "-").title() for p in PROBE_ORDER], rotation=20, ha="right")
        ax.set_yticks(np.arange(len(labels)))
        ax.set_yticklabels(labels)
        ax.axhline(len(approaches) - 0.5, color="white", linewidth=1.6)
        for i in range(grid.shape[0]):
            for j in range(grid.shape[1]):
                v = grid[i, j]
                if np.isnan(v):
                    ax.text(j, i, "n/a", ha="center", va="center", color="#999999", fontsize=6.5)
                else:
                    color = "white" if (v < 0.25 or v > 0.85) else "#111"
                    ax.text(j, i, f"{v:.2f}", ha="center", va="center", color=color, fontsize=6.8)
        ax.set_title(rf"$F_1$ by probe type: {title}", loc="left")
    cbar = fig.colorbar(im, ax=axes, fraction=0.02, pad=0.02)
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


def fig_seed_variance(headline: pd.DataFrame, out: Path, glm: pd.DataFrame | None = None) -> None:
    """F1 standard deviation across runs; grouped by generator when GLM data is given."""
    if glm is None:
        df = headline.sort_values("f1_seed_std", ascending=True)
        fig, ax = plt.subplots(figsize=(3.4, 2.2))
        ys = np.arange(len(df))
        ax.barh(ys, df["f1_seed_std"], color=[APPROACH_COLOR.get(a, "#000") for a in df["approach"]],
                edgecolor="none", height=0.7)
        ax.set_yticks(ys)
        ax.set_yticklabels([APPROACH_LABEL.get(a, a) for a in df["approach"]])
    else:
        merged = headline[["approach", "f1_seed_std"]].merge(
            glm[["approach", "f1_seed_std"]], on="approach", suffixes=("_gem", "_glm"))
        merged["order"] = merged[["f1_seed_std_gem", "f1_seed_std_glm"]].max(axis=1)
        merged = merged.sort_values("order", ascending=True)
        fig, ax = plt.subplots(figsize=(3.4, 2.5))
        ys = np.arange(len(merged))
        h = 0.36
        ax.barh(ys + h / 2, merged["f1_seed_std_gem"], height=h, color=MODEL_STYLE["gemini"]["color"],
                label=MODEL_STYLE["gemini"]["label"])
        ax.barh(ys - h / 2, merged["f1_seed_std_glm"], height=h, color=MODEL_STYLE["glm"]["color"],
                label=MODEL_STYLE["glm"]["label"])
        ax.set_yticks(ys)
        ax.set_yticklabels([APPROACH_LABEL[a] for a in merged["approach"]])
        leg = ax.legend(loc="lower right", frameon=True, framealpha=0.94, edgecolor="#cccccc", fontsize=6.6)
        leg.get_frame().set_linewidth(0.4)
    ax.set_xlabel(r"$F_1$ std across 3 runs")
    ax.set_title("Run-to-run variability", loc="left")
    ax.grid(True, alpha=0.5, axis="x")
    ax.set_axisbelow(True)
    fig.savefig(out)
    plt.close(fig)


def _factoid_and_refusal(per_q: pd.DataFrame) -> tuple[pd.Series, pd.Series]:
    factoid = per_q[per_q["type"] != "hallucination"].groupby("approach")["em"].mean()
    refusal = per_q[per_q["type"] == "hallucination"].groupby("approach")["correct"].mean()
    return factoid, refusal


def fig_honesty(per_q: pd.DataFrame, out: Path, glm_q: pd.DataFrame | None = None) -> None:
    """Factoid accuracy and refusal accuracy as a dot plot, one row per approach.

    A shared scatter piles six approaches onto one point; separate columns per
    metric with a fixed vertical offset per generator keep every marker visible.
    """
    series = [("gemini", *_factoid_and_refusal(per_q))]
    if glm_q is not None:
        series.append(("glm", *_factoid_and_refusal(glm_q)))
    order = series[0][1].sort_values(ascending=True).index.tolist()
    ys = np.arange(len(order))
    offsets = {"gemini": 0.17 if glm_q is not None else 0.0, "glm": -0.17}

    fig, axes = plt.subplots(1, 2, figsize=(3.4, 2.75), sharey=True)
    for col, (ax, title) in enumerate(zip(axes, ("Factoid accuracy", "Refusal accuracy"))):
        for y in ys:
            ax.axhline(y, color="#efefef", linewidth=0.5, zorder=0)
        for key, factoid, refusal in series:
            values = (factoid if col == 0 else refusal).reindex(order)
            style = MODEL_STYLE[key]
            ax.scatter(values.values, ys + offsets[key], s=17, marker=style["marker"], color=style["color"],
                       edgecolors="white", linewidths=0.35, zorder=3, label=style["label"])
        if glm_q is not None:
            a_vals = (series[0][1] if col == 0 else series[0][2]).reindex(order).values
            b_vals = (series[1][1] if col == 0 else series[1][2]).reindex(order).values
            for y, a, b in zip(ys, a_vals, b_vals):
                ax.plot([a, b], [y + offsets["gemini"], y + offsets["glm"]], color="#c8c8c8", linewidth=0.5, zorder=2)
        ax.set_xlim(-0.04, 1.04)
        ax.set_title(title, loc="left", fontsize=8.2)
        ax.set_xlabel("EM on answerable Qs" if col == 0 else "Refusals on unanswerable Qs", fontsize=7.4)
        ax.grid(True, alpha=0.5, axis="x")
        ax.set_axisbelow(True)
    axes[0].set_yticks(ys)
    axes[0].set_yticklabels([APPROACH_LABEL[a] for a in order])
    axes[0].set_ylim(-0.6, len(order) - 0.4)
    if glm_q is not None:
        handles, labels = axes[0].get_legend_handles_labels()
        fig.legend(handles, labels, loc="upper center", bbox_to_anchor=(0.6, -0.06), ncol=2,
                   frameon=False, fontsize=6.8, handletextpad=0.2, columnspacing=1.2)
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
                ax.text(j, i, "n/a", ha="center", va="center", color="#888", fontsize=6.5)
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

    cross = all((tbl / f).is_file() for f in (
        "glm53_headline.csv", "glm53_per_question.csv",
        "glm53_fc_headroom_headline.csv", "glm53_fc_headroom_per_question.csv",
    ))
    glm = pd.read_csv(tbl / "glm53_headline.csv") if cross else None
    glm_q = pd.read_csv(tbl / "glm53_per_question.csv") if cross else None
    fc = pd.read_csv(tbl / "glm53_fc_headroom_headline.csv") if cross else None
    fc_q = pd.read_csv(tbl / "glm53_fc_headroom_per_question.csv") if cross else None

    fig_pareto(headline, OUT_DIR / "pareto.pdf", two_col=False)
    fig_pareto(headline, OUT_DIR / "pareto_wide.pdf", two_col=True)
    fig_forest(headline, "em", OUT_DIR / "forest_em.pdf")
    fig_forest(headline, "f1", OUT_DIR / "forest_f1.pdf")
    fig_probe_heatmap(per_q, OUT_DIR / "probe_heatmap.pdf")
    fig_cost_bar(headline, OUT_DIR / "cost_bar.pdf")
    fig_seed_variance(headline, OUT_DIR / "seed_variance.pdf", glm)
    fig_honesty(per_q, OUT_DIR / "honesty.pdf", glm_q)
    fig_win_loss(per_q, OUT_DIR / "win_loss.pdf")
    fig_approach_diagram(OUT_DIR / "pipelines.pdf")
    written = 10
    if cross:
        fig_pareto_cross_model(headline, glm, fc, OUT_DIR / "pareto_cross_model.pdf")
        fig_cross_model_f1(headline, glm, fc, OUT_DIR / "cross_model_f1.pdf")
        fig_probe_heatmap_cross_model(per_q, glm_q, fc_q, OUT_DIR / "probe_heatmap_cross_model.pdf")
        written += 3
    else:
        print("GLM 5.3 Flash tables not found; skipped cross-model figures "
              "(run scripts/export_cross_model_tables.py).")

    print(f"Wrote {written} IEEE-style PDFs to {OUT_DIR}/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
