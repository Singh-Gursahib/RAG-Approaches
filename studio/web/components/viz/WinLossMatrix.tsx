"use client";

import clsx from "clsx";
import { APPROACHES } from "@/lib/approaches";
import { Tooltip } from "@/components/ui/Tooltip";
import type { ApproachKey, WinCell } from "@/lib/types";

/** Head-to-head net-win heatmap. Row beats column when net > 0. */
export function WinLossMatrix({
  approaches,
  matrix,
}: {
  approaches: ApproachKey[];
  matrix: Record<string, Record<string, WinCell>>;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="border-collapse text-[11.5px]">
        <thead>
          <tr>
            <th className="p-1.5" />
            {approaches.map((c) => (
              <th key={c} className="p-1.5 text-center font-medium text-ink-muted">
                <span className="inline-flex flex-col items-center gap-1">
                  <span className="h-2 w-2 rounded-full" style={{ background: APPROACHES[c].color }} />
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {approaches.map((r) => (
            <tr key={r}>
              <td className="whitespace-nowrap py-1.5 pr-2 text-right text-ink">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: APPROACHES[r].color }} />
                  {APPROACHES[r].label}
                </span>
              </td>
              {approaches.map((c) => {
                if (r === c) {
                  return <td key={c} className="h-10 w-10 bg-ink/[0.03]" />;
                }
                const cell = matrix[r]?.[c];
                const net = cell ? cell.wins - cell.losses : 0;
                const intensity = cell && cell.n ? Math.min(1, Math.abs(net) / cell.n) : 0;
                const positive = net > 0;
                const bg = positive
                  ? `rgba(45,106,79,${0.12 + intensity * 0.55})`
                  : net < 0
                    ? `rgba(155,29,32,${0.12 + intensity * 0.55})`
                    : "transparent";
                return (
                  <td key={c} className="p-0.5">
                    <Tooltip
                      content={
                        cell
                          ? `${APPROACHES[r].label} vs ${APPROACHES[c].label}: ${cell.wins}W / ${cell.losses}L / ${cell.ties}T`
                          : "—"
                      }
                    >
                      <span
                        className={clsx(
                          "grid h-10 w-10 place-items-center rounded-[6px] tnum font-mono",
                          positive ? "text-approach-rerank" : net < 0 ? "text-approach-recursive" : "text-ink-faint",
                        )}
                        style={{ background: bg }}
                      >
                        {net > 0 ? `+${net}` : net}
                      </span>
                    </Tooltip>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
