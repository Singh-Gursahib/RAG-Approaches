"""Stream sweep progress for the orchestrator's Monitor tool."""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path


def main(max_secs: int = 60 * 50) -> int:
    seen: set[str] = set()
    deadline = time.time() + max_secs
    last_ledger_emit = 0.0
    while time.time() < deadline:
        runs_dir = Path("runs")
        seen_now = {p.name for p in runs_dir.iterdir() if p.is_dir() and "_T03_seed" in p.name}
        new = seen_now - seen
        for r in sorted(new):
            metrics_path = runs_dir / r / "metrics.json"
            if metrics_path.is_file():
                d = json.loads(metrics_path.read_text())
                print(f"[done] {r}  EM={d['em']:.3f}  F1={d['f1']:.3f}  cost=${d['cost_usd']:.4f}", flush=True)
        seen = seen_now

        # Emit ledger total every ~60s.
        if time.time() - last_ledger_emit > 60:
            ledger = runs_dir / ".budget_ledger.jsonl"
            if ledger.is_file():
                total = 0.0
                for line in ledger.read_text().splitlines():
                    if not line.strip():
                        continue
                    try:
                        total += float(json.loads(line).get("cost_usd", 0.0))
                    except Exception:
                        pass
                print(f"[ledger] cumulative ${total:.4f} / $5.00", flush=True)
            last_ledger_emit = time.time()
        time.sleep(15)
    return 0


if __name__ == "__main__":
    sys.exit(main())
