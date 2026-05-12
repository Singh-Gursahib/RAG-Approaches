import { APPROACH_COLOR } from "@/lib/colors";
import type { ApproachKey } from "@/lib/types";
import { fmtPct } from "@/lib/data";

interface Row {
  label: string;
  approach: ApproachKey;
  mean: number;
  lo: number;
  hi: number;
}

interface Props {
  rows: Row[];
  metricLabel: string;
  highlight?: ApproachKey;
}

export function ForestPlot({ rows, metricLabel, highlight }: Props) {
  const max = 1;
  const min = 0;
  return (
    <div className="card p-6 sm:p-8">
      <div className="flex items-center justify-between">
        <p className="eyebrow">{metricLabel}</p>
        <p className="text-[11px] text-ink-faint font-mono">point · bootstrap 95% CI</p>
      </div>
      <div className="mt-6 space-y-3">
        {rows.map((r) => {
          const isHi = highlight === r.approach;
          const meanPct = ((r.mean - min) / (max - min)) * 100;
          const loPct = ((r.lo - min) / (max - min)) * 100;
          const hiPct = ((r.hi - min) / (max - min)) * 100;
          return (
            <div key={r.approach} className="grid grid-cols-[140px_1fr_64px] items-center gap-4">
              <span
                className={`text-[13px] font-medium truncate ${
                  isHi ? "text-ink" : "text-ink-muted"
                }`}
              >
                {r.label}
              </span>
              <div className="relative h-6">
                <div className="absolute top-1/2 -translate-y-px h-px bg-border w-full" />
                <div
                  className="absolute top-1/2 -translate-y-px h-px"
                  style={{
                    left: `${loPct}%`,
                    width: `${hiPct - loPct}%`,
                    backgroundColor: APPROACH_COLOR[r.approach],
                    opacity: isHi ? 0.9 : 0.5,
                  }}
                />
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full ring-2 ring-canvas"
                  style={{
                    left: `calc(${meanPct}% - 5px)`,
                    backgroundColor: APPROACH_COLOR[r.approach],
                  }}
                />
              </div>
              <span className="numeral text-[16px] text-right tabular-nums">
                {fmtPct(r.mean, 1)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex items-center justify-between text-[10px] font-mono text-ink-faint tabular-nums">
        <span>0%</span>
        <span>25%</span>
        <span>50%</span>
        <span>75%</span>
        <span>100%</span>
      </div>
    </div>
  );
}
