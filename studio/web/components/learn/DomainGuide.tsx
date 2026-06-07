"use client";

import { Check, Ban } from "lucide-react";
import { Dot } from "@/components/ui/Tag";
import { APPROACHES } from "@/lib/approaches";
import type { DomainGuide as Guide } from "@/lib/domains";

export function DomainGuide({ domain }: { domain: Guide }) {
  return (
    <div className="space-y-4">
      <p className="text-[14px] leading-relaxed text-ink-muted">{domain.rationale}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-card border border-line bg-approach-rerank/[0.04] p-4">
          <p className="mb-2 flex items-center gap-1.5 text-[12px] font-medium text-approach-rerank">
            <Check className="h-3.5 w-3.5" /> Recommended
          </p>
          <ul className="space-y-1.5">
            {domain.recommended.map((a) => (
              <li key={a} className="flex items-center gap-1.5 text-[13px] text-ink">
                <Dot color={APPROACHES[a].color} /> {APPROACHES[a].label}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-card border border-line bg-approach-recursive/[0.04] p-4">
          <p className="mb-2 flex items-center gap-1.5 text-[12px] font-medium text-approach-recursive">
            <Ban className="h-3.5 w-3.5" /> Avoid
          </p>
          <ul className="space-y-1.5">
            {domain.avoid.length === 0 ? (
              <li className="text-[13px] text-ink-faint">No hard exclusions.</li>
            ) : (
              domain.avoid.map((a) => (
                <li key={a} className="flex items-center gap-1.5 text-[13px] text-ink">
                  <Dot color={APPROACHES[a].color} /> {APPROACHES[a].label}
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
