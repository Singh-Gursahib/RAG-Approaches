import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { data, fmtPct, fmtUSD, fmtMs, fmtCompact } from "@/lib/data";
import { APPROACH_COLOR, APPROACH_LABEL, APPROACH_FAMILY, APPROACH_TAGLINE, PROBE_LABEL, PROBE_COLOR } from "@/lib/colors";
import type { ApproachKey, ProbeType } from "@/lib/types";
import { ForestPlot } from "@/components/ForestPlot";
import { ProbeBreakdown } from "@/components/ProbeBreakdown";

const APPROACHES: ApproachKey[] = [
  "sliding_window",
  "full_context",
  "rerank",
  "naive",
  "hyde",
  "hybrid",
  "recursive_summary",
];

export function generateStaticParams() {
  return APPROACHES.map((name) => ({ name }));
}

export default function ApproachDetailPage({ params }: { params: { name: string } }) {
  const { name } = params;
  if (!APPROACHES.includes(name as ApproachKey)) notFound();
  const a = name as ApproachKey;

  const row = data.headline.find((r) => r.approach === a);
  if (!row) notFound();

  const perProbe = data.per_probe.filter((r) => r.approach === a);
  const PROBE_ORDER: ProbeType[] = ["sanity", "hallucination", "needle", "multi_hop", "distractor"];
  const probeRows = PROBE_ORDER.map((p) => {
    const r = perProbe.find((x) => x.probe_type === p);
    return r!;
  }).filter(Boolean);

  // Per-question table for this approach.
  const myQuestions = data.questions
    .map((q) => ({ ...q, pred: q.predictions[a] }))
    .filter((q) => q.pred);

  const correct = myQuestions.filter((q) => q.pred!.correct).length;

  // Forest-plot rows: this approach vs all (highlight self).
  const forestEM = [...data.headline]
    .sort((x, y) => y.em - x.em)
    .map((r) => ({
      approach: r.approach as ApproachKey,
      label: APPROACH_LABEL[r.approach as ApproachKey],
      mean: r.em,
      lo: r.em_lo,
      hi: r.em_hi,
    }));
  const forestF1 = [...data.headline]
    .sort((x, y) => y.f1 - x.f1)
    .map((r) => ({
      approach: r.approach as ApproachKey,
      label: APPROACH_LABEL[r.approach as ApproachKey],
      mean: r.f1,
      lo: r.f1_lo,
      hi: r.f1_hi,
    }));

  return (
    <>
      <Link
        href="/"
        className="mt-10 inline-flex items-center gap-1.5 text-[13px] text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Overview
      </Link>

      <section className="pt-6 pb-8 animate-fade-up">
        <div className="flex items-center gap-3">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: APPROACH_COLOR[a] }} />
          <p className="eyebrow">{APPROACH_FAMILY[a]}</p>
        </div>
        <h1 className="mt-3 font-display tracking-tightest text-[64px] sm:text-[80px] leading-[0.96] text-ink">
          {APPROACH_LABEL[a]}
        </h1>
        <p className="mt-4 max-w-[640px] text-[18px] text-ink-muted leading-relaxed">
          {APPROACH_TAGLINE[a]}
        </p>
      </section>

      {/* HEADLINE NUMBERS */}
      <section
        className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-fade-up"
        style={{ animationDelay: "100ms" }}
      >
        <div className="card p-6">
          <p className="eyebrow">Exact Match</p>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="numeral text-[44px]">{fmtPct(row.em, 1)}</span>
          </div>
          <p className="mt-3 text-[11px] text-ink-muted font-mono tabular-nums">
            95% CI [{fmtPct(row.em_lo, 0)} – {fmtPct(row.em_hi, 0)}]
          </p>
        </div>
        <div className="card p-6">
          <p className="eyebrow">Token F1</p>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="numeral text-[44px]">{fmtPct(row.f1, 1)}</span>
          </div>
          <p className="mt-3 text-[11px] text-ink-muted font-mono tabular-nums">
            95% CI [{fmtPct(row.f1_lo, 0)} – {fmtPct(row.f1_hi, 0)}]
          </p>
        </div>
        <div className="card p-6">
          <p className="eyebrow">Run cost</p>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="numeral text-[44px]">{fmtUSD(row.cost_usd, 4)}</span>
          </div>
          <p className="mt-3 text-[11px] text-ink-muted font-mono tabular-nums">
            {fmtCompact(row.tokens_in)} in · {fmtCompact(row.tokens_out)} out
          </p>
        </div>
        <div className="card p-6">
          <p className="eyebrow">Latency</p>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="numeral text-[44px]">{fmtMs(row.p50_ms)}</span>
            <span className="text-[12px] text-ink-muted font-mono">p50</span>
          </div>
          <p className="mt-3 text-[11px] text-ink-muted font-mono tabular-nums">
            p95 {fmtMs(row.p95_ms)} · wall {row.wall_s.toFixed(0)}s
          </p>
        </div>
      </section>

      {/* FOREST PLOTS — ranks among 7 */}
      <section
        className="mt-16 grid grid-cols-1 lg:grid-cols-2 gap-4 animate-fade-up"
        style={{ animationDelay: "180ms" }}
      >
        <ForestPlot rows={forestEM} metricLabel="Exact Match · all approaches" highlight={a} />
        <ForestPlot rows={forestF1} metricLabel="Token F1 · all approaches" highlight={a} />
      </section>

      {/* PER-PROBE */}
      <section className="mt-16 animate-fade-up" style={{ animationDelay: "240ms" }}>
        <p className="eyebrow">Per-probe performance</p>
        <h2 className="mt-2 font-display text-[36px] tracking-tightest leading-none">
          Where this approach lives or dies
        </h2>
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card p-6">
            {probeRows.map((p) => (
              <div key={p.probe_type} className="py-3.5 border-b border-border last:border-0">
                <div className="flex items-baseline justify-between">
                  <span className="flex items-center gap-2 text-[13px] text-ink">
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: PROBE_COLOR[p.probe_type] }}
                    />
                    {PROBE_LABEL[p.probe_type]}
                    <span className="text-[11px] text-ink-faint font-mono">n={p.n}</span>
                  </span>
                  <span className="numeral text-[22px]">{fmtPct(p.f1, 0)}</span>
                </div>
                <div className="relative h-1.5 bg-ink/[0.06] rounded-full mt-2 overflow-hidden">
                  <div
                    className="absolute h-full rounded-full"
                    style={{
                      width: `${p.f1 * 100}%`,
                      backgroundColor: APPROACH_COLOR[a],
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="card p-6">
            <ProbeBreakdown rows={perProbe} approaches={[a]} metric="f1" />
          </div>
        </div>
      </section>

      {/* PER-QUESTION TABLE */}
      <section className="mt-16 animate-fade-up" style={{ animationDelay: "300ms" }}>
        <div className="flex items-end justify-between mb-4">
          <div>
            <p className="eyebrow">Predictions</p>
            <h2 className="mt-2 font-display text-[36px] tracking-tightest leading-none">
              Every answer, recorded
            </h2>
          </div>
          <p className="text-[13px] text-ink-muted tabular-nums">
            <span className="font-mono">{correct}</span> / {myQuestions.length} correct
          </p>
        </div>
        <div className="card overflow-hidden">
          <div className="grid grid-cols-[100px_70px_minmax(180px,1.2fr)_minmax(220px,1.5fr)_50px] px-6 py-3 border-b border-border text-[10px] uppercase tracking-widest text-ink-faint font-mono">
            <div>QID</div>
            <div>Type</div>
            <div>Gold</div>
            <div>Prediction</div>
            <div className="text-center">EM</div>
          </div>
          {myQuestions.map((q, i) => (
            <div
              key={q.qid}
              className={`grid grid-cols-[100px_70px_minmax(180px,1.2fr)_minmax(220px,1.5fr)_50px] items-center px-6 py-3 ${
                i !== myQuestions.length - 1 && "border-b border-border/70"
              }`}
            >
              <span className="font-mono text-[12px] text-ink-muted">{q.qid}</span>
              <span className="text-[11px] text-ink-faint">{PROBE_LABEL[q.type]}</span>
              <span className="text-[13px] text-ink truncate" title={q.gold}>
                {q.gold}
              </span>
              <span className="text-[13px] text-ink-muted truncate" title={q.pred!.pred}>
                {q.pred!.pred.length > 70 ? q.pred!.pred.slice(0, 70) + "…" : q.pred!.pred}
              </span>
              <span
                className={`text-center inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-mono ${
                  q.pred!.correct
                    ? "bg-approach-rerank/15 text-approach-rerank"
                    : "bg-accent/15 text-accent"
                }`}
              >
                {q.pred!.correct ? "✓" : "✗"}
              </span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
