import clsx from "clsx";
import { APPROACH_COLOR, APPROACH_LABEL } from "@/lib/colors";
import type { ApproachKey, WinCell } from "@/lib/types";

interface Props {
  matrix: Record<string, Record<string, WinCell>>;
  approaches: ApproachKey[];
}

export function WinLossMatrix({ matrix, approaches }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-1.5">
        <thead>
          <tr>
            <th />
            {approaches.map((b) => (
              <th key={b} className="text-[10px] uppercase tracking-widest text-ink-faint font-mono pb-3 px-1">
                <div className="flex items-center justify-center gap-1.5">
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: APPROACH_COLOR[b] }}
                  />
                  <span className="hidden md:inline">{APPROACH_LABEL[b]}</span>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {approaches.map((a) => (
            <tr key={a}>
              <th className="text-right pr-3 text-[12px] font-medium text-ink whitespace-nowrap">
                <span className="flex items-center justify-end gap-1.5">
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: APPROACH_COLOR[a] }}
                  />
                  {APPROACH_LABEL[a]}
                </span>
              </th>
              {approaches.map((b) => {
                if (a === b) {
                  return (
                    <td
                      key={b}
                      className="bg-ink/[0.03] border border-border rounded-lg text-center align-middle h-14 text-ink-faint text-[11px] font-mono"
                    >
                      —
                    </td>
                  );
                }
                const cell = matrix[a]?.[b] ?? { wins: 0, losses: 0, ties: 0, n: 0 };
                const score = cell.n ? (cell.wins - cell.losses) / cell.n : 0;
                const winFrac = cell.n ? cell.wins / cell.n : 0;
                const intensity = Math.abs(score);
                const isWin = score > 0;
                const isLoss = score < 0;
                return (
                  <td
                    key={b}
                    className={clsx(
                      "border rounded-lg text-center align-middle h-14 transition-colors",
                      isWin && "border-approach-rerank/30",
                      isLoss && "border-accent/30",
                      !isWin && !isLoss && "border-border"
                    )}
                    style={{
                      backgroundColor: isWin
                        ? `rgba(45, 106, 79, ${intensity * 0.18})`
                        : isLoss
                        ? `rgba(207, 69, 32, ${intensity * 0.18})`
                        : "transparent",
                    }}
                    title={`${cell.wins}W / ${cell.losses}L / ${cell.ties}T of ${cell.n}`}
                  >
                    <div className="flex flex-col items-center justify-center">
                      <span className="font-mono tabular-nums text-[13px] text-ink">
                        {(winFrac * 100).toFixed(0)}%
                      </span>
                      <span className="text-[9px] text-ink-faint font-mono mt-0.5">
                        {cell.wins}–{cell.losses}–{cell.ties}
                      </span>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 text-[12px] text-ink-faint">
        Cell = % of questions where row beat column on Exact Match. Color saturation reflects margin.
        Hover for the W–L–T breakdown.
      </p>
    </div>
  );
}
