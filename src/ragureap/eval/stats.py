"""Statistical utilities for per-question grade arrays.

All functions accept a 1-D array of per-question scores (typically 0/1 for EM,
or a float in [0,1] for F1) and return numpy-friendly results.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np


@dataclass(frozen=True)
class BootstrapResult:
    mean: float
    ci_low: float
    ci_high: float
    n: int
    n_boot: int


def bootstrap_ci(
    values: list[float] | np.ndarray,
    n_boot: int = 2000,
    ci: float = 0.95,
    seed: int = 0,
) -> BootstrapResult:
    """Percentile-bootstrap confidence interval for the mean of `values`.

    Note: with small N (e.g., 34 questions) the CI will be wide; that's an
    honest reflection of the eval set size. Report N alongside the CI.
    """
    arr = np.asarray(list(values), dtype=float)
    n = len(arr)
    if n == 0:
        return BootstrapResult(mean=float("nan"), ci_low=float("nan"), ci_high=float("nan"), n=0, n_boot=n_boot)
    rng = np.random.default_rng(seed)
    idx = rng.integers(0, n, size=(n_boot, n))
    samples = arr[idx].mean(axis=1)
    alpha = 1.0 - ci
    lo = float(np.percentile(samples, 100 * alpha / 2))
    hi = float(np.percentile(samples, 100 * (1 - alpha / 2)))
    return BootstrapResult(mean=float(arr.mean()), ci_low=lo, ci_high=hi, n=n, n_boot=n_boot)


@dataclass(frozen=True)
class PairedTestResult:
    statistic: float
    p_value: float
    n_nonzero: int
    median_diff: float


def paired_wilcoxon(a: list[float] | np.ndarray, b: list[float] | np.ndarray) -> PairedTestResult:
    """Wilcoxon signed-rank test for paired samples.

    `a` and `b` are per-question scores from two approaches over the SAME
    question set, in the same order. Tests whether the median of differences
    a - b differs from zero.

    Returns p-value plus a small diagnostic. For very small N or N of zero
    nonzero diffs, returns p=1.0.
    """
    from scipy.stats import wilcoxon

    a_arr = np.asarray(list(a), dtype=float)
    b_arr = np.asarray(list(b), dtype=float)
    if a_arr.shape != b_arr.shape:
        raise ValueError(f"shape mismatch: {a_arr.shape} vs {b_arr.shape}")
    diff = a_arr - b_arr
    nonzero = int(np.sum(diff != 0))
    if nonzero == 0:
        return PairedTestResult(statistic=0.0, p_value=1.0, n_nonzero=0, median_diff=0.0)
    try:
        stat, p = wilcoxon(a_arr, b_arr, zero_method="wilcox", alternative="two-sided")
    except ValueError:
        # scipy raises if all differences are zero — handled above.
        return PairedTestResult(statistic=0.0, p_value=1.0, n_nonzero=nonzero, median_diff=float(np.median(diff)))
    return PairedTestResult(
        statistic=float(stat),
        p_value=float(p),
        n_nonzero=nonzero,
        median_diff=float(np.median(diff)),
    )


def holm_correction(p_values: list[float] | np.ndarray) -> list[float]:
    """Holm-Bonferroni correction. Returns adjusted p-values in the SAME order
    as the input. Preserves the FWER at α across `len(p_values)` tests.
    """
    p_arr = np.asarray(list(p_values), dtype=float)
    n = len(p_arr)
    if n == 0:
        return []
    order = np.argsort(p_arr)
    adjusted = np.empty_like(p_arr)
    running_max = 0.0
    for rank, idx in enumerate(order):
        weight = n - rank
        val = min(1.0, weight * p_arr[idx])
        running_max = max(running_max, val)
        adjusted[idx] = running_max
    return [float(x) for x in adjusted]
