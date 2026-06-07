"use client";

import { useState } from "react";
import clsx from "clsx";
import { Check, ChevronDown } from "lucide-react";
import { Dot, Tag } from "@/components/ui/Tag";
import { APPROACHES, APPROACH_ORDER } from "@/lib/approaches";
import type { ApproachKey } from "@/lib/types";

export function ApproachPicker({
  selected,
  onChange,
  corpusTokens,
}: {
  selected: ApproachKey[];
  onChange: (next: ApproachKey[]) => void;
  corpusTokens: number | null;
}) {
  const [expanded, setExpanded] = useState<ApproachKey | null>(null);

  function toggle(key: ApproachKey) {
    onChange(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key]);
  }

  // Full-context "fits comfortably" heuristic for a friendly hint.
  const fitsFull = corpusTokens != null && corpusTokens <= 12000;

  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      {APPROACH_ORDER.map((key) => {
        const a = APPROACHES[key];
        const isSel = selected.includes(key);
        const isOpen = expanded === key;
        let hint: { tone: "success" | "warning"; text: string } | null = null;
        if (key === "full_context") {
          hint = fitsFull
            ? { tone: "success", text: "Fits your corpus" }
            : { tone: "warning", text: "Corpus may be large" };
        }
        return (
          <div
            key={key}
            className={clsx(
              "rounded-card border bg-surface transition-colors",
              isSel ? "border-ink/40 ring-1 ring-ink/10" : "border-line hover:border-ink/20",
            )}
          >
            <button
              onClick={() => toggle(key)}
              className="flex w-full items-start gap-3 p-3.5 text-left"
              aria-pressed={isSel}
            >
              <span
                className={clsx(
                  "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-[6px] border transition-colors",
                  isSel ? "border-ink bg-ink text-canvas" : "border-line",
                )}
              >
                {isSel && <Check className="h-3.5 w-3.5" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <Dot color={a.color} />
                  <span className="font-medium tracking-tight">{a.label}</span>
                  <Tag tone="neutral" className="ml-auto">{a.family}</Tag>
                </span>
                <span className="mt-1 block text-[12.5px] leading-snug text-ink-muted">{a.tagline}</span>
                {hint && (
                  <span className="mt-2 inline-flex">
                    <Tag tone={hint.tone}>{hint.text}</Tag>
                  </span>
                )}
              </span>
            </button>
            <button
              onClick={() => setExpanded(isOpen ? null : key)}
              className="flex w-full items-center justify-between border-t border-line px-3.5 py-2 text-[12px] text-ink-faint hover:text-ink"
            >
              How it works
              <ChevronDown className={clsx("h-3.5 w-3.5 transition-transform", isOpen && "rotate-180")} />
            </button>
            {isOpen && (
              <div className="border-t border-line px-3.5 py-3 text-[12.5px] leading-relaxed text-ink-muted animate-fade-in">
                <p>{a.explainer}</p>
                <p className="mt-2"><span className="text-ink">Best for:</span> {a.bestFor}</p>
                <p className="mt-1"><span className="text-ink">Weak at:</span> {a.weakAt}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
