"""Phase 9 multi-seed sweep.

Runs every approach with 3 seeds at temperature 0.3 to characterize seed-to-seed
variance. Each (approach, seed) becomes its own run under `runs/<approach>_T03_seed<n>/`.

The budget guard in `BudgetLedger` aborts the whole sweep if cumulative spend
would exceed 95% of the configured cap (default $5).

Run:
    .venv/bin/python scripts/sweep.py
    .venv/bin/python scripts/sweep.py --approaches naive,rerank --seeds 0,1
"""
from __future__ import annotations

import argparse
import time
from pathlib import Path

from dotenv import load_dotenv

from ragureap.eval.cost import BudgetExceededError
from ragureap.runner import run


DEFAULT_APPROACHES = [
    "naive",
    "hybrid",
    "hyde",
    "rerank",
    "full_context",
    "recursive_summary",
    "sliding_window",
]

DEFAULT_SEEDS = [0, 1, 2]
DEFAULT_TEMPERATURE = 0.3


def main() -> int:
    parser = argparse.ArgumentParser(description="Phase 9 multi-seed sweep.")
    parser.add_argument(
        "--approaches",
        default=",".join(DEFAULT_APPROACHES),
        help="Comma-separated approach names.",
    )
    parser.add_argument(
        "--seeds",
        default=",".join(str(s) for s in DEFAULT_SEEDS),
        help="Comma-separated seed ints.",
    )
    parser.add_argument(
        "--temperature",
        type=float,
        default=DEFAULT_TEMPERATURE,
        help="Generation temperature for the sweep.",
    )
    parser.add_argument(
        "--configs-dir",
        type=Path,
        default=Path("configs/approaches"),
        help="Directory holding per-approach YAML configs.",
    )
    args = parser.parse_args()

    # Load .env so GOOGLE_API_KEY is in env.
    load_dotenv(Path(".env"))

    approaches = [a.strip() for a in args.approaches.split(",") if a.strip()]
    seeds = [int(s.strip()) for s in args.seeds.split(",") if s.strip()]
    temp_tag = f"T{int(round(args.temperature * 10)):02d}"

    total_pairs = len(approaches) * len(seeds)
    print(f"[sweep] {len(approaches)} approaches × {len(seeds)} seeds = {total_pairs} runs")
    print(f"[sweep] temperature={args.temperature}  configs_dir={args.configs_dir}")
    print(f"[sweep] approaches={approaches}")
    print(f"[sweep] seeds={seeds}")
    print()

    completed = 0
    failed = 0
    t_start = time.perf_counter()

    for approach in approaches:
        cfg_path = args.configs_dir / f"{approach}.yaml"
        if not cfg_path.is_file():
            print(f"[sweep] ! {cfg_path} not found, skipping {approach}")
            failed += len(seeds)
            continue
        for seed in seeds:
            run_id = f"{approach}_{temp_tag}_seed{seed}"
            print(f"[sweep] ── starting {run_id}  ({completed + failed + 1}/{total_pairs})")
            try:
                run(
                    config_path=cfg_path,
                    run_id=run_id,
                    config_overrides={"llm": {"temperature": args.temperature}, "seed": seed},
                )
                completed += 1
            except BudgetExceededError as e:
                print(f"[sweep] ✗ BUDGET ABORT — {e}")
                print(f"[sweep] completed={completed}  failed={failed + 1}  remaining_skipped")
                return 2
            except Exception as e:
                failed += 1
                print(f"[sweep] ✗ {run_id} failed: {type(e).__name__}: {str(e)[:200]}")

    elapsed = time.perf_counter() - t_start
    print()
    print(f"[sweep] done.  completed={completed}  failed={failed}  elapsed={elapsed:.1f}s")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
