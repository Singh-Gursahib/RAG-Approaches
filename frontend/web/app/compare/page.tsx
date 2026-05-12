"use client";

import { useState } from "react";
import clsx from "clsx";
import { data, fmtPct } from "@/lib/data";
import { WinLossMatrix } from "@/components/WinLossMatrix";
import { QuestionDiff } from "@/components/QuestionDiff";
import { APPROACH_COLOR, APPROACH_LABEL } from "@/lib/colors";
import type { ApproachKey } from "@/lib/types";

const ALL: ApproachKey[] = [
  "sliding_window",
  "full_context",
  "rerank",
  "naive",
  "hyde",
  "hybrid",
  "recursive_summary",
];

export default function ComparePage() {
  const [selected, setSelected] = useState<Set<ApproachKey>>(
    new Set(["sliding_window", "full_context", "rerank", "naive"])
  );

  const toggle = (a: ApproachKey) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(a) ? next.delete(a) : next.add(a);
      return next;
    });
  };

  const selectedList = ALL.filter((a) => selected.has(a));

  return (
    <>
      <section className="pt-16 pb-10 animate-fade-up">
        <p className="eyebrow">Side-by-side</p>
        <h1 className="mt-4 font-display tracking-tightest text-[64px] sm:text-[80px] leading-[0.96] text-ink">
          Compare approaches
        </h1>
        <p className="mt-6 max-w-[640px] text-[16px] text-ink-muted leading-relaxed">
          Toggle approaches to see where they agree, where they diverge, and which questions
          actually separate them.
        </p>
      </section>

      {/* Approach selector */}
      <section className="card p-6 sm:p-8 animate-fade-up" style={{ animationDelay: "120ms" }}>
        <p className="eyebrow">Select approaches</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {ALL.map((a) => {
            const on = selected.has(a);
            return (
              <button
                key={a}
                onClick={() => toggle(a)}
                className={clsx(
                  "px-4 py-2 rounded-full border text-[13px] transition-all",
                  on
                    ? "bg-ink text-canvas border-ink"
                    : "bg-surface text-ink-muted border-border hover:border-ink/30 hover:text-ink"
                )}
              >
                <span className="inline-flex items-center gap-2">
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{
                      backgroundColor: on ? "#fbfbfd" : APPROACH_COLOR[a],
                    }}
                  />
                  {APPROACH_LABEL[a]}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Headline strip */}
      {selectedList.length > 0 && (
        <section
          className="grid gap-3 mt-6 animate-fade-up"
          style={{
            animationDelay: "200ms",
            gridTemplateColumns: `repeat(${Math.min(selectedList.length, 4)}, minmax(0, 1fr))`,
          }}
        >
          {selectedList.slice(0, 4).map((a) => {
            const row = data.headline.find((r) => r.approach === a)!;
            return (
              <div key={a} className="card p-5">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: APPROACH_COLOR[a] }}
                  />
                  <span className="font-display text-[15px] tracking-tightest text-ink">
                    {APPROACH_LABEL[a]}
                  </span>
                </div>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="numeral text-[32px]">{fmtPct(row.f1, 1)}</span>
                  <span className="text-[11px] text-ink-muted font-mono">F1</span>
                </div>
                <p className="mt-1 text-[11px] text-ink-faint font-mono tabular-nums">
                  EM {fmtPct(row.em, 1)} · ${row.cost_usd.toFixed(4)}
                </p>
              </div>
            );
          })}
        </section>
      )}

      {/* Win/Loss matrix */}
      <section className="mt-16 animate-fade-up" style={{ animationDelay: "260ms" }}>
        <p className="eyebrow">Head-to-head record</p>
        <h2 className="mt-2 font-display text-[36px] tracking-tightest leading-none">
          Win-loss matrix
        </h2>
        <p className="mt-4 max-w-prose text-[14px] text-ink-muted leading-relaxed">
          For every pair of approaches, the percentage of questions where the row beats the
          column on Exact Match. A column full of green means that approach is dominated.
        </p>
        <div className="card p-6 sm:p-8 mt-6 overflow-x-auto">
          <WinLossMatrix matrix={data.win_matrix} approaches={ALL} />
        </div>
      </section>

      {/* Per-question diff */}
      <section className="mt-16 animate-fade-up" style={{ animationDelay: "320ms" }}>
        <p className="eyebrow">Where they disagree</p>
        <h2 className="mt-2 font-display text-[36px] tracking-tightest leading-none">
          Question-by-question diff
        </h2>
        <p className="mt-4 max-w-prose text-[14px] text-ink-muted leading-relaxed">
          Showing only questions where at least one selected approach disagrees with the rest. The
          quietly-agreeing majority is hidden so the signal lives where the differences live.
        </p>
        <div className="mt-6">
          <QuestionDiff questions={data.questions} approaches={selectedList} />
        </div>
      </section>
    </>
  );
}
