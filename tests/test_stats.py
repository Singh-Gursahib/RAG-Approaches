"""Tests for eval/stats.py — bootstrap CI, paired Wilcoxon, Holm correction."""
from __future__ import annotations

import numpy as np
import pytest

from ragureap.eval.stats import bootstrap_ci, holm_correction, paired_wilcoxon


def test_bootstrap_ci_mean_is_sample_mean() -> None:
    values = [0, 1, 1, 0, 1, 1, 0, 1, 1, 1]
    res = bootstrap_ci(values, n_boot=500, seed=0)
    assert res.n == 10
    assert res.mean == pytest.approx(0.7, abs=1e-12)
    # CI should contain the mean.
    assert res.ci_low <= res.mean <= res.ci_high


def test_bootstrap_ci_narrows_with_more_data() -> None:
    rng = np.random.default_rng(0)
    small = (rng.random(size=20) < 0.6).astype(int).tolist()
    big = (rng.random(size=1000) < 0.6).astype(int).tolist()
    res_small = bootstrap_ci(small, n_boot=500, seed=1)
    res_big = bootstrap_ci(big, n_boot=500, seed=1)
    # Wider CI for the smaller sample.
    assert (res_small.ci_high - res_small.ci_low) > (res_big.ci_high - res_big.ci_low)


def test_bootstrap_ci_empty_input() -> None:
    res = bootstrap_ci([], n_boot=100)
    assert res.n == 0
    # NaN expected; just confirm it doesn't crash.


def test_paired_wilcoxon_detects_consistent_difference() -> None:
    # A is consistently better than B.
    a = [1] * 20 + [0] * 5
    b = [0] * 20 + [0] * 5
    res = paired_wilcoxon(a, b)
    assert res.p_value < 0.01
    assert res.median_diff > 0


def test_paired_wilcoxon_no_difference_returns_high_p() -> None:
    a = [1, 0, 1, 0, 1, 0, 1, 0]
    b = [1, 0, 1, 0, 1, 0, 1, 0]
    res = paired_wilcoxon(a, b)
    assert res.p_value == 1.0
    assert res.n_nonzero == 0


def test_paired_wilcoxon_shape_mismatch_raises() -> None:
    with pytest.raises(ValueError):
        paired_wilcoxon([1, 0, 1], [1, 0])


def test_holm_correction_monotone_and_preserves_order() -> None:
    p = [0.001, 0.04, 0.03, 0.5]
    adj = holm_correction(p)
    # All adjusted values <= 1.
    assert all(0 <= v <= 1 for v in adj)
    # Holm is monotone non-decreasing across sorted-by-p order. We test
    # that the smallest raw p has the smallest (or equal) adjusted p.
    sorted_idx = sorted(range(len(p)), key=lambda i: p[i])
    sorted_adj = [adj[i] for i in sorted_idx]
    assert sorted_adj == sorted(sorted_adj)


def test_holm_correction_empty() -> None:
    assert holm_correction([]) == []
