"use client";

import { ShieldCheck, ShieldAlert } from "lucide-react";
import { Dot } from "@/components/ui/Tag";
import { EmptyState } from "@/components/ui/EmptyState";
import { APPROACHES } from "@/lib/approaches";
import { fmtPct } from "@/lib/format";
import type { ApproachKey, PerProbeRow } from "@/lib/types";

/** Refusal honesty on deliberately-absent questions — first-class safety view. */
export function HallucinationPanel({
  rows,
  approaches,
}: {
  rows: PerProbeRow[];
  approaches: ApproachKey[];
}) {
  const halluc = rows.filter((r) => r.probe_type === "hallucination");
  if (halluc.length === 0) {
    return (
      <EmptyState
        title="No hallucination probes"
        body="Add questions whose answer is deliberately absent (type “hallucination”, gold “NOT_IN_CONTEXT”) to measure refusal honesty — the share of times a strategy correctly says “I don’t know”."
      />
    );
  }
  const byApproach = new Map(halluc.map((r) => [r.approach, r]));

  return (
    <div className="space-y-3">
      <p className="text-[13px] leading-relaxed text-ink-muted">
        How often each strategy correctly <span className="text-ink">refused</span> to answer when the
        corpus has no answer. A wrong answer is worse than no answer — critical for legal and healthcare.
      </p>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {approaches.map((a) => {
          const row = byApproach.get(a);
          const score = row ? row.em : 0; // for hallucination, em == refusal correctness
          const perfect = score >= 0.999;
          return (
            <li key={a} className="flex items-center gap-3 rounded-card border border-line bg-surface px-4 py-3">
              {perfect ? (
                <ShieldCheck className="h-5 w-5 text-approach-rerank" />
              ) : (
                <ShieldAlert className="h-5 w-5 text-approach-hyde" />
              )}
              <span className="flex items-center gap-1.5 text-[13px] font-medium">
                <Dot color={APPROACHES[a].color} />
                {APPROACHES[a].label}
              </span>
              <span className="tnum ml-auto font-mono text-[14px] text-ink">{fmtPct(score, 0)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
