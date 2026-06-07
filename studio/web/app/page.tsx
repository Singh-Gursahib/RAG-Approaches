import Link from "next/link";
import { ArrowRight, Upload, GitCompare, Compass } from "lucide-react";
import { Reveal } from "@/components/ui/Reveal";
import { BackendStatus } from "@/components/shell/BackendStatus";
import { APPROACHES, APPROACH_ORDER } from "@/lib/approaches";

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
            <span className="text-ink">your own Gemini key</span>. Compare answers, cost,
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

      {/* ── APPROACH STRIP ───────────────────────────────────────────────── */}
      <section className="shell pb-20">
        <Reveal delay={0.24}>
          <div className="card overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-line px-6 py-4">
              <p className="eyebrow">Seven strategies, one harness</p>
              <p className="hidden text-[12.5px] text-ink-faint sm:block">
                4 RAG · 3 non-RAG · identical answer prompt
              </p>
            </div>
            <ul className="grid grid-cols-1 divide-y divide-line sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4">
              {APPROACH_ORDER.map((k, i) => {
                const a = APPROACHES[k];
                return (
                  <Reveal as="li" key={k} delay={0.28 + i * 0.04}>
                    <div className="group flex h-full flex-col gap-2 border-line p-5 transition-colors hover:bg-canvas/60 sm:border-r">
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: a.color }}
                        />
                        <span className="font-medium tracking-tight">{a.label}</span>
                      </span>
                      <span className="text-[13px] leading-snug text-ink-muted">
                        {a.tagline}
                      </span>
                      <span className="mt-auto font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-faint">
                        {a.family}
                      </span>
                    </div>
                  </Reveal>
                );
              })}
            </ul>
          </div>
        </Reveal>
      </section>

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
