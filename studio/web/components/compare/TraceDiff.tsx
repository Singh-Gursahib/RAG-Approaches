"use client";

import { ArrowRight } from "lucide-react";
import { Dot } from "@/components/ui/Tag";
import { APPROACHES } from "@/lib/approaches";
import { humanizeStep } from "@/components/run/runState";
import { fmtMs } from "@/lib/format";
import type { StoredApproachResult } from "@/lib/store";

/** Side-by-side pipeline comparison — shows why approaches differ in steps/cost. */
export function TraceDiff({ results }: { results: StoredApproachResult[] }) {
  return (
    <div className="space-y-3">
      {results.map((r) => {
        const a = APPROACHES[r.approach];
        return (
          <div key={r.approach} className="flex items-center gap-3">
            <span className="flex w-[120px] shrink-0 items-center gap-1.5 text-[12.5px] text-ink">
              <Dot color={a.color} />
              {a.label}
            </span>
            <div className="flex flex-1 flex-wrap items-center gap-1.5">
              {r.steps.length === 0 ? (
                <span className="text-[12px] text-ink-faint">single call</span>
              ) : (
                r.steps.map((s, i) => (
                  <span key={i} className="flex items-center gap-1.5">
                    {i > 0 && <ArrowRight className="h-3 w-3 text-ink-faint" />}
                    <span
                      className="rounded-pill border px-2 py-0.5 text-[11px]"
                      style={{ borderColor: `${a.color}55`, color: a.color }}
                    >
                      {humanizeStep(s.step)}
                      {s.latency_ms ? (
                        <span className="ml-1 font-mono text-ink-faint">{fmtMs(s.latency_ms)}</span>
                      ) : null}
                    </span>
                  </span>
                ))
              )}
            </div>
            <span className="tnum w-14 shrink-0 text-right font-mono text-[11.5px] text-ink-faint">
              {r.steps.length || 1} {r.steps.length === 1 ? "step" : "steps"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
