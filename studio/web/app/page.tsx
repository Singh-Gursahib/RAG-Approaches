import Link from "next/link";
import { ArrowRight, Upload, GitCompare, Compass } from "lucide-react";
import { Reveal } from "@/components/ui/Reveal";
import { BackendStatus } from "@/components/shell/BackendStatus";
import { ApproachExplorer } from "@/components/home/ApproachExplorer";

export default function HomePage() {
  return (
    <>
      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="shell pt-20 pb-16 sm:pt-28">
        <Reveal>
          <p className="eyebrow">An interactive companion to the RAG_Ureap framework</p>
        </Reveal>
        <Reveal delay={0.06}>
          <h1 className="mt-6 max-w-[14ch] font-display text-[58px] leading-[0.94] tracking-tightest sm:text-[84px] lg:text-[104px]">
            Find the right
            <br />
            <span className="italic text-accent">retrieval strategy.</span>
          </h1>
        </Reveal>
        <Reveal delay={0.12}>
          <p className="mt-8 max-w-[560px] text-[17px] leading-relaxed text-ink-muted">
            Seven RAG and non-RAG strategies, run live on{" "}
            <span className="text-ink">your own documents</span> with{" "}
            <span className="text-ink">any model on OpenRouter</span>. Compare answers, cost,
            latency, and hallucination risk side by side — then get a recommendation tuned to
            your domain.
          </p>
        </Reveal>
        <Reveal delay={0.18}>
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Link
              href="/playground"
              className="group inline-flex items-center gap-2 rounded-pill bg-ink px-5 py-3 text-[14px] font-medium text-canvas transition-colors hover:bg-ink/90"
            >
              Open the playground
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/replay"
              className="inline-flex items-center gap-2 rounded-pill border border-line px-5 py-3 text-[14px] font-medium text-ink transition-colors hover:bg-ink/[0.04]"
            >
              Reproduce the paper
            </Link>
            <span className="ml-1">
              <BackendStatus />
            </span>
          </div>
        </Reveal>
      </section>

      {/* ── APPROACH EXPLORER (animated simulations) ─────────────────────── */}
      <ApproachExplorer />

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
      <section className="shell pb-28">
        <Reveal>
          <p className="eyebrow">How it works</p>
          <h2 className="mt-2 font-display text-[38px] leading-none tracking-tightest">
            Three steps to an answer you can trust
          </h2>
        </Reveal>
        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal key={s.title} delay={0.08 + i * 0.08}>
              <div className="card h-full p-6">
                <span className="grid h-10 w-10 place-items-center rounded-[11px] bg-accent-soft text-accent">
                  <s.icon className="h-5 w-5" />
                </span>
                <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint">
                  Step {i + 1}
                </p>
                <h3 className="mt-1.5 text-[18px] font-medium tracking-tight">{s.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">{s.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>
    </>
  );
}

const STEPS = [
  {
    icon: Upload,
    title: "Bring your corpus",
    body: "Paste or upload your documents. RAG Atlas chunks them and shows you exactly how — no black box.",
  },
  {
    icon: GitCompare,
    title: "Run & compare",
    body: "Pick any mix of strategies and watch each one think, step by step, with live cost and latency.",
  },
  {
    icon: Compass,
    title: "Get a recommendation",
    body: "See which strategy fits your domain — education, legal, healthcare, support — backed by the research.",
  },
];
