"use client";

import {
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { APPROACHES } from "@/lib/approaches";
import type { ApproachKey } from "@/lib/types";

export interface ParetoPoint {
  approach: ApproachKey;
  x: number;
  y: number;
}

/** Generic cost×quality (or cost×latency) scatter, colored per approach. */
export function ParetoChart({
  points,
  xLabel,
  yLabel,
  xFmt = (v) => `${v}`,
  yFmt = (v) => `${v}`,
}: {
  points: ParetoPoint[];
  xLabel: string;
  yLabel: string;
  xFmt?: (v: number) => string;
  yFmt?: (v: number) => string;
}) {
  const data = points.map((p) => ({
    ...p,
    label: APPROACHES[p.approach].label,
    fill: APPROACHES[p.approach].color,
  }));

  return (
    <ResponsiveContainer width="100%" height={320}>
      <ScatterChart margin={{ top: 16, right: 24, bottom: 28, left: 4 }}>
        <CartesianGrid stroke="rgba(0,0,0,0.06)" />
        <XAxis
          type="number"
          dataKey="x"
          tickFormatter={xFmt}
          tick={{ fontSize: 11, fill: "#9a958c" }}
          stroke="rgba(0,0,0,0.15)"
          label={{ value: xLabel, position: "insideBottom", offset: -16, fontSize: 11, fill: "#6b6b6b" }}
        />
        <YAxis
          type="number"
          dataKey="y"
          tickFormatter={yFmt}
          tick={{ fontSize: 11, fill: "#9a958c" }}
          stroke="rgba(0,0,0,0.15)"
          label={{ value: yLabel, angle: -90, position: "insideLeft", fontSize: 11, fill: "#6b6b6b" }}
        />
        <Tooltip
          cursor={{ strokeDasharray: "3 3" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload as (typeof data)[number];
            return (
              <div className="rounded-[10px] border border-line bg-surface px-3 py-2 text-[12px] shadow-lift">
                <div className="mb-1 flex items-center gap-1.5 font-medium">
                  <span className="h-2 w-2 rounded-full" style={{ background: d.fill }} />
                  {d.label}
                </div>
                <div className="tnum font-mono text-ink-muted">
                  {xLabel}: {xFmt(d.x)}
                </div>
                <div className="tnum font-mono text-ink-muted">
                  {yLabel}: {yFmt(d.y)}
                </div>
              </div>
            );
          }}
        />
        <Scatter data={data}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.fill} />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}
