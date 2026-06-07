"use client";

import { APPROACHES } from "@/lib/approaches";
import type { ApproachKey } from "@/lib/types";

export interface ForestRow {
  approach: ApproachKey;
  value: number;
  lo: number;
  hi: number;
}

/** Point estimate + 95% CI per approach on a shared [0,1] axis. */
export function ForestPlot({ rows }: { rows: ForestRow[] }) {
  const sorted = [...rows].sort((a, b) => b.value - a.value);
  return (
    <div className="space-y-3">
      {sorted.map((r) => {
        const a = APPROACHES[r.approach];
        const pct = (v: number) => `${Math.max(0, Math.min(1, v)) * 100}%`;
        return (
          <div key={r.approach} className="grid grid-cols-[120px_1fr_56px] items-center gap-3">
            <span className="flex items-center gap-1.5 truncate text-[12.5px] text-ink">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: a.color }} />
              {a.label}
            </span>
            <span className="relative h-5">
              {/* axis */}
              <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-ink/[0.08]" />
              {/* CI bar */}
              <span
                className="absolute top-1/2 h-1 -translate-y-1/2 rounded-pill opacity-40"
                style={{ left: pct(r.lo), width: pct(Math.max(0, r.hi - r.lo)), background: a.color }}
              />
              {/* point */}
              <span
                className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-[var(--surface)]"
                style={{ left: pct(r.value), background: a.color }}
              />
            </span>
            <span className="tnum text-right font-mono text-[12px] text-ink-muted">
              {(r.value * 100).toFixed(1)}
            </span>
          </div>
        );
      })}
      <div className="flex justify-between pl-[132px] pr-[56px] font-mono text-[10px] text-ink-faint">
        <span>0</span>
        <span>0.5</span>
        <span>1.0</span>
      </div>
    </div>
  );
}
