"use client";

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { APPROACH_COLOR, APPROACH_LABEL, PROBE_LABEL } from "@/lib/colors";
import type { ApproachKey, PerProbeRow, ProbeType } from "@/lib/types";
import { fmtPct } from "@/lib/data";

interface Props {
  rows: PerProbeRow[];
  approaches: ApproachKey[];
  metric: "em" | "f1";
}

const PROBE_ORDER: ProbeType[] = ["sanity", "hallucination", "needle", "multi_hop", "distractor"];

export function ProbeBreakdown({ rows, approaches, metric }: Props) {
  // Pivot to shape recharts wants: one entry per probe type, with each approach as a key.
  const data = PROBE_ORDER.map((p) => {
    const row: Record<string, string | number> = { probe: PROBE_LABEL[p] };
    for (const a of approaches) {
      const cell = rows.find((r) => r.approach === a && r.probe_type === p);
      if (cell) row[a] = metric === "em" ? cell.em : cell.f1;
    }
    return row;
  });

  return (
    <div className="w-full h-[440px]">
      <ResponsiveContainer>
        <RadarChart data={data} margin={{ top: 20, right: 40, bottom: 20, left: 40 }}>
          <PolarGrid stroke="#e5e5e7" />
          <PolarAngleAxis
            dataKey="probe"
            tick={{ fontSize: 12, fill: "#1d1d1f", fontFamily: "var(--font-display)" }}
          />
          <PolarRadiusAxis
            domain={[0, 1]}
            tickCount={5}
            tick={{ fontSize: 10, fill: "#a1a1a6", fontFamily: "var(--font-mono)" }}
            tickFormatter={(v) => `${Math.round(v * 100)}`}
            angle={90}
            stroke="#e5e5e7"
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              return (
                <div className="bg-surface border border-border rounded-xl px-4 py-3 shadow-sm">
                  <p className="font-display text-[14px] tracking-tightest">
                    {payload[0].payload.probe}
                  </p>
                  <div className="mt-2 space-y-1">
                    {payload
                      .sort((a, b) => (b.value as number) - (a.value as number))
                      .map((p) => (
                        <div key={p.dataKey} className="flex items-baseline justify-between gap-4 text-[12px]">
                          <span className="flex items-center gap-1.5">
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: p.color }}
                            />
                            <span className="text-ink-muted">
                              {APPROACH_LABEL[p.dataKey as ApproachKey]}
                            </span>
                          </span>
                          <span className="font-mono tabular-nums text-ink">
                            {fmtPct(p.value as number)}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              );
            }}
          />
          {approaches.map((a) => (
            <Radar
              key={a}
              name={APPROACH_LABEL[a]}
              dataKey={a}
              stroke={APPROACH_COLOR[a]}
              fill={APPROACH_COLOR[a]}
              fillOpacity={0.08}
              strokeWidth={1.6}
              dot={{ r: 2.5, fill: APPROACH_COLOR[a] }}
            />
          ))}
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
