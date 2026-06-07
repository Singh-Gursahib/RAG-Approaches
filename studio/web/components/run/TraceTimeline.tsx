"use client";

import { AnimatePresence, motion } from "framer-motion";
import { fmtMs, fmtUSD } from "@/lib/format";
import { humanizeStep, type ApproachRunState } from "./runState";

export function TraceTimeline({ state }: { state: ApproachRunState }) {
  const running = state.status === "running" || state.status === "building";

  return (
    <ol className="relative ml-1 space-y-3 border-l border-line pl-5">
      {state.status === "building" && <Node label="Building index…" pulsing />}
      {state.buildMs != null && (
        <Node label={`Index ready (${fmtMs(state.buildMs)})`} muted />
      )}
      <AnimatePresence initial={false}>
        {state.steps.map((s, i) => (
          <motion.li
            key={i}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="relative"
          >
            <Bullet />
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[13px] font-medium text-ink">{humanizeStep(s.step)}</span>
              <span className="tnum shrink-0 font-mono text-[11px] text-ink-faint">
                {fmtMs(s.latency_ms)}
                {s.cost_usd > 0 ? ` · ${fmtUSD(s.cost_usd)}` : ""}
              </span>
            </div>
            {s.output && (
              <p className="mt-0.5 line-clamp-2 font-mono text-[11.5px] leading-snug text-ink-muted">
                {s.output}
              </p>
            )}
          </motion.li>
        ))}
      </AnimatePresence>
      {running && state.steps.length === 0 && state.status === "running" && (
        <Node label="Thinking…" pulsing />
      )}
    </ol>
  );
}

function Bullet() {
  return (
    <span className="absolute -left-[23px] top-1 grid h-3 w-3 place-items-center rounded-full bg-surface">
      <span className="h-2 w-2 rounded-full bg-ink" />
    </span>
  );
}

function Node({ label, pulsing, muted }: { label: string; pulsing?: boolean; muted?: boolean }) {
  return (
    <li className="relative">
      <span className="absolute -left-[23px] top-1 grid h-3 w-3 place-items-center rounded-full bg-surface">
        <span className={`h-2 w-2 rounded-full ${pulsing ? "animate-pulse-soft bg-accent" : "bg-ink/30"}`} />
      </span>
      <span className={`text-[13px] ${muted ? "text-ink-faint" : "text-ink-muted"}`}>{label}</span>
    </li>
  );
}
