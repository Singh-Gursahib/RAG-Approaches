"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Compass, ArrowRight, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Dot, Tag } from "@/components/ui/Tag";
import { DomainGuide } from "@/components/learn/DomainGuide";
import { DOMAINS, DOMAIN_BY_KEY } from "@/lib/domains";
import { APPROACHES } from "@/lib/approaches";
import { recommend, REC_QUESTIONS, type RecAnswers } from "@/lib/recommend";

export default function RecommendPage() {
  const [domainKey, setDomainKey] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Partial<RecAnswers>>({});

  const complete = domainKey && REC_QUESTIONS.every((q) => answers[q.key]);
  const recs = useMemo(
    () => (complete ? recommend(domainKey!, answers as RecAnswers) : []),
    [complete, domainKey, answers],
  );
  const top = recs.filter((r) => r.score > 0).slice(0, 3);
  const maxScore = top[0]?.score ?? 1;

  return (
    <div className="shell space-y-6 py-10">
      <div>
        <p className="eyebrow">Recommend</p>
        <h1 className="mt-2 font-display text-[44px] leading-none tracking-tightest">
          Which strategy for your use case?
        </h1>
        <p className="mt-3 max-w-[56ch] text-[15px] text-ink-muted">
          Answer a few questions and RAG Atlas suggests a strategy — with reasons drawn from the
          research. It’s a starting point; validate it on your own data in Evaluate.
        </p>
      </div>

      {/* Step 1: domain */}
      <Card className="p-5 sm:p-6">
        <p className="eyebrow mb-4">1 · Pick your use case</p>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {DOMAINS.map((d) => (
            <button
              key={d.key}
              onClick={() => setDomainKey(d.key)}
              className={clsx(
                "rounded-card border p-4 text-left transition-colors",
                domainKey === d.key ? "border-ink/40 ring-1 ring-ink/10" : "border-line hover:border-ink/20",
              )}
            >
              <p className="font-medium tracking-tight">{d.label}</p>
              <p className="mt-1 text-[12.5px] leading-snug text-ink-muted">{d.blurb}</p>
            </button>
          ))}
        </div>
      </Card>

      {/* Step 2: questions */}
      {domainKey && (
        <Card className="p-5 sm:p-6">
          <p className="eyebrow mb-4">2 · A few questions</p>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {REC_QUESTIONS.map((q) => (
              <div key={q.key}>
                <p className="mb-2 text-[13px] font-medium text-ink">{q.label}</p>
                <div className="flex flex-wrap gap-2">
                  {q.options.map((o) => (
                    <button
                      key={o.value}
                      onClick={() => setAnswers((a) => ({ ...a, [q.key]: o.value }))}
                      title={o.hint}
                      className={clsx(
                        "rounded-pill border px-3 py-1.5 text-[12.5px] transition-colors",
                        answers[q.key] === o.value
                          ? "border-ink bg-ink text-canvas"
                          : "border-line text-ink-muted hover:bg-ink/[0.04] hover:text-ink",
                      )}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Step 3: recommendation */}
      {complete && (
        <>
          <Card className="p-5 sm:p-6">
            <p className="eyebrow mb-4">Your recommendation</p>
            <div className="space-y-3">
              {top.map((r, i) => {
                const a = APPROACHES[r.approach];
                return (
                  <div
                    key={r.approach}
                    className={clsx(
                      "rounded-card border p-4",
                      i === 0 ? "border-ink/30 bg-canvas/50" : "border-line",
                    )}
                    style={i === 0 ? { boxShadow: `inset 4px 0 0 ${a.color}` } : undefined}
                  >
                    <div className="flex items-center gap-2">
                      {i === 0 && (
                        <Tag tone="accent">
                          <Sparkles className="h-3 w-3" /> Best fit
                        </Tag>
                      )}
                      <span className="flex items-center gap-1.5 font-medium">
                        <Dot color={a.color} /> {a.label}
                      </span>
                      <span className="ml-auto h-1.5 w-24 rounded-pill bg-ink/[0.08]">
                        <span
                          className="block h-full rounded-pill"
                          style={{ width: `${Math.max(8, (r.score / maxScore) * 100)}%`, background: a.color }}
                        />
                      </span>
                    </div>
                    <p className="mt-2 text-[13px] text-ink-muted">{a.tagline}</p>
                    {r.reasons.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {r.reasons.slice(0, 3).map((why, j) => (
                          <li key={j} className="flex items-start gap-1.5 text-[12.5px] text-ink-muted">
                            <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-accent" />
                            {why}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                href="/evaluate"
                className="inline-flex items-center gap-1.5 rounded-pill bg-ink px-4 py-2 text-[13px] font-medium text-canvas hover:bg-ink/90"
              >
                Validate on your data <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/playground"
                className="inline-flex items-center gap-1.5 rounded-pill border border-line px-4 py-2 text-[13px] font-medium hover:bg-ink/[0.04]"
              >
                Try in the playground
              </Link>
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <p className="eyebrow mb-4">Why — {DOMAIN_BY_KEY[domainKey!].label}</p>
            <DomainGuide domain={DOMAIN_BY_KEY[domainKey!]} />
          </Card>
        </>
      )}

      {!domainKey && (
        <div className="flex items-center gap-2 text-[13px] text-ink-faint">
          <Compass className="h-4 w-4" /> Pick a use case to begin.
        </div>
      )}
    </div>
  );
}
