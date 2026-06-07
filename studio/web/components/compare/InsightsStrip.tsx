"use client";

import { Lightbulb } from "lucide-react";
import { APPROACHES } from "@/lib/approaches";
import { fmtMs, fmtUSD } from "@/lib/format";
import type { StoredApproachResult } from "@/lib/store";
import { normalizeAns } from "./AnswerColumns";

/** Templated, plain-English observations derived from the run's trace data. */
export function InsightsStrip({ results }: { results: StoredApproachResult[] }) {
  const insights = buildInsights(results);
  if (!insights.length) return null;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {insights.map((text, i) => (
        <div key={i} className="flex items-start gap-2.5 rounded-card border border-line bg-canvas/50 p-3.5">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <p className="text-[12.5px] leading-relaxed text-ink-muted">{text}</p>
        </div>
      ))}
    </div>
  );
}

function label(a: StoredApproachResult["approach"]) {
  return APPROACHES[a].label;
}

function buildInsights(results: StoredApproachResult[]): string[] {
  const ok = results.filter((r) => !r.error);
  if (ok.length < 1) return [];
  const out: string[] = [];

  // Agreement.
  const answered = ok.filter((r) => !r.refused);
  if (answered.length >= 2) {
    const norm = new Set(answered.map((r) => normalizeAns(r.answer)));
    if (norm.size === 1) {
      out.push(`All ${answered.length} answering strategies produced the same answer — a reassuring sign it’s well-supported.`);
    } else {
      out.push(`The strategies disagreed (${norm.size} distinct answers) — inspect the retrieved chunks to see why.`);
    }
  }

  // Cheapest / fastest.
  const cheapest = [...ok].sort((a, b) => a.cost_usd - b.cost_usd)[0];
  const dearest = [...ok].sort((a, b) => b.cost_usd - a.cost_usd)[0];
  if (cheapest && dearest && dearest.cost_usd > 0 && cheapest.approach !== dearest.approach) {
    const x = dearest.cost_usd / Math.max(cheapest.cost_usd, 1e-9);
    out.push(`${label(dearest.approach)} cost ${x.toFixed(1)}× more than ${label(cheapest.approach)} (${fmtUSD(dearest.cost_usd)} vs ${fmtUSD(cheapest.cost_usd)}) this run.`);
  }
  const fastest = [...ok].sort((a, b) => a.latency_ms - b.latency_ms)[0];
  if (fastest) out.push(`${label(fastest.approach)} was fastest at ${fmtMs(fastest.latency_ms)}.`);

  // Identical retrieval → extra work bought nothing.
  const rag = ok.filter((r) => r.retrieved?.length);
  for (let i = 0; i < rag.length; i++) {
    for (let j = i + 1; j < rag.length; j++) {
      const a = new Set(rag[i].retrieved.map((c) => c.chunk_id));
      const b = new Set(rag[j].retrieved.map((c) => c.chunk_id));
      if (a.size === b.size && [...a].every((x) => b.has(x))) {
        out.push(`${label(rag[i].approach)} and ${label(rag[j].approach)} retrieved identical chunks here — the extra machinery bought nothing on this question.`);
      }
    }
  }

  // Refusal divergence.
  const refused = ok.filter((r) => r.refused);
  if (refused.length && refused.length < ok.length) {
    out.push(`${refused.map((r) => label(r.approach)).join(", ")} refused while others answered — check whether the answer is actually grounded in the corpus.`);
  }

  return out.slice(0, 6);
}
