"use client";

import { APPROACHES } from "@/lib/approaches";
import type { ApproachKey } from "@/lib/types";

export interface BarRow {
  approach: ApproachKey;
  value: number;
  display: string;
}

/** Horizontal bar comparison, colored per approach. Bars scale to the max value. */
export function MetricBars({
  rows,
  highlightLowest = false,
}: {
  rows: BarRow[];
  /** If true, the lowest value is "best" (cost/latency) and gets a ring. */
  highlightLowest?: boolean;
}) {
  if (!rows.length) return null;
  const max = Math.max(...rows.map((r) => r.value), 1e-9);
  const bestVal = highlightLowest
    ? Math.min(...rows.map((r) => r.value))
    : Math.max(...rows.map((r) => r.value));

  return (
    <ul className="space-y-2.5">
      {rows.map((r) => {
        const a = APPROACHES[r.approach];
        const pct = Math.max(2, (r.value / max) * 100);
        const best = r.value === bestVal;
        return (
          <li key={r.approach} className="grid grid-cols-[120px_1fr_auto] items-center gap-3">
            <span className="flex items-center gap-1.5 truncate text-[12.5px] text-ink">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: a.color }} />
              {a.label}
            </span>
            <span className="h-2.5 rounded-pill bg-ink/[0.05]">
              <span
                className="block h-full rounded-pill transition-[width] duration-500"
                style={{
                  width: `${pct}%`,
                  background: a.color,
                  boxShadow: best ? `0 0 0 2px var(--canvas), 0 0 0 3px ${a.color}66` : undefined,
                }}
              />
            </span>
            <span className="tnum w-20 text-right font-mono text-[12px] text-ink-muted">
              {r.display}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
