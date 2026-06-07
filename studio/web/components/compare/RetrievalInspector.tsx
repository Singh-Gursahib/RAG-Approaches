"use client";

import { Check } from "lucide-react";
import { Dot } from "@/components/ui/Tag";
import { EmptyState } from "@/components/ui/EmptyState";
import { APPROACHES } from "@/lib/approaches";
import type { StoredApproachResult } from "@/lib/store";

/** Which chunks each retrieval-based approach pulled — overlap at a glance. */
export function RetrievalInspector({ results }: { results: StoredApproachResult[] }) {
  const withRetrieval = results.filter((r) => r.retrieved && r.retrieved.length > 0);
  const nonRetrieval = results.filter((r) => !r.retrieved || r.retrieved.length === 0);

  if (withRetrieval.length === 0) {
    return (
      <EmptyState
        title="No retrieval to inspect"
        body="The selected strategies don’t retrieve chunks (they read the full corpus or its summaries)."
      />
    );
  }

  // Union of retrieved chunk ids, ordered by how many approaches retrieved them.
  const count = new Map<string, number>();
  const textOf = new Map<string, string>();
  withRetrieval.forEach((r) =>
    r.retrieved.forEach((c) => {
      count.set(c.chunk_id, (count.get(c.chunk_id) ?? 0) + 1);
      if (!textOf.has(c.chunk_id)) textOf.set(c.chunk_id, c.text);
    }),
  );
  const chunkIds = [...count.keys()].sort((a, b) => (count.get(b)! - count.get(a)!) || a.localeCompare(b));

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-line text-ink-muted">
              <th className="py-2 pr-3 text-left font-medium">Chunk</th>
              {withRetrieval.map((r) => (
                <th key={r.approach} className="px-2 py-2 text-center">
                  <span className="inline-flex flex-col items-center gap-1">
                    <Dot color={APPROACHES[r.approach].color} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {chunkIds.map((cid) => (
              <tr key={cid} className="border-b border-line/60 last:border-0">
                <td className="py-2 pr-3">
                  <span className="font-mono text-[11px] text-ink">{cid}</span>
                  <p className="mt-0.5 line-clamp-1 max-w-[360px] text-[11px] text-ink-faint">
                    {textOf.get(cid)}
                  </p>
                </td>
                {withRetrieval.map((r) => {
                  const hit = r.retrieved.find((c) => c.chunk_id === cid);
                  return (
                    <td key={r.approach} className="px-2 text-center">
                      {hit ? (
                        <span className="inline-grid h-5 w-5 place-items-center rounded-full" style={{ background: `${APPROACHES[r.approach].color}1a` }}>
                          <Check className="h-3 w-3" style={{ color: APPROACHES[r.approach].color }} />
                        </span>
                      ) : (
                        <span className="text-ink-faint">·</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {nonRetrieval.length > 0 && (
        <p className="text-[12px] text-ink-faint">
          {nonRetrieval.map((r) => APPROACHES[r.approach].label).join(", ")} don’t retrieve — they read the
          full corpus or its summaries.
        </p>
      )}
    </div>
  );
}
