"use client";

import { FileJson, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Tag } from "@/components/ui/Tag";
import { fmtInt, fmtUSD } from "@/lib/format";
import type { SavedResult } from "@/lib/types";

function duration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m ? `${m}m ${s}s` : `${s}s`;
}

function reasoningLabel(c: SavedResult["config"]) {
  if (c.reasoning_effort_sent) return `${c.reasoning_effort_sent} effort`;
  if (c.reasoning_requested === "default") return "model default";
  if (c.reasoning_requested === "provider default") return "provider default";
  return "not sent";
}

/** Everything a saved test ran with: model, sampling, retrieval, cost, runtime. */
export function ResultMetaCard({ result, loaded = false }: { result: SavedResult; loaded?: boolean }) {
  const c = result.config;
  const rt = result.runtime;
  const items: { label: string; value: string; sub?: string }[] = [
    { label: "Model", value: result.model.label, sub: result.model.id },
    {
      label: "Provider",
      value: result.provider === "openrouter" ? "OpenRouter" : "Google AI Studio",
      sub: result.model.open_weights ? "open-weights model" : "proprietary model",
    },
    { label: "Temperature", value: String(c.temperature) },
    { label: "Runs", value: String(c.repeats), sub: `seeds ${c.seeds.join(", ")}` },
    { label: "Reasoning", value: reasoningLabel(c), sub: `requested: ${c.reasoning_requested}` },
    { label: "Answer budget", value: `${c.answer_token_budget} tokens`, sub: `max_tokens sent: ${c.max_tokens_sent}` },
    { label: "Retrieval", value: `top-k ${c.retrieval.top_k}`, sub: `rerank pool ${c.retrieval.top_n_for_rerank}` },
    { label: "Chunking", value: `${c.chunking.target_tokens} tokens`, sub: `${c.chunking.overlap_tokens} overlap` },
    {
      label: "Total cost",
      value: fmtUSD(rt.total_cost_usd),
      sub: `${result.dataset.n_questions} questions × ${c.approaches.length} strategies × ${c.repeats} ${c.repeats === 1 ? "run" : "runs"}`,
    },
    {
      label: "Model calls",
      value: rt.llm_calls != null ? fmtInt(rt.llm_calls) : "n/a",
      sub: rt.reasoning_tokens != null ? `${fmtInt(rt.reasoning_tokens)} reasoning tokens` : undefined,
    },
    { label: "Wall time", value: rt.wall_s != null ? duration(rt.wall_s) : "n/a" },
  ];

  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">{loaded ? "Loaded from a previous test" : "Saved test"}</p>
          <p className="mt-1 font-display text-[20px] tracking-tight">{result.label}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-ink-faint">
            <FileJson className="h-3.5 w-3.5" />
            <span className="truncate font-mono">studio/results/{result.id}.json</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {result.created_at && <Tag>{new Date(result.created_at).toLocaleString()}</Tag>}
          {!c.attribution_headers_sent && (
            <Tag tone="success">
              <ShieldCheck className="h-3 w-3" /> no app attribution sent
            </Tag>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((it) => (
          <div key={it.label} className="rounded-[12px] border border-line bg-canvas/40 px-3.5 py-2.5">
            <p className="text-[11px] uppercase tracking-wide text-ink-faint">{it.label}</p>
            <p className="mt-0.5 truncate text-[14px] font-medium text-ink">{it.value}</p>
            {it.sub && <p className="truncate font-mono text-[11px] text-ink-faint">{it.sub}</p>}
          </div>
        ))}
      </div>
      {c.note && <p className="mt-3 text-[12px] text-ink-faint">{c.note}</p>}
    </Card>
  );
}
