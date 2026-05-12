"use client";

import clsx from "clsx";
import { APPROACH_COLOR, APPROACH_LABEL, PROBE_LABEL } from "@/lib/colors";
import type { ApproachKey, Question } from "@/lib/types";

interface Props {
  questions: Question[];
  approaches: ApproachKey[];
}

export function QuestionDiff({ questions, approaches }: Props) {
  // Show only questions where at least one selected approach gets a different result.
  const interesting = questions.filter((q) => {
    const results = approaches.map((a) => q.predictions[a]?.correct ?? 0);
    return new Set(results).size > 1;
  });

  if (interesting.length === 0) {
    return (
      <div className="card p-10 text-center text-ink-muted">
        <p className="font-display text-[18px] tracking-tightest text-ink">
          All selected approaches agree on every question.
        </p>
        <p className="mt-2 text-[13px]">Try selecting more approaches to see disagreements.</p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div
        className="grid items-center px-6 py-3 border-b border-border text-[10px] uppercase tracking-widest text-ink-faint font-mono"
        style={{ gridTemplateColumns: `minmax(120px, 1fr) minmax(180px, 1.4fr) repeat(${approaches.length}, minmax(110px, 1fr))` }}
      >
        <div>Question</div>
        <div>Gold</div>
        {approaches.map((a) => (
          <div key={a} className="text-center flex items-center justify-center gap-1.5">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: APPROACH_COLOR[a] }}
            />
            {APPROACH_LABEL[a]}
          </div>
        ))}
      </div>
      {interesting.map((q, i) => (
        <div
          key={q.qid}
          className={clsx(
            "grid items-start px-6 py-4 transition-colors hover:bg-ink/[0.02]",
            i !== interesting.length - 1 && "border-b border-border/70"
          )}
          style={{ gridTemplateColumns: `minmax(120px, 1fr) minmax(180px, 1.4fr) repeat(${approaches.length}, minmax(110px, 1fr))` }}
        >
          <div>
            <p className="text-[13px] font-mono text-ink">{q.qid}</p>
            <p className="text-[10px] uppercase tracking-widest text-ink-faint font-mono mt-1">
              {PROBE_LABEL[q.type]}
            </p>
          </div>
          <div className="text-[13px] text-ink-muted leading-snug">{q.gold}</div>
          {approaches.map((a) => {
            const pred = q.predictions[a];
            if (!pred) {
              return (
                <div key={a} className="text-center text-ink-faint text-[12px]">
                  —
                </div>
              );
            }
            return (
              <div key={a} className="text-center">
                <div
                  className={clsx(
                    "inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-mono",
                    pred.correct
                      ? "bg-approach-rerank/15 text-approach-rerank"
                      : "bg-accent/15 text-accent"
                  )}
                >
                  {pred.correct ? "✓" : "✗"}
                </div>
                <p
                  className="mt-1.5 text-[11px] text-ink-muted leading-tight px-2 truncate"
                  title={pred.pred}
                >
                  {pred.pred.length > 32 ? pred.pred.slice(0, 32) + "…" : pred.pred}
                </p>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
