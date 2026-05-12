import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { data, fmtPct, fmtUSD } from "@/lib/data";
import { MetricCard } from "@/components/MetricCard";
import { Leaderboard } from "@/components/Leaderboard";
import { ParetoChart } from "@/components/ParetoChart";
import { ProbeBreakdown } from "@/components/ProbeBreakdown";
import { Finding } from "@/components/Finding";
import { ApproachChip } from "@/components/ApproachChip";
import type { ApproachKey } from "@/lib/types";

export default function OverviewPage() {
  const sorted = [...data.headline].sort((a, b) => b.f1 - a.f1);
  const top = sorted[0];
  const worst = sorted[sorted.length - 1];
  const allApproaches = data.headline.map((r) => r.approach as ApproachKey);

  return (
    <>
      {/* HERO */}
      <section className="pt-20 pb-12 animate-fade-up">
        <p className="eyebrow">
          Long-context strategy comparison ·{" "}
          {data.is_sweep
            ? `${data.headline[0]?.n_seeds ?? 3} seeds @ T=${data.temperature?.toFixed(1) ?? "0.3"}`
            : "single seed @ T=0"}
          {" "}· N={data.eval_set.n_questions}
        </p>
        <h1 className="mt-5 font-display tracking-tightest text-[72px] sm:text-[92px] lg:text-[112px] leading-[0.92] text-ink">
          Seven strategies,
          <br />
          <span className="italic text-ink-muted">honestly compared.</span>
        </h1>
        <p className="mt-8 max-w-[640px] text-[17px] text-ink-muted leading-relaxed">
          A reproducible head-to-head of four RAG variants and three non-RAG long-context techniques,
          run under identical conditions on a hand-authored eval set with bootstrap 95% confidence
          intervals and budget-bounded total spend.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link
            href="/pareto"
            className="group inline-flex items-center gap-2 bg-ink text-canvas px-5 py-3 rounded-full text-[14px] font-medium hover:bg-ink/90 transition-colors"
          >
            Pareto frontier
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/compare"
            className="inline-flex items-center gap-2 border border-ink/15 px-5 py-3 rounded-full text-[14px] font-medium text-ink hover:bg-ink/[0.04] transition-colors"
          >
            Compare approaches
          </Link>
        </div>
      </section>

      {/* TOP METRICS */}
      <section
        className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4 animate-fade-up"
        style={{ animationDelay: "120ms" }}
      >
        <MetricCard
          eyebrow="Best F1"
          value={fmtPct(top.f1, 1)}
          caption={`Achieved by ${top.approach.replace(/_/g, " ")}, with a 95% CI of ${fmtPct(
            top.f1_lo,
            0
          )}–${fmtPct(top.f1_hi, 0)}.`}
        />
        <MetricCard
          eyebrow="Approaches"
          value={data.headline.length}
          unit="/ 7"
          caption="Four RAG · three non-RAG · identical answer prompt across all."
        />
        <MetricCard
          eyebrow="Total spend"
          value={fmtUSD(data.project.cumulative_spend_usd, 4)}
          unit={`/ ${fmtUSD(data.project.budget_cap_usd, 0)}`}
          caption={`${data.project.spend_pct.toFixed(1)}% of cap used across ${data.project.total_llm_calls} LLM calls.`}
        />
        <MetricCard
          eyebrow="Eval set"
          value={data.eval_set.n_questions}
          unit="questions"
          caption={`${Object.entries(data.eval_set.by_probe_type)
            .map(([k, v]) => `${v} ${k.replace("_", "-")}`)
            .join(" · ")}.`}
        />
      </section>

      {/* LEADERBOARD */}
      <section
        className="mt-24 animate-fade-up"
        style={{ animationDelay: "200ms" }}
      >
        <div className="flex items-end justify-between mb-6">
          <div>
            <p className="eyebrow">Leaderboard</p>
            <h2 className="mt-2 font-display text-[40px] tracking-tightest leading-none">
              Ranked by token F1
            </h2>
          </div>
          <p className="hidden sm:block text-[13px] text-ink-muted max-w-[280px] text-right">
            Bars show point estimate with bootstrap 95% confidence interval.
            Smaller is faster, lower is cheaper.
          </p>
        </div>
        <Leaderboard rows={data.headline} />
      </section>

      {/* PARETO */}
      <section
        className="mt-24 animate-fade-up"
        style={{ animationDelay: "260ms" }}
      >
        <div className="flex items-end justify-between mb-6">
          <div>
            <p className="eyebrow">Cost × Quality</p>
            <h2 className="mt-2 font-display text-[40px] tracking-tightest leading-none">
              The Pareto frontier
            </h2>
          </div>
          <Link
            href="/pareto"
            className="text-[13px] text-ink-muted hover:text-ink inline-flex items-center gap-1.5 group"
          >
            Detailed view
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
        <div className="card p-6 sm:p-10">
          <ParetoChart rows={data.headline} metric="f1" />
          <div className="mt-6 flex flex-wrap gap-2">
            {allApproaches.map((a) => (
              <ApproachChip key={a} approach={a} size="sm" showFamily />
            ))}
          </div>
        </div>
      </section>

      {/* PROBE BREAKDOWN */}
      <section
        className="mt-24 animate-fade-up"
        style={{ animationDelay: "320ms" }}
      >
        <div className="flex items-end justify-between mb-6">
          <div>
            <p className="eyebrow">Per-probe F1</p>
            <h2 className="mt-2 font-display text-[40px] tracking-tightest leading-none">
              Where each approach lives or dies
            </h2>
          </div>
          <p className="hidden sm:block text-[13px] text-ink-muted max-w-[280px] text-right">
            All probe types, all approaches, single chart. Outer ring = perfect.
          </p>
        </div>
        <div className="card p-6 sm:p-10">
          <ProbeBreakdown rows={data.per_probe} approaches={allApproaches} metric="f1" />
        </div>
      </section>

      {/* FINDINGS */}
      <section
        className="mt-24 animate-fade-up"
        style={{ animationDelay: "380ms" }}
      >
        <p className="eyebrow">What we learned</p>
        <h2 className="mt-2 font-display text-[40px] tracking-tightest leading-none">
          Five honest takeaways
        </h2>
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Finding number="01" title="At sub-window scale, non-retrieval wins.">
            Sliding-window and full-context hold the top two F1 scores at
            {" "}{fmtPct(top.f1, 1)} and {fmtPct(sorted[1].f1, 1)}. When the corpus already fits,
            retrieval&apos;s chunk-selection job is overhead.
          </Finding>
          <Finding
            number="02"
            title="Pre-summarization destroys factoid recall."
            variant="warning"
          >
            Recursive Summarization scored {fmtPct(worst.f1, 1)} F1 — specific identifiers like
            <span className="font-mono text-[13px]"> MULBERRY-7Q</span> were stripped despite
            explicit “preserve all facts” instructions. The only statistically significant gap in the run.
          </Finding>
          <Finding number="03" title="Hallucination floor is universal.">
            All seven approaches refused correctly on all six deliberately-absent questions
            (100% across the board). The strict-refusal prompt transfers cleanly across retrieval and
            non-retrieval pipelines.
          </Finding>
          <Finding number="04" title="EM is bounded by verbosity, not retrieval.">
            The top six approaches cluster at EM ≈ 0.65 because the model wraps answers
            (&ldquo;Twenty-five years&rdquo; instead of &ldquo;25 years&rdquo;). F1 captures the
            real signal — the spread there is 0.79–0.90.
          </Finding>
          <Finding number="05" title="Six approaches are statistically tied.">
            Holm-corrected paired Wilcoxon at N=34 separates only Recursive Summarization
            from the rest (p ≤ 0.003). The next phase&apos;s 3-seed sweep is what will let the
            rank order speak with confidence.
          </Finding>
          <Finding number="06" title="Cost discipline holds." variant="positive">
            Total project spend: {fmtUSD(data.project.cumulative_spend_usd, 4)} of the
            {" "}{fmtUSD(data.project.budget_cap_usd, 0)} cap.
            {" "}{(data.project.spend_pct).toFixed(1)}% used; budget headroom for ~{Math.floor(
              (data.project.budget_cap_usd - data.project.cumulative_spend_usd) / 0.05
            )} more full eval-set runs.
          </Finding>
        </div>
      </section>
    </>
  );
}
