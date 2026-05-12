"""Cost accounting and project-wide budget guard.

The budget ledger is a JSONL file at `runs/.budget_ledger.jsonl`. Every LLM
call appends one row. Before any new call, the wrapper checks the cumulative
total against the configured cap and aborts if it would exceed it.

Prices for `gemini-3-flash-preview` are an estimate (the model is in preview);
override via env `RAGUREAP_PRICE_INPUT_PER_M` and `RAGUREAP_PRICE_OUTPUT_PER_M`
if Google publishes different rates, or set them in YAML.
"""
from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass
from pathlib import Path
from threading import Lock


# Default per-million-token prices (USD). Conservative estimate matching the
# Gemini 2.5 Flash tier; override via env or config if the actual preview tier
# differs. Over-estimating only causes the budget guard to fire earlier, which
# is the safe direction.
DEFAULT_PRICE_INPUT_PER_M = 0.30
DEFAULT_PRICE_OUTPUT_PER_M = 2.50


@dataclass(frozen=True)
class Price:
    input_per_m: float
    output_per_m: float

    @classmethod
    def from_env(cls) -> "Price":
        return cls(
            input_per_m=float(
                os.environ.get("RAGUREAP_PRICE_INPUT_PER_M", DEFAULT_PRICE_INPUT_PER_M)
            ),
            output_per_m=float(
                os.environ.get("RAGUREAP_PRICE_OUTPUT_PER_M", DEFAULT_PRICE_OUTPUT_PER_M)
            ),
        )

    def usd(self, tokens_in: int, tokens_out: int) -> float:
        return (
            tokens_in / 1_000_000 * self.input_per_m
            + tokens_out / 1_000_000 * self.output_per_m
        )


class BudgetExceededError(RuntimeError):
    """Raised when cumulative spend would exceed the configured cap."""


class BudgetLedger:
    """Append-only JSONL ledger of every LLM call's cost.

    Thread-safe; safe for use within a single process. Multi-process writes
    rely on append-only line atomicity (OK for our use).
    """

    def __init__(
        self,
        path: str | Path = "runs/.budget_ledger.jsonl",
        cap_usd: float = 5.0,
        warn_pct: float = 0.5,
        abort_pct: float = 0.95,
    ):
        self.path = Path(path)
        self.cap_usd = float(cap_usd)
        self.warn_pct = float(warn_pct)
        self.abort_pct = float(abort_pct)
        self._lock = Lock()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._warned = False

    def cumulative(self) -> float:
        if not self.path.is_file():
            return 0.0
        total = 0.0
        for line in self.path.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            try:
                total += float(json.loads(line).get("cost_usd", 0.0))
            except (json.JSONDecodeError, ValueError, TypeError):
                continue
        return total

    def preflight(self, estimated_cost: float, run_id: str | None = None) -> None:
        """Refuse the upcoming call if it would push cumulative spend past abort_pct of cap."""
        current = self.cumulative()
        projected = current + estimated_cost
        if projected > self.abort_pct * self.cap_usd:
            raise BudgetExceededError(
                f"Refusing LLM call: projected cumulative spend ${projected:.4f} "
                f"would exceed {self.abort_pct * 100:.0f}% of ${self.cap_usd:.2f} cap. "
                f"Current ${current:.4f}; this call would add ${estimated_cost:.4f}. "
                f"Run: {run_id or 'unspecified'}."
            )
        if not self._warned and projected > self.warn_pct * self.cap_usd:
            self._warned = True
            print(
                f"[budget] Warning: cumulative spend ${projected:.4f} "
                f"is past {self.warn_pct * 100:.0f}% of ${self.cap_usd:.2f} cap.",
                flush=True,
            )

    def record(
        self,
        cost_usd: float,
        tokens_in: int,
        tokens_out: int,
        model: str,
        run_id: str | None = None,
        kind: str = "generate",
    ) -> float:
        """Append a row; return new cumulative total."""
        with self._lock:
            entry = {
                "ts": time.time(),
                "run_id": run_id,
                "kind": kind,
                "model": model,
                "tokens_in": int(tokens_in),
                "tokens_out": int(tokens_out),
                "cost_usd": float(cost_usd),
            }
            with self.path.open("a", encoding="utf-8") as fh:
                fh.write(json.dumps(entry) + "\n")
            return self.cumulative()
