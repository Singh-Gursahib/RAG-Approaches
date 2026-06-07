"use client";

import { useState } from "react";
import clsx from "clsx";
import { ChevronDown, ShieldQuestion, Coins, Timer, Hash, AlertTriangle, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Dot, Tag } from "@/components/ui/Tag";
import { CostTicker } from "./CostTicker";
import { TraceTimeline } from "./TraceTimeline";
import { APPROACHES } from "@/lib/approaches";
import { fmtMs, fmtTokens } from "@/lib/format";
import type { ApproachRunState } from "./runState";

export function AnswerCard({ state }: { state: ApproachRunState }) {
  const a = APPROACHES[state.approach];
  const [showChunks, setShowChunks] = useState(false);
  const done = state.done;

  return (
    <Card className="flex flex-col overflow-hidden">
      {/* header */}
      <div className="flex items-center gap-2.5 border-b border-line px-4 py-3" style={{ boxShadow: `inset 3px 0 0 ${a.color}` }}>
        <Dot color={a.color} />
        <span className="font-medium tracking-tight">{a.label}</span>
        <Tag tone="neutral">{a.family}</Tag>
        <span className="ml-auto">
          <StatusBadge state={state} />
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-4">
        {/* answer */}
        {done ? (
          <div>
            {done.refused && (
              <Tag tone="warning" className="mb-2">
                <ShieldQuestion className="h-3 w-3" /> Honest refusal
              </Tag>
            )}
            <p className="font-display text-[22px] leading-snug tracking-tight text-ink">
              {done.answer || <span className="text-ink-faint">(empty)</span>}
            </p>
          </div>
        ) : state.error ? (
          <div className="flex items-start gap-2 rounded-[10px] bg-approach-recursive/10 px-3 py-2 text-[13px] text-approach-recursive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{state.error}</span>
          </div>
        ) : (
          <p className="text-[14px] text-ink-faint">Working…</p>
        )}

        {/* metrics */}
        {done && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-ink-muted">
            <Metric icon={<Coins className="h-3.5 w-3.5" />}><CostTicker value={done.cost_usd} /></Metric>
            <Metric icon={<Timer className="h-3.5 w-3.5" />}>{fmtMs(done.latency_ms)}</Metric>
            <Metric icon={<Hash className="h-3.5 w-3.5" />}>
              {fmtTokens(done.tokens_in)} in · {fmtTokens(done.tokens_out)} out
            </Metric>
          </div>
        )}

        {/* trace timeline */}
        <div>
          <p className="eyebrow mb-2">Pipeline</p>
          <TraceTimeline state={state} />
        </div>

        {/* retrieved chunks */}
        {done && done.retrieved?.length > 0 && (
          <div className="rounded-[12px] border border-line">
            <button
              onClick={() => setShowChunks((v) => !v)}
              className="flex w-full items-center justify-between px-3.5 py-2.5 text-[12.5px] text-ink-muted hover:text-ink"
            >
              {done.retrieved.length} retrieved chunk{done.retrieved.length > 1 ? "s" : ""}
              <ChevronDown className={clsx("h-3.5 w-3.5 transition-transform", showChunks && "rotate-180")} />
            </button>
            {showChunks && (
              <ul className="space-y-2 border-t border-line p-3 animate-fade-in">
                {done.retrieved.map((c) => (
                  <li key={c.chunk_id} className="rounded-[8px] bg-canvas/60 p-2.5">
                    <div className="mb-1 flex items-center justify-between font-mono text-[10.5px] text-ink-faint">
                      <span>{c.chunk_id}</span>
                      {c.score != null && <span>score {c.score.toFixed(3)}</span>}
                    </div>
                    <p className="line-clamp-3 text-[12px] leading-snug text-ink-muted">{c.text}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

function Metric({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-ink-faint">{icon}</span>
      {children}
    </span>
  );
}

function StatusBadge({ state }: { state: ApproachRunState }) {
  if (state.status === "done") return <Tag tone="success">done</Tag>;
  if (state.status === "error") return <Tag tone="danger">error</Tag>;
  if (state.status === "queued") return <Tag tone="neutral">queued</Tag>;
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-accent">
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      {state.status === "building" ? "building" : "running"}
    </span>
  );
}
