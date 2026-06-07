"use client";

import { Dot } from "@/components/ui/Tag";
import { CostTicker } from "@/components/run/CostTicker";
import { APPROACHES } from "@/lib/approaches";
import type { ApproachKey } from "@/lib/types";

export interface ApproachProgress {
  approach: ApproachKey;
  done: number;
  total: number;
  cost: number;
  status: "queued" | "building" | "running" | "done" | "error";
}

export function EvalProgress({ items }: { items: ApproachProgress[] }) {
  return (
    <div className="space-y-3" aria-live="polite">
      {items.map((p) => {
        const a = APPROACHES[p.approach];
        const pct = p.total ? (p.done / p.total) * 100 : 0;
        return (
          <div key={p.approach} className="grid grid-cols-[140px_1fr_auto] items-center gap-3">
            <span className="flex items-center gap-1.5 truncate text-[12.5px] text-ink">
              <Dot color={a.color} />
              {a.label}
            </span>
            <span className="h-2 overflow-hidden rounded-pill bg-ink/[0.06]">
              <span
                className="block h-full rounded-pill transition-[width] duration-300"
                style={{
                  width: `${p.status === "building" ? 6 : pct}%`,
                  background: a.color,
                  opacity: p.status === "building" ? 0.5 : 1,
                }}
              />
            </span>
            <span className="tnum w-28 text-right font-mono text-[11.5px] text-ink-muted">
              {p.status === "building" ? "indexing…" : `${p.done}/${p.total}`}
              {" · "}
              <CostTicker value={p.cost} />
            </span>
          </div>
        );
      })}
    </div>
  );
}
