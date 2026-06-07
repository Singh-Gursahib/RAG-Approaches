"use client";

import { useRef } from "react";
import { Plus, Trash2, Upload, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { HelpPopover } from "@/components/ui/Tooltip";
import { SAMPLE_EVAL } from "@/lib/samples";

export interface EvalRow {
  question: string;
  gold_answer: string;
  type: string;
}

const PROBE_TYPES = ["sanity", "needle", "multi_hop", "distractor", "hallucination"];

export function QuestionSetEditor({
  rows,
  onChange,
}: {
  rows: EvalRow[];
  onChange: (rows: EvalRow[]) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  function update(i: number, patch: Partial<EvalRow>) {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function add() {
    onChange([...rows, { question: "", gold_answer: "", type: "sanity" }]);
  }
  function remove(i: number) {
    onChange(rows.filter((_, idx) => idx !== i));
  }

  async function importJsonl(file: File) {
    const text = await file.text();
    const parsed: EvalRow[] = [];
    for (const line of text.split("\n")) {
      const t = line.trim();
      if (!t) continue;
      try {
        const o = JSON.parse(t);
        if (o.question && o.gold_answer) {
          parsed.push({ question: o.question, gold_answer: o.gold_answer, type: o.type || "sanity" });
        }
      } catch {
        /* skip bad line */
      }
    }
    if (parsed.length) onChange(parsed);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="ghost" onClick={add} leftIcon={<Plus className="h-4 w-4" />}>
          Add question
        </Button>
        <Button size="sm" variant="ghost" onClick={() => fileRef.current?.click()} leftIcon={<Upload className="h-4 w-4" />}>
          Import JSONL
        </Button>
        <Button size="sm" variant="quiet" onClick={() => onChange(SAMPLE_EVAL)} leftIcon={<Sparkles className="h-4 w-4" />}>
          Load sample set
        </Button>
        <span className="ml-auto inline-flex items-center gap-1 text-[12px] text-ink-faint">
          gold answers required
          <HelpPopover>
            Each row needs the question and its correct answer (the “gold”). Tag hallucination probes —
            deliberately-absent answers — with type “hallucination” and gold “NOT_IN_CONTEXT”.
          </HelpPopover>
        </span>
        <input
          ref={fileRef}
          type="file"
          accept=".jsonl,.json,text/plain"
          hidden
          onChange={(e) => e.target.files?.[0] && importJsonl(e.target.files[0])}
        />
      </div>

      <div className="overflow-hidden rounded-card border border-line">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-line bg-canvas/50 text-[11px] uppercase tracking-wide text-ink-faint">
              <th className="px-3 py-2 text-left font-medium">Question</th>
              <th className="px-3 py-2 text-left font-medium">Gold answer</th>
              <th className="px-3 py-2 text-left font-medium">Type</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-[13px] text-ink-faint">
                  No questions yet — add one, import a JSONL file, or load the sample set.
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-line/60 last:border-0">
                <td className="px-2 py-1.5">
                  <Input value={r.question} onChange={(e) => update(i, { question: e.target.value })} placeholder="Question…" className="border-transparent bg-transparent px-2 py-1.5 hover:border-line focus:border-ink/30" />
                </td>
                <td className="px-2 py-1.5">
                  <Input value={r.gold_answer} onChange={(e) => update(i, { gold_answer: e.target.value })} placeholder="Gold…" className="border-transparent bg-transparent px-2 py-1.5 font-mono text-[12px] hover:border-line focus:border-ink/30" />
                </td>
                <td className="px-2 py-1.5">
                  <select
                    value={r.type}
                    onChange={(e) => update(i, { type: e.target.value })}
                    className="rounded-[8px] border border-line bg-surface px-2 py-1.5 text-[12px]"
                  >
                    {PROBE_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </td>
                <td className="px-2 text-center">
                  <button onClick={() => remove(i)} className="text-ink-faint hover:text-approach-recursive" aria-label="Remove">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
