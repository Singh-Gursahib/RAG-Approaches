"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ArrowUpRight, Pause, Play } from "lucide-react";
import { APPROACHES, APPROACH_ORDER } from "@/lib/approaches";
import type { ApproachKey } from "@/lib/types";
import { NaiveSim } from "@/components/sim/NaiveSim";
import { HybridSim } from "@/components/sim/HybridSim";
import { HydeSim } from "@/components/sim/HydeSim";
import { RerankSim } from "@/components/sim/RerankSim";
import { FullContextSim } from "@/components/sim/FullContextSim";
import { RecursiveSummarySim } from "@/components/sim/RecursiveSummarySim";
import { SlidingWindowSim } from "@/components/sim/SlidingWindowSim";

const SIMS: Record<ApproachKey, (props: { color: string }) => JSX.Element> = {
  naive: NaiveSim,
  hybrid: HybridSim,
  hyde: HydeSim,
  rerank: RerankSim,
  full_context: FullContextSim,
  recursive_summary: RecursiveSummarySim,
  sliding_window: SlidingWindowSim,
};

const RAG: ApproachKey[] = ["naive", "hybrid", "hyde", "rerank"];
const NONRAG: ApproachKey[] = ["full_context", "recursive_summary", "sliding_window"];
const AUTOPLAY_MS = 11000;

export function ApproachExplorer() {
  const [selected, setSelected] = useState<ApproachKey>("naive");
  const [auto, setAuto] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [progress, setProgress] = useState(0);
  const reduced = useReducedMotion();
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  useEffect(() => {
    if (reduced) setAuto(false);
  }, [reduced]);

  const running = auto && !hovered && !reduced;

  useEffect(() => {
    if (!running) return;
    const tick = 200;
    const id = setInterval(() => {
      setProgress((pr) => {
        const next = pr + tick / AUTOPLAY_MS;
        if (next >= 1) {
          const idx = APPROACH_ORDER.indexOf(selectedRef.current);
          setSelected(APPROACH_ORDER[(idx + 1) % APPROACH_ORDER.length]);
          return 0;
        }
        return next;
      });
    }, tick);
    return () => clearInterval(id);
  }, [running]);

  function pick(k: ApproachKey) {
    setSelected(k);
    setProgress(0);
  }

  const a = APPROACHES[selected];
  const Sim = SIMS[selected];

  return (
    <section className="shell pb-28">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">How each strategy thinks</p>
          <h2 className="mt-2 max-w-[18ch] font-display text-[40px] leading-[1.02] tracking-tightest sm:text-[52px]">
            Seven ways to find an answer
          </h2>
          <p className="mt-4 max-w-[52ch] text-[15px] leading-relaxed text-ink-muted">
            Each strategy moves your question through the corpus differently. Watch the mechanics —
            then see them run for real in the Playground.
          </p>
        </div>
        <button
          onClick={() => setAuto((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-pill border border-line px-3 py-1.5 text-[12.5px] text-ink-muted transition-colors hover:bg-ink/[0.04] hover:text-ink"
          aria-pressed={auto}
        >
          {auto ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          {auto ? "Auto-playing" : "Auto-play"}
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[248px_1fr]">
        {/* selector rail */}
        <div className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0">
          <RailGroup label="RAG" keys={RAG} selected={selected} progress={progress} onPick={pick} />
          <RailGroup label="Non-RAG" keys={NONRAG} selected={selected} progress={progress} onPick={pick} />
        </div>

        {/* stage */}
        <div
          className="overflow-hidden rounded-card border border-line bg-surface shadow-card"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          {/* top accent + title */}
          <div className="flex items-center gap-2.5 border-b border-line px-5 py-3" style={{ boxShadow: `inset 0 2px 0 ${a.color}` }}>
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: a.color }} />
            <span className="font-display text-[18px] tracking-tight">{a.label}</span>
            <span className="rounded-pill bg-ink/[0.05] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
              {a.family}
            </span>
            <span className="ml-auto font-mono text-[11px] text-ink-faint">{a.tagline}</span>
          </div>

          {/* simulation */}
          <div className="relative bg-[radial-gradient(120%_120%_at_50%_-10%,rgba(0,0,0,0.018),transparent)]">
            <AnimatePresence mode="wait">
              <motion.div
                key={selected}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Sim color={a.color} />
              </motion.div>
            </AnimatePresence>
          </div>

          {/* explainer */}
          <div className="border-t border-line p-5 sm:p-6">
            <p className="max-w-[68ch] text-[14.5px] leading-relaxed text-ink">{a.explainer}</p>

            {/* pipeline steps */}
            <div className="mt-5 flex flex-wrap items-center gap-1.5">
              {a.steps.map((s, i) => (
                <span key={s} className="flex items-center gap-1.5">
                  {i > 0 && <ArrowRight className="h-3 w-3 text-ink-faint" />}
                  <span
                    className="rounded-pill border px-2.5 py-1 text-[11.5px]"
                    style={{ borderColor: `${a.color}40`, color: a.color }}
                  >
                    {s}
                  </span>
                </span>
              ))}
            </div>

            {/* best for / weak at / cost */}
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Fact label="Best for" body={a.bestFor} tone="good" />
              <Fact label="Weak at" body={a.weakAt} tone="bad" />
              <Fact
                label="Cost"
                body={a.cost === "low" ? "Low — single, cheap call" : a.cost === "medium" ? "Medium — an extra step" : "High — scales with the corpus"}
                tone="neutral"
              />
            </div>

            <Link
              href="/playground"
              className="group mt-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink hover:text-accent"
            >
              Run {a.label} on your own corpus
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function RailGroup({
  label,
  keys,
  selected,
  progress,
  onPick,
}: {
  label: string;
  keys: ApproachKey[];
  selected: ApproachKey;
  progress: number;
  onPick: (k: ApproachKey) => void;
}) {
  return (
    <>
      <p className="hidden shrink-0 px-2 pb-1 pt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint lg:block">
        {label}
      </p>
      {keys.map((k) => {
        const a = APPROACHES[k];
        const active = selected === k;
        return (
          <button
            key={k}
            onClick={() => onPick(k)}
            aria-current={active}
            className={clsx(
              "group relative flex shrink-0 items-center gap-2.5 overflow-hidden rounded-[12px] px-3 py-2.5 text-left transition-colors",
              active ? "bg-ink text-canvas" : "text-ink-muted hover:bg-ink/[0.04] hover:text-ink",
            )}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: a.color }} />
            <span className="whitespace-nowrap text-[13.5px] font-medium">{a.label}</span>
            {active && (
              <span
                className="absolute bottom-0 left-0 h-[2px] bg-canvas/70 transition-[width] duration-200 ease-linear"
                style={{ width: `${progress * 100}%` }}
              />
            )}
          </button>
        );
      })}
    </>
  );
}

function Fact({ label, body, tone }: { label: string; body: string; tone: "good" | "bad" | "neutral" }) {
  const dot = tone === "good" ? "#2d6a4f" : tone === "bad" ? "#9b1d20" : "#7d8597";
  return (
    <div className="rounded-[12px] border border-line bg-canvas/40 p-3.5">
      <p className="mb-1.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot }} />
        {label}
      </p>
      <p className="text-[12.5px] leading-snug text-ink-muted">{body}</p>
    </div>
  );
}
