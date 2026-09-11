"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Gauge, RotateCcw } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Slider } from "@/components/ui/Controls";
import { Dot } from "@/components/ui/Tag";
import { Skeleton } from "@/components/ui/Skeleton";
import dynamic from "next/dynamic";
import { MetricBars, type BarRow } from "@/components/viz/MetricBars";

const ParetoChart = dynamic(() => import("@/components/viz/ParetoChart").then((m) => m.ParetoChart), {
  ssr: false,
  loading: () => <Skeleton className="h-[320px] w-full" />,
});
import { APPROACHES } from "@/lib/approaches";
import { api } from "@/lib/api";
import { listEvals, type StoredEval } from "@/lib/store";
import { fmtMs, fmtPct, fmtTokens, fmtUSD } from "@/lib/format";

export default function ProfilerPage() {
  const [evals, setEvals] = useState<StoredEval[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inPrice, setInPrice] = useState(0.3);
  const [outPrice, setOutPrice] = useState(2.5);
  const [defaults, setDefaults] = useState({ input_per_m: 0.3, output_per_m: 2.5 });

  useEffect(() => {
    const load = () => setEvals(listEvals());
    load();
    const id = new URLSearchParams(window.location.search).get("eval");
    if (id) setSelectedId(id);
    window.addEventListener("rag-atlas:evals-change", load);
    return () => window.removeEventListener("rag-atlas:evals-change", load);
  }, []);

  const ev = useMemo(() => evals.find((e) => e.id === selectedId) ?? evals[0], [evals, selectedId]);
  const evModel = ev?.model;

  // Start from the list price of the model the evaluation ran on.
  useEffect(() => {
    api.pricing(evModel).then((p) => {
      setDefaults({ input_per_m: p.input_per_m, output_per_m: p.output_per_m });
      setInPrice(p.input_per_m);
      setOutPrice(p.output_per_m);
    }).catch(() => {});
  }, [evModel]);

  const rows = useMemo(() => {
    if (!ev) return [];
    return ev.results.headline.map((h) => {
      const cost = (h.tokens_in / 1e6) * inPrice + (h.tokens_out / 1e6) * outPrice;
      const correct = Math.max(0, Math.round(h.accuracy * h.n));
      return {
        approach: h.approach,
        f1: h.f1,
        em: h.em,
        cost,
        costPerCorrect: correct > 0 ? cost / correct : Infinity,
        p50: h.p50_ms,
        p95: h.p95_ms,
        tokens: h.tokens_in + h.tokens_out,
      };
    });
  }, [ev, inPrice, outPrice]);

  if (!ev) {
    return (
      <div className="shell py-10">
        <Heading />
        <EmptyState
          className="mt-6"
          icon={<Gauge className="h-5 w-5" />}
          title="No evaluations to profile yet"
          body="Run an evaluation (or a replay) to unlock the cost × quality × latency profiler."
          action={
            <Link href="/evaluate">
              <Button size="sm">Run an evaluation</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const costBars: BarRow[] = rows.map((r) => ({ approach: r.approach, value: r.cost, display: fmtUSD(r.cost) }));
  const cpcBars: BarRow[] = rows
    .filter((r) => isFinite(r.costPerCorrect))
    .map((r) => ({ approach: r.approach, value: r.costPerCorrect, display: fmtUSD(r.costPerCorrect) }));
  const latBars: BarRow[] = rows.map((r) => ({ approach: r.approach, value: r.p50, display: fmtMs(r.p50) }));
  const tokBars: BarRow[] = rows.map((r) => ({ approach: r.approach, value: r.tokens, display: fmtTokens(r.tokens) }));
  const pareto = rows.map((r) => ({ approach: r.approach, x: r.cost, y: r.f1 }));
  const repriced = inPrice !== defaults.input_per_m || outPrice !== defaults.output_per_m;

  return (
    <div className="shell space-y-6 py-10">
      <Heading />

      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="eyebrow">Profiling</p>
          <p className="mt-1 font-display text-[20px] tracking-tight">{ev.label}</p>
          <p className="mt-0.5 text-[12.5px] text-ink-faint">
            {ev.source === "replay" ? "Replay" : "Custom"} · {ev.modelLabel ?? ev.model ?? "model not recorded"} ·{" "}
            {ev.results.totals.n_questions} questions ·{" "}
            {new Date(ev.createdAt).toLocaleString()}
          </p>
        </div>
        {evals.length > 1 && (
          <select
            value={ev.id}
            onChange={(e) => setSelectedId(e.target.value)}
            className="rounded-[10px] border border-line bg-surface px-3 py-2 text-[13px]"
          >
            {evals.map((e) => (
              <option key={e.id} value={e.id}>
                {new Date(e.createdAt).toLocaleString()} — {e.label}
              </option>
            ))}
          </select>
        )}
      </Card>

      {/* price tier */}
      <Card className="p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="eyebrow">Model price tier</p>
            <p className="mt-1 text-[13px] text-ink-muted">
              Re-price this run against any provider — costs recompute instantly from the recorded token counts.
            </p>
          </div>
          {repriced && (
            <Button
              size="sm"
              variant="quiet"
              leftIcon={<RotateCcw className="h-4 w-4" />}
              onClick={() => {
                setInPrice(defaults.input_per_m);
                setOutPrice(defaults.output_per_m);
              }}
            >
              Reset
            </Button>
          )}
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Slider label="Input $/1M tokens" value={inPrice} min={0} max={15} step={0.05} onChange={setInPrice} suffix="$/M" />
          <Slider label="Output $/1M tokens" value={outPrice} min={0} max={60} step={0.1} onChange={setOutPrice} suffix="$/M" />
        </div>
      </Card>

      {/* pareto */}
      <Card className="p-5 sm:p-6">
        <p className="eyebrow mb-1">Cost × quality</p>
        <p className="mb-2 text-[12px] text-ink-faint">Upper-left is the sweet spot: high F1, low cost.</p>
        <ParetoChart points={pareto} xLabel="cost (USD)" yLabel="F1" xFmt={(v) => `$${v.toFixed(4)}`} yFmt={(v) => v.toFixed(2)} />
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <p className="eyebrow mb-4">Total cost (re-priced)</p>
          <MetricBars rows={costBars} highlightLowest />
        </Card>
        <Card className="p-5">
          <p className="eyebrow mb-1">Cost per correct answer</p>
          <p className="mb-4 text-[12px] text-ink-faint">the true efficiency metric</p>
          <MetricBars rows={cpcBars} highlightLowest />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <p className="eyebrow mb-4">Median latency (p50)</p>
          <MetricBars rows={latBars} highlightLowest />
        </Card>
        <Card className="p-5">
          <p className="eyebrow mb-4">Token usage</p>
          <MetricBars rows={tokBars} highlightLowest />
        </Card>
      </div>

      {/* summary table */}
      <Card className="p-5 sm:p-6">
        <p className="eyebrow mb-4">Summary</p>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line text-[11px] uppercase tracking-wide text-ink-faint">
                <th className="px-3 py-2 text-left font-medium">Strategy</th>
                <th className="px-3 py-2 text-right font-medium">F1</th>
                <th className="px-3 py-2 text-right font-medium">Cost</th>
                <th className="px-3 py-2 text-right font-medium">$ / correct</th>
                <th className="px-3 py-2 text-right font-medium">p50</th>
              </tr>
            </thead>
            <tbody>
              {[...rows].sort((a, b) => b.f1 - a.f1).map((r) => (
                <tr key={r.approach} className="border-b border-line/60 last:border-0">
                  <td className="px-3 py-2.5">
                    <span className="flex items-center gap-2">
                      <Dot color={APPROACHES[r.approach].color} /> {APPROACHES[r.approach].label}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono">{fmtPct(r.f1, 1)}</td>
                  <td className="px-3 py-2.5 text-right font-mono">{fmtUSD(r.cost)}</td>
                  <td className="px-3 py-2.5 text-right font-mono">{isFinite(r.costPerCorrect) ? fmtUSD(r.costPerCorrect) : "—"}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-ink-muted">{fmtMs(r.p50)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Heading() {
  return (
    <div>
      <p className="eyebrow">Profiler</p>
      <h1 className="mt-2 font-display text-[44px] leading-none tracking-tightest">The economics of retrieval</h1>
      <p className="mt-3 max-w-[56ch] text-[15px] text-ink-muted">
        Cost, quality, and latency for an evaluation — with a price-tier slider that re-prices instantly
        against any provider, straight from the recorded token counts.
      </p>
    </div>
  );
}
