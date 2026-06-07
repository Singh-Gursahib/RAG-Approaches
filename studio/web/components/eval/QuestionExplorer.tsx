"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
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
  const rows = filter === "all" ? questions : questions.filter((q) => q.type === filter);

  return (
    <div className="space-y-3">
      <Segmented
        options={[{ value: "all", label: "All" }, ...probes.map((p) => ({ value: p, label: PROBE_LABEL[p] ?? p }))]}
        value={filter}
        onChange={setFilter}
      />
      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-line text-[11px] uppercase tracking-wide text-ink-faint">
              <th className="px-2 py-2 text-left font-medium">Question</th>
              <th className="px-2 py-2 text-left font-medium">Gold</th>
              {approaches.map((a) => (
                <th key={a} className="px-2 py-2 text-center">
                  <Dot color={APPROACHES[a].color} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((q) => (
              <tr key={q.qid} className="border-b border-line/60 align-top last:border-0">
                <td className="max-w-[260px] px-2 py-2">
                  <p className="text-ink">{q.question_text ?? q.qid}</p>
                  <span className="font-mono text-[10px] text-ink-faint">{PROBE_LABEL[q.type] ?? q.type}</span>
                </td>
                <td className="px-2 py-2 font-mono text-[11.5px] text-ink-muted">{q.gold}</td>
                {approaches.map((a) => {
                  const p = q.predictions[a];
                  if (!p) return <td key={a} className="px-2 text-center text-ink-faint">·</td>;
                  return (
                    <td key={a} className="px-2 py-2 text-center">
                      <span className="inline-flex flex-col items-center gap-0.5">
                        {p.correct ? (
                          <Check className="h-3.5 w-3.5 text-approach-rerank" />
                        ) : (
                          <X className="h-3.5 w-3.5 text-approach-recursive" />
                        )}
                        <span className="tnum font-mono text-[10px] text-ink-faint">
                          {(p.f1 * 100).toFixed(0)}
                        </span>
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
