import Link from "next/link";
import clsx from "clsx";
import { APPROACH_COLOR, APPROACH_LABEL, APPROACH_FAMILY } from "@/lib/colors";
import type { ApproachKey, HeadlineRow } from "@/lib/types";
import { fmtPct, fmtUSD, fmtMs } from "@/lib/data";

interface Props {
  rows: HeadlineRow[];
}

export function Leaderboard({ rows }: Props) {
  // Sort by F1 desc for the primary view.
  const sorted = [...rows].sort((a, b) => b.f1 - a.f1);
  const bestF1 = sorted[0]?.f1 ?? 1;

  return (
    <div className="card overflow-hidden">
      <div className="grid grid-cols-[36px_minmax(180px,1.4fr)_minmax(120px,1fr)_minmax(120px,1fr)_minmax(90px,0.7fr)_minmax(80px,0.6fr)] px-6 py-4 border-b border-border text-[11px] uppercase tracking-[0.14em] text-ink-faint font-mono">
        <div>#</div>
        <div>Approach</div>
        <div>Exact Match</div>
        <div>Token F1</div>
        <div className="text-right">Cost</div>
        <div className="text-right">p50</div>
      </div>
      {sorted.map((r, i) => (
        <Link
          key={r.approach}
          href={`/approaches/${r.approach}`}
          className={clsx(
            "grid grid-cols-[36px_minmax(180px,1.4fr)_minmax(120px,1fr)_minmax(120px,1fr)_minmax(90px,0.7fr)_minmax(80px,0.6fr)] items-center px-6 py-5 transition-colors hover:bg-accent-subtle/30 group",
            i !== sorted.length - 1 && "border-b border-border/70"
          )}
        >
          <span className="numeral text-[20px] text-ink-faint">{i + 1}</span>
          <div className="flex items-center gap-3 min-w-0">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: APPROACH_COLOR[r.approach] }}
            />
            <div className="min-w-0">
              <p className="font-display text-[17px] tracking-tightest text-ink truncate">
                {APPROACH_LABEL[r.approach]}
              </p>
              <p className="text-[11px] uppercase tracking-widest text-ink-faint font-mono mt-0.5">
                {APPROACH_FAMILY[r.approach]}
              </p>
            </div>
          </div>
          <MetricBar value={r.em} lo={r.em_lo} hi={r.em_hi} max={1} />
          <MetricBar value={r.f1} lo={r.f1_lo} hi={r.f1_hi} max={1} accent={r.f1 === bestF1} />
          <span className="text-right font-mono text-[13px] text-ink tabular-nums">
            {fmtUSD(r.cost_usd)}
          </span>
          <span className="text-right font-mono text-[13px] text-ink-muted tabular-nums">
            {fmtMs(r.p50_ms)}
          </span>
        </Link>
      ))}
    </div>
  );
}

function MetricBar({
  value,
  lo,
  hi,
  max,
  accent,
}: {
  value: number;
  lo: number;
  hi: number;
  max: number;
  accent?: boolean;
}) {
  const pct = (value / max) * 100;
  const lpct = (lo / max) * 100;
  const hpct = (hi / max) * 100;
  return (
    <div className="pr-4">
      <div className="flex items-baseline gap-2">
        <span
          className={clsx(
            "numeral text-[20px]",
            accent ? "text-accent" : "text-ink"
          )}
        >
          {fmtPct(value)}
        </span>
        <span className="text-[10px] text-ink-faint font-mono tabular-nums">
          [{fmtPct(lo, 0)}–{fmtPct(hi, 0)}]
        </span>
      </div>
      <div className="relative h-1 bg-ink/[0.06] rounded-full mt-2 overflow-hidden">
        <div
          className="absolute h-full bg-ink/15 rounded-full"
          style={{ left: `${lpct}%`, width: `${hpct - lpct}%` }}
        />
        <div
          className={clsx(
            "absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full",
            accent ? "bg-accent" : "bg-ink"
          )}
          style={{ left: `calc(${pct}% - 3px)` }}
        />
      </div>
    </div>
  );
}
