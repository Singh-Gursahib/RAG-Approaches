"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { GitCompare, FlaskConical } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { AnswerColumns } from "@/components/compare/AnswerColumns";
import { InsightsStrip } from "@/components/compare/InsightsStrip";
import { TraceDiff } from "@/components/compare/TraceDiff";
import { RetrievalInspector } from "@/components/compare/RetrievalInspector";
import { MetricBars, type BarRow } from "@/components/viz/MetricBars";
import { Skeleton } from "@/components/ui/Skeleton";
import dynamic from "next/dynamic";

const ParetoChart = dynamic(() => import("@/components/viz/ParetoChart").then((m) => m.ParetoChart), {
  ssr: false,
  loading: () => <Skeleton className="h-[320px] w-full" />,
});
import { listRuns, type StoredRun } from "@/lib/store";
import { fmtMs, fmtTokens, fmtUSD } from "@/lib/format";

export default function ComparePage() {
  const [runs, setRuns] = useState<StoredRun[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const load = () => setRuns(listRuns());
    load();
    // Honor /compare?run=<id> from the History page.
    const id = new URLSearchParams(window.location.search).get("run");
    if (id) setSelectedId(id);
    window.addEventListener("rag-atlas:runs-change", load);
    return () => window.removeEventListener("rag-atlas:runs-change", load);
  }, []);

  const run = useMemo(
    () => runs.find((r) => r.id === selectedId) ?? runs[0],
    [runs, selectedId],
  );

  if (!run) {
    return (
      <div className="shell py-10">
        <Heading />
        <EmptyState
          className="mt-6"
          icon={<FlaskConical className="h-5 w-5" />}
          title="No runs to compare yet"
          body="Run a question across a few strategies in the Playground — it’ll show up here for side-by-side comparison."
          action={
            <Link href="/playground">
              <Button size="sm">Open the playground</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const ok = run.results.filter((r) => !r.error);
  const costBars: BarRow[] = ok.map((r) => ({ approach: r.approach, value: r.cost_usd, display: fmtUSD(r.cost_usd) }));
  const latBars: BarRow[] = ok.map((r) => ({ approach: r.approach, value: r.latency_ms, display: fmtMs(r.latency_ms) }));
  const tokBars: BarRow[] = ok.map((r) => ({ approach: r.approach, value: r.tokens_in + r.tokens_out, display: fmtTokens(r.tokens_in + r.tokens_out) }));
  const pareto = ok.map((r) => ({ approach: r.approach, x: r.cost_usd, y: r.latency_ms }));

  return (
    <div className="shell space-y-6 py-10">
      <Heading />

      {/* run selector + question */}
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="eyebrow">Question</p>
          <p className="mt-1 truncate font-display text-[20px] tracking-tight">{run.question}</p>
          <p className="mt-0.5 text-[12.5px] text-ink-faint">
            {run.corpusLabel} · {ok.length} strategies · {new Date(run.createdAt).toLocaleString()}
          </p>
        </div>
        {runs.length > 1 && (
          <select
            value={run.id}
            onChange={(e) => setSelectedId(e.target.value)}
            className="rounded-[10px] border border-line bg-surface px-3 py-2 text-[13px]"
          >
            {runs.map((r) => (
              <option key={r.id} value={r.id}>
                {new Date(r.createdAt).toLocaleTimeString()} — {r.question.slice(0, 40)}
              </option>
            ))}
          </select>
        )}
      </Card>

      <Section title="Answers, side by side">
        <AnswerColumns results={run.results} />
      </Section>

      <Section title="What stands out">
        <InsightsStrip results={run.results} />
      </Section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <p className="eyebrow mb-4">Cost per strategy</p>
          <MetricBars rows={costBars} highlightLowest />
        </Card>
        <Card className="p-5">
          <p className="eyebrow mb-4">Latency per strategy</p>
          <MetricBars rows={latBars} highlightLowest />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <p className="eyebrow mb-1">Tokens per strategy</p>
          <p className="mb-4 text-[12px] text-ink-faint">input + output</p>
          <MetricBars rows={tokBars} highlightLowest />
        </Card>
        <Card className="p-5">
          <p className="eyebrow mb-1">Cost × latency</p>
          <p className="mb-2 text-[12px] text-ink-faint">lower-left is cheaper and faster</p>
          <ParetoChart
            points={pareto}
            xLabel="cost (USD)"
            yLabel="latency"
            xFmt={(v) => `$${v.toFixed(4)}`}
            yFmt={(v) => fmtMs(v)}
          />
        </Card>
      </div>

      <Section title="Pipeline diff">
        <TraceDiff results={run.results} />
      </Section>

      <Section title="Retrieval inspector">
        <RetrievalInspector results={run.results} />
      </Section>
    </div>
  );
}

function Heading() {
  return (
    <div className="flex items-end justify-between gap-3">
      <div>
        <p className="eyebrow">Compare</p>
        <h1 className="mt-2 font-display text-[44px] leading-none tracking-tightest">
          Two answers, one truth
        </h1>
        <p className="mt-3 max-w-[52ch] text-[15px] text-ink-muted">
          Inspect your latest Playground run: where strategies agree, what they retrieved, and what
          the extra machinery actually bought you.
        </p>
      </div>
      <Link href="/playground" className="inline-flex items-center gap-1.5 text-[13px] text-ink-muted hover:text-ink">
        <GitCompare className="h-4 w-4" /> New run
      </Link>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="p-5 sm:p-6">
      <p className="eyebrow mb-4">{title}</p>
      {children}
    </Card>
  );
}
