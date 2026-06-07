"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { APPROACHES, PROBE_LABEL } from "@/lib/approaches";
import type { ApproachKey, PerProbeRow } from "@/lib/types";

/** Per-probe-type F1 radar with one series per approach. */
export function ProbeRadar({
  rows,
  approaches,
  metric = "f1",
}: {
  rows: PerProbeRow[];
  approaches: ApproachKey[];
  metric?: "em" | "f1";
}) {
  const probes = Array.from(new Set(rows.map((r) => r.probe_type)));
  const data = probes.map((p) => {
    const point: Record<string, unknown> = { probe: PROBE_LABEL[p] ?? p };
    for (const a of approaches) {
      const row = rows.find((r) => r.approach === a && r.probe_type === p);
      point[a] = row ? row[metric] : 0;
    }
    return point;
  });

  return (
    <ResponsiveContainer width="100%" height={340}>
      <RadarChart data={data} outerRadius="72%">
        <PolarGrid stroke="rgba(0,0,0,0.08)" />
        <PolarAngleAxis dataKey="probe" tick={{ fontSize: 11, fill: "#6b6b6b" }} />
        <PolarRadiusAxis domain={[0, 1]} tick={{ fontSize: 9, fill: "#9a958c" }} angle={90} />
        {approaches.map((a) => (
          <Radar
            key={a}
            name={APPROACHES[a].label}
            dataKey={a}
            stroke={APPROACHES[a].color}
            fill={APPROACHES[a].color}
            fillOpacity={0.08}
            strokeWidth={1.6}
          />
        ))}
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
