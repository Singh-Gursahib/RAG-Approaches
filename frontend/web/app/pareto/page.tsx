"use client";

import { useState } from "react";
import { data, fmtPct, fmtUSD, fmtMs } from "@/lib/data";
import { ParetoChart } from "@/components/ParetoChart";
import { MetricToggle } from "@/components/MetricToggle";
import { APPROACH_COLOR, APPROACH_LABEL, APPROACH_FAMILY } from "@/lib/colors";
import type { ApproachKey } from "@/lib/types";
import Link from "next/link";

export default function ParetoPage() {
  const [metric, setMetric] = useState<"em" | "f1">("f1");
  const rows = data.headline;

  return (
    <>
      <section className="pt-16 pb-10 animate-fade-up">
        <p className="eyebrow">Cost × Quality frontier</p>
        <h1 className="mt-4 font-display tracking-tightest text-[64px] sm:text-[80px] leading-[0.96] text-ink">
          Pareto frontier
        </h1>
        <p className="mt-6 max-w-[640px] text-[16px] text-ink-muted leading-relaxed">
          Each approach as a single dot. Dollars on x, quality on y. The frontier is the cheapest
          way to reach any given quality level — anything above the line is dominated.
        </p>
      </section>

      <section className="card p-6 sm:p-10 animate-fade-up" style={{ animationDelay: "120ms" }}>
        <div className="flex items-center justify-between mb-6">
          <p className="eyebrow">Quality metric</p>
          <MetricToggle
            value={metric}
            options={[
              { value: "em", label: "Exact Match" },
              { value: "f1", label: "Token F1" },
            ]}
            onChange={setMetric}
          />
        </div>
        <ParetoChart rows={rows} metric={metric} />
      </section>

      <section className="mt-16 animate-fade-up" style={{ animationDelay: "200ms" }}>
        <p className="eyebrow">All seven, ranked</p>
        <h2 className="mt-2 font-display text-[36px] tracking-tightest leading-none">
          Sorted by efficiency
        </h2>
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...rows]
            .sort((a, b) => (metric === "em" ? b.em - a.em : b.f1 - a.f1))
            .map((r) => {
              const a = r.approach as ApproachKey;
              const quality = metric === "em" ? r.em : r.f1;
              const lo = metric === "em" ? r.em_lo : r.f1_lo;
              const hi = metric === "em" ? r.em_hi : r.f1_hi;
              return (
                <Link
                  key={a}
                  href={`/approaches/${a}`}
                  className="card card-hover p-6 group transition-transform hover:-translate-y-0.5"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: APPROACH_COLOR[a] }}
                    />
                    <span className="font-display text-[18px] tracking-tightest text-ink">
                      {APPROACH_LABEL[a]}
                    </span>
                    <span className="ml-auto text-[10px] uppercase tracking-widest text-ink-faint font-mono">
                      {APPROACH_FAMILY[a]}
                    </span>
                  </div>
                  <div className="mt-6 flex items-baseline gap-2">
                    <span className="numeral text-[44px]">{fmtPct(quality, 1)}</span>
                    <span className="text-[12px] text-ink-muted font-mono">
                      [{fmtPct(lo, 0)}–{fmtPct(hi, 0)}]
                    </span>
                  </div>
                  <div className="hairline my-5" />
                  <dl className="grid grid-cols-3 gap-3 text-[12px]">
                    <div>
                      <dt className="text-ink-faint uppercase tracking-widest text-[10px] font-mono">
                        Cost
                      </dt>
                      <dd className="mt-1 font-mono text-ink tabular-nums">
                        {fmtUSD(r.cost_usd)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-ink-faint uppercase tracking-widest text-[10px] font-mono">
                        p50
                      </dt>
                      <dd className="mt-1 font-mono text-ink tabular-nums">{fmtMs(r.p50_ms)}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-faint uppercase tracking-widest text-[10px] font-mono">
                        p95
                      </dt>
                      <dd className="mt-1 font-mono text-ink tabular-nums">{fmtMs(r.p95_ms)}</dd>
                    </div>
                  </dl>
                </Link>
              );
            })}
        </div>
      </section>

      <section className="mt-16 card p-8 animate-fade-up" style={{ animationDelay: "280ms" }}>
        <p className="eyebrow">How to read</p>
        <h2 className="mt-2 font-display text-[28px] tracking-tightest leading-tight">
          The dominated and the dominating
        </h2>
        <div className="mt-6 text-[15px] text-ink-muted space-y-3 max-w-prose leading-relaxed">
          <p>
            An approach is <strong className="text-ink">Pareto-dominated</strong> when another
            approach is both cheaper AND higher quality. In this run, HyDE is dominated by Reranker:
            it costs more per question (two LLM calls vs one) and scores lower on F1.
          </p>
          <p>
            <strong className="text-ink">Sliding-Window and Full-Context</strong> trade higher cost
            for better quality — they may sit at the frontier&apos;s top-right, depending on which
            metric you optimize.
          </p>
          <p>
            <strong className="text-ink">Reranker</strong> is the efficient pick: same cost class as
            naive RAG, but the highest F1 among single-LLM-call approaches.
          </p>
        </div>
      </section>
    </>
  );
}
