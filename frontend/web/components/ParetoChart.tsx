"use client";

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import { APPROACH_COLOR, APPROACH_LABEL } from "@/lib/colors";
import type { ApproachKey, HeadlineRow } from "@/lib/types";
import { fmtPct, fmtUSD, fmtMs } from "@/lib/data";

interface Props {
  rows: HeadlineRow[];
  metric: "em" | "f1";
}

interface Datum {
  approach: ApproachKey;
  cost: number;
  quality: number;
  p50_ms: number;
}

function ParetoTooltip({ active, payload }: { active?: boolean; payload?: { payload: Datum }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-surface border border-border rounded-xl px-4 py-3 shadow-sm min-w-[200px]">
      <div className="flex items-center gap-2">
        <span
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: APPROACH_COLOR[d.approach] }}
        />
        <span className="font-display tracking-tightest text-[15px]">{APPROACH_LABEL[d.approach]}</span>
      </div>
      <div className="mt-2.5 space-y-1.5 text-[13px]">
        <Row label="Quality" value={fmtPct(d.quality, 1)} />
        <Row label="Cost" value={fmtUSD(d.cost)} />
        <Row label="p50" value={fmtMs(d.p50_ms)} />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-6">
      <span className="text-ink-muted">{label}</span>
      <span className="num font-mono text-ink">{value}</span>
    </div>
  );
}

export function ParetoChart({ rows, metric }: Props) {
  const data: Datum[] = rows.map((r) => ({
    approach: r.approach,
    cost: r.cost_usd,
    quality: metric === "em" ? r.em : r.f1,
    p50_ms: r.p50_ms,
  }));

  const minQ = Math.max(0, Math.min(...data.map((d) => d.quality)) - 0.05);

  return (
    <div className="w-full h-[420px]">
      <ResponsiveContainer>
        <ScatterChart margin={{ top: 32, right: 36, bottom: 36, left: 8 }}>
          <CartesianGrid
            stroke="#e5e5e7"
            strokeDasharray="0"
            horizontal={true}
            vertical={false}
          />
          <XAxis
            type="number"
            dataKey="cost"
            domain={[0, "dataMax"]}
            tickFormatter={(v) => `$${v.toFixed(3)}`}
            tick={{ fontSize: 11, fill: "#86868b", fontFamily: "var(--font-mono)" }}
            axisLine={{ stroke: "#d2d2d7" }}
            tickLine={false}
            label={{
              value: "Cost (USD per full eval-set run)",
              position: "insideBottom",
              offset: -18,
              style: { fontSize: 12, fill: "#86868b" },
            }}
          />
          <YAxis
            type="number"
            dataKey="quality"
            domain={[minQ, 1]}
            tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
            tick={{ fontSize: 11, fill: "#86868b", fontFamily: "var(--font-mono)" }}
            axisLine={false}
            tickLine={false}
            label={{
              value: metric === "em" ? "Exact Match" : "Token F1",
              angle: -90,
              position: "insideLeft",
              offset: 14,
              style: { fontSize: 12, fill: "#86868b" },
            }}
          />
          <Tooltip cursor={{ stroke: "#1d1d1f", strokeDasharray: "3 3" }} content={<ParetoTooltip />} />
          <ReferenceLine y={1.0} stroke="#d2d2d7" strokeDasharray="2 4" />
          <Scatter data={data}>
            {data.map((d) => (
              <Cell key={d.approach} fill={APPROACH_COLOR[d.approach]} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
