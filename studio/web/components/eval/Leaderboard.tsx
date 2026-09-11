"use client";

import { useState } from "react";
import clsx from "clsx";
import { ArrowUpDown } from "lucide-react";
import { Dot } from "@/components/ui/Tag";
import { APPROACHES } from "@/lib/approaches";
import { fmtMs, fmtPct, fmtUSD } from "@/lib/format";
import type { HeadlineRow } from "@/lib/types";

type SortKey = "f1" | "em" | "cost_usd" | "p50_ms";

export function Leaderboard({ rows }: { rows: HeadlineRow[] }) {
  const [sort, setSort] = useState<SortKey>("f1");
  const sorted = [...rows].sort((a, b) =>
    sort === "cost_usd" || sort === "p50_ms" ? a[sort] - b[sort] : b[sort] - a[sort],
  );
  const seeds = rows[0]?.n_seeds ?? 1;

  const Th = ({ k, label }: { k: SortKey; label: string }) => (
    <th className="px-3 py-2 text-right font-medium">
      <button onClick={() => setSort(k)} className={clsx("inline-flex items-center gap-1 hover:text-ink", sort === k ? "text-ink" : "text-ink-muted")}>
        {label} <ArrowUpDown className="h-3 w-3" />
      </button>
    </th>
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-line text-[11px] uppercase tracking-wide text-ink-faint">
            <th className="px-3 py-2 text-left font-medium">Strategy</th>
            <Th k="f1" label="F1" />
            <Th k="em" label="EM" />
            <Th k="cost_usd" label={seeds > 1 ? "Cost / run" : "Cost"} />
            <Th k="p50_ms" label="p50" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => {
            const a = APPROACHES[r.approach];
            return (
              <tr key={r.approach} className="border-b border-line/60 last:border-0">
                <td className="px-3 py-2.5">
                  <span className="flex items-center gap-2">
                    <span className="tnum w-4 font-mono text-[11px] text-ink-faint">{i + 1}</span>
                    <Dot color={a.color} />
                    <span className="font-medium">{a.label}</span>
                  </span>
                </td>
                <MetricCell value={r.f1} std={seeds > 1 ? r.f1_seed_std : undefined} lo={r.f1_lo} hi={r.f1_hi} />
                <MetricCell value={r.em} std={seeds > 1 ? r.em_seed_std : undefined} lo={r.em_lo} hi={r.em_hi} />
                <td className="px-3 py-2.5 text-right">
                  <span className="tnum font-mono text-ink">{fmtUSD(r.cost_usd)}</span>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <span className="tnum font-mono text-ink-muted">{fmtMs(r.p50_ms)}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 px-3 text-[11px] text-ink-faint">
        {seeds > 1
          ? `Means of ${seeds} runs, ± the run-to-run standard deviation. The grey range is the bootstrap 95% confidence interval over all ${rows[0]?.n ?? 0} graded answers. Cost and latency are per full run.`
          : `Values are means; small grey range is the bootstrap 95% confidence interval (n = ${rows[0]?.n ?? 0}).`}
      </p>
    </div>
  );
}

function MetricCell({ value, std, lo, hi }: { value: number; std?: number; lo: number; hi: number }) {
  return (
    <td className="whitespace-nowrap px-3 py-2.5 text-right">
      <span className="tnum font-mono text-ink">{fmtPct(value, 1)}</span>
      {std != null && (
        <span className="tnum ml-1 font-mono text-[10.5px] text-ink-muted">±{(std * 100).toFixed(1)}</span>
      )}
      <span className="tnum ml-1 font-mono text-[10.5px] text-ink-faint">
        [{fmtPct(lo, 0)}–{fmtPct(hi, 0)}]
      </span>
    </td>
  );
}
