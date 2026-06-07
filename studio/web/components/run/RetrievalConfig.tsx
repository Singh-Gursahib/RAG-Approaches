"use client";

import { Slider } from "@/components/ui/Controls";
import { HelpPopover } from "@/components/ui/Tooltip";
import type { ApproachKey, LLMConfig, RetrievalConfig as RC } from "@/lib/types";

export function RetrievalConfig({
  retrieval,
  llm,
  selected,
  onRetrieval,
  onLLM,
}: {
  retrieval: RC;
  llm: LLMConfig;
  selected: ApproachKey[];
  onRetrieval: (next: RC) => void;
  onLLM: (next: LLMConfig) => void;
}) {
  const needsRetrieval = selected.some((a) =>
    ["naive", "hybrid", "hyde", "rerank"].includes(a),
  );
  const needsTopN = selected.some((a) => ["rerank", "hybrid"].includes(a));

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {needsRetrieval && (
        <Slider
          label="top-k"
          value={retrieval.top_k}
          min={1}
          max={20}
          onChange={(v) => onRetrieval({ ...retrieval, top_k: v })}
          hint={<HelpPopover>How many chunks are handed to the model as context.</HelpPopover>}
        />
      )}
      {needsTopN && (
        <Slider
          label="candidate pool (top-n)"
          value={retrieval.top_n_for_rerank}
          min={5}
          max={50}
          step={5}
          onChange={(v) => onRetrieval({ ...retrieval, top_n_for_rerank: v })}
          hint={<HelpPopover>How wide the net is cast before reranking / fusion.</HelpPopover>}
        />
      )}
      <Slider
        label="temperature"
        value={llm.temperature}
        min={0}
        max={1}
        step={0.1}
        onChange={(v) => onLLM({ ...llm, temperature: v })}
        hint={<HelpPopover>0 = deterministic. Higher adds variety (and seed-to-seed noise).</HelpPopover>}
      />
      <Slider
        label="max answer tokens"
        value={llm.max_output_tokens}
        min={16}
        max={1024}
        step={16}
        onChange={(v) => onLLM({ ...llm, max_output_tokens: v })}
        hint={<HelpPopover>Caps answer length. Short factoid answers need very few.</HelpPopover>}
      />
    </div>
  );
}
