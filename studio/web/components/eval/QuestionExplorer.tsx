"use client";

import { Fragment, useState } from "react";
import clsx from "clsx";
import { Check, ChevronRight, X } from "lucide-react";
import { Segmented } from "@/components/ui/Controls";
import { Dot } from "@/components/ui/Tag";
import { APPROACHES, PROBE_LABEL } from "@/lib/approaches";
import type { ApproachKey, EvalQuestionResult } from "@/lib/types";

export function QuestionExplorer({
  questions,
  approaches,
}: {
  questions: EvalQuestionResult[];
  approaches: ApproachKey[];
}) {
  const probes = Array.from(new Set(questions.map((q) => q.type)));
  const [filter, setFilter] = useState<string>("all");
  const [open, setOpen] = useState<string | null>(null);
  const rows = filter === "all" ? questions : questions.filter((q) => q.type === filter);
  const multi = questions.some((q) => Object.values(q.predictions).some((p) => (p?.n_seeds ?? 1) > 1));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented
          options={[{ value: "all", label: "All" }, ...probes.map((p) => ({ value: p, label: PROBE_LABEL[p] ?? p }))]}
          value={filter}
          onChange={setFilter}
        />
        <span className="text-[11.5px] text-ink-faint">
          {multi ? "Tick means correct in most runs; x/n counts correct runs. " : ""}Click a question to read every answer.
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-line text-[11px] uppercase tracking-wide text-ink-faint">
              <th className="px-2 py-2 text-left font-medium">Question</th>
              <th className="px-2 py-2 text-left font-medium">Gold</th>
              {approaches.map((a) => (
                <th key={a} className="px-2 py-2 text-center" title={APPROACHES[a].label}>
                  <Dot color={APPROACHES[a].color} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((q) => {
              const isOpen = open === q.qid;
              return (
                <Fragment key={q.qid}>
                  <tr
                    onClick={() => setOpen(isOpen ? null : q.qid)}
                    className="cursor-pointer border-b border-line/60 align-top last:border-0 hover:bg-ink/[0.02]"
                  >
                    <td className="max-w-[260px] px-2 py-2">
                      <span className="flex items-start gap-1.5">
                        <ChevronRight
                          className={clsx("mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-faint transition-transform", isOpen && "rotate-90")}
                        />
                        <span>
                          <p className="text-ink">{q.question_text ?? q.qid}</p>
                          <span className="font-mono text-[10px] text-ink-faint">{PROBE_LABEL[q.type] ?? q.type}</span>
                        </span>
                      </span>
                    </td>
                    <td className="px-2 py-2 font-mono text-[11.5px] text-ink-muted">{q.gold}</td>
                    {approaches.map((a) => {
                      const p = q.predictions[a];
                      if (!p) return <td key={a} className="px-2 text-center text-ink-faint">·</td>;
                      const n = p.n_seeds ?? 1;
                      const rate = p.correct_rate ?? p.correct;
                      return (
                        <td key={a} className="px-2 py-2 text-center">
                          <span className="inline-flex flex-col items-center gap-0.5">
                            {p.correct ? (
                              <Check className="h-3.5 w-3.5 text-approach-rerank" />
                            ) : (
                              <X className="h-3.5 w-3.5 text-approach-recursive" />
                            )}
                            <span className="tnum font-mono text-[10px] text-ink-faint">
                              {n > 1 ? `${Math.round(rate * n)}/${n}` : (p.f1 * 100).toFixed(0)}
                            </span>
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                  {isOpen && (
                    <tr className="border-b border-line/60 bg-canvas/40">
                      <td colSpan={approaches.length + 2} className="px-3 py-3">
                        <div className="grid gap-2 sm:grid-cols-2">
                          {approaches.map((a) => {
                            const p = q.predictions[a];
                            if (!p) return null;
                            const runs = p.preds ?? [{ repeat: 0, pred: p.pred, correct: p.correct, f1: p.f1 }];
                            return (
                              <div key={a} className="rounded-[10px] border border-line bg-surface px-3 py-2">
                                <p className="mb-1 flex items-center gap-1.5 text-[11.5px] font-medium text-ink">
                                  <Dot color={APPROACHES[a].color} /> {APPROACHES[a].label}
                                </p>
                                <ul className="space-y-1">
                                  {runs.map((r) => (
                                    <li key={r.repeat} className="flex items-start gap-1.5 text-[12px] text-ink-muted">
                                      {r.correct ? (
                                        <Check className="mt-0.5 h-3 w-3 shrink-0 text-approach-rerank" />
                                      ) : (
                                        <X className="mt-0.5 h-3 w-3 shrink-0 text-approach-recursive" />
                                      )}
                                      {runs.length > 1 && (
                                        <span className="shrink-0 font-mono text-[10px] leading-[18px] text-ink-faint">run {r.repeat + 1}</span>
                                      )}
                                      <span className="break-words">{r.pred}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
