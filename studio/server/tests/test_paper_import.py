"""The imported paper sweep must reproduce paper/tables/sweep_headline.csv exactly."""
from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
SCRIPT = REPO_ROOT / "studio" / "server" / "scripts" / "import_paper_sweep.py"


@pytest.mark.skipif(
    not (REPO_ROOT / "runs" / "naive_T03_seed0").is_dir(),
    reason="research sweep runs are not present in this checkout",
)
def test_imported_sweep_matches_paper_table():
    spec = importlib.util.spec_from_file_location("import_paper_sweep", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    payload = module.build_payload(REPO_ROOT)
    problems = module.compare_with_paper_table(
        payload["results"], REPO_ROOT / "paper" / "tables" / "sweep_headline.csv"
    )
    assert problems == []
    assert payload["config"]["repeats"] == 3
    assert all(row["n"] == 102 for row in payload["results"]["headline"])
