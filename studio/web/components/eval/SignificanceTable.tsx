"use client";

import { Dot } from "@/components/ui/Tag";
import { Tooltip } from "@/components/ui/Tooltip";
import { APPROACHES } from "@/lib/approaches";
import type { ApproachKey } from "@/lib/types";

/** Holm-corrected pairwise significance. Honest framing: most pairs are "tied". */
export function SignificanceTable({
  approaches,
  matrix,
}: {
  approaches: ApproachKey[];
  matrix: Record<string, Record<string, number>>;
}) {
  const sigPairs: { a: ApproachKey; b: ApproachKey; p: number }[] = [];
  for (let i = 0; i < approaches.length; i++) {
    for (let j = i + 1; j < approaches.length; j++) {
      const p = matrix[approaches[i]]?.[approaches[j]];
      if (p != null && p <= 0.05) sigPairs.push({ a: approaches[i], b: approaches[j], p });
    }
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="border-collapse text-[11.5px]">
          <thead>
            <tr>
              <th className="p-1.5" />
              {approaches.map((c) => (
                <th key={c} className="p-1.5 text-center">
                  <Dot color={APPROACHES[c].color} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {approaches.map((r) => (
              <tr key={r}>
                <td className="whitespace-nowrap py-1 pr-2 text-right text-ink">
                  <span className="inline-flex items-center gap-1.5">
                    <Dot color={APPROACHES[r].color} />
                    {APPROACHES[r].label}
                  </span>
                </td>
                {approaches.map((c) => {
                  if (r === c) return <td key={c} className="h-9 w-9 bg-ink/[0.03]" />;
                  const p = matrix[r]?.[c];
                  const sig = p != null && p <= 0.05;
                  return (
                    <td key={c} className="p-0.5">
                      <Tooltip content={p != null ? `Holm-adjusted p = ${p.toFixed(3)}` : "—"}>
                        <span
                          className={`grid h-9 w-9 place-items-center rounded-[6px] font-mono ${
                            sig ? "bg-accent-soft text-accent" : "text-ink-faint"
                          }`}
                        >
                          {sig ? "✓" : "tie"}
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
      <p className="text-[12.5px] leading-relaxed text-ink-muted">
        {sigPairs.length === 0 ? (
          <>No pair is statistically separable after Holm correction at this sample size — the
          ranking is suggestive, not significant. This is the honest read at small N.</>
        ) : (
          <>
            Statistically significant differences (Holm-adjusted p ≤ 0.05):{" "}
            {sigPairs.map((s, i) => (
              <span key={i}>
                {i > 0 && "; "}
                <span className="text-ink">{APPROACHES[s.a].label}</span> vs{" "}
                <span className="text-ink">{APPROACHES[s.b].label}</span>
              </span>
            ))}
            . All other pairs are statistically tied.
          </>
        )}
      </p>
    </div>
  );
}
