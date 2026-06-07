"use client";

import { ShieldQuestion } from "lucide-react";
import { Dot, Tag } from "@/components/ui/Tag";
import { CostTicker } from "@/components/run/CostTicker";
import { APPROACHES } from "@/lib/approaches";
import { fmtMs, fmtTokens } from "@/lib/format";
import type { StoredApproachResult } from "@/lib/store";

export function normalizeAns(s: string): string {
  return s
    .toLowerCase()
    .replace(/[-/_]/g, " ")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function AnswerColumns({ results }: { results: StoredApproachResult[] }) {
  // Group by normalized answer to surface agreement.
  const groups = new Map<string, number>();
  results.filter((r) => !r.error).forEach((r) => {
    const k = normalizeAns(r.answer);
    groups.set(k, (groups.get(k) ?? 0) + 1);
  });

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {results.map((r) => {
        const a = APPROACHES[r.approach];
        const agreeCount = r.error ? 0 : groups.get(normalizeAns(r.answer)) ?? 1;
        const consensus = agreeCount > 1;
        return (
          <div
            key={r.approach}
            className="flex flex-col rounded-card border border-line bg-surface p-4"
            style={{ boxShadow: `inset 3px 0 0 ${a.color}` }}
          >
            <div className="mb-2 flex items-center gap-2">
              <Dot color={a.color} />
              <span className="text-[13px] font-medium">{a.label}</span>
              {r.refused && (
                <Tag tone="warning" className="ml-auto">
                  <ShieldQuestion className="h-3 w-3" /> refused
                </Tag>
              )}
              {!r.refused && consensus && (
                <Tag tone="success" className="ml-auto">
                  agrees ×{agreeCount}
                </Tag>
              )}
            </div>
            <p className="font-display text-[19px] leading-snug tracking-tight text-ink">
              {r.error ? <span className="text-approach-recursive">error</span> : r.answer || "(empty)"}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-ink-muted">
              <CostTicker value={r.cost_usd} />
              <span>{fmtMs(r.latency_ms)}</span>
              <span>{fmtTokens(r.tokens_in + r.tokens_out)} tok</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
