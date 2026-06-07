"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Play, Square, FlaskConical, KeyRound, Wand2, GitCompare, Bookmark } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Tag } from "@/components/ui/Tag";
import { EmptyState } from "@/components/ui/EmptyState";
import { HelpPopover } from "@/components/ui/Tooltip";
import { useToast } from "@/components/ui/Toast";
import { KeyModal } from "@/components/shell/KeyModal";
import { CorpusUploader, type CorpusState } from "@/components/run/CorpusUploader";
import { ApproachPicker } from "@/components/run/ApproachPicker";
import { RetrievalConfig } from "@/components/run/RetrievalConfig";
import { AnswerCard } from "@/components/run/AnswerCard";
import type { ApproachRunState } from "@/components/run/runState";
import { api, ApiError } from "@/lib/api";
import { useStream } from "@/lib/sse";
import { useKey } from "@/lib/useKey";
import { fmtUSD } from "@/lib/format";
import { saveRun, newId, takePendingConfig, saveConfig } from "@/lib/store";
import { SAMPLE_QUESTIONS } from "@/lib/samples";
import type {
  ApproachDoneEvent,
  ApproachKey,
  EstimateResponse,
  LLMConfig,
  RetrievalConfig as RC,
  SSEvent,
  StepEvent,
} from "@/lib/types";

const DEFAULT_CORPUS: CorpusState = {
  documents: [],
  chunking: { target_tokens: 150, overlap_tokens: 30 },
  stats: null,
  label: "",
};

export default function PlaygroundPage() {
  const { present } = useKey();
  const toast = useToast();
  const { running, start, stop } = useStream();

  const [corpus, setCorpus] = useState<CorpusState>(DEFAULT_CORPUS);
  const [approaches, setApproaches] = useState<ApproachKey[]>(["naive", "rerank", "full_context"]);
  const [retrieval, setRetrieval] = useState<RC>({ top_k: 5, top_n_for_rerank: 20 });
  const [llm, setLLM] = useState<LLMConfig>({ model: "gemini-3-flash-preview", temperature: 0, max_output_tokens: 256 });
  const [question, setQuestion] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [keyModal, setKeyModal] = useState(false);

  const [estimate, setEstimate] = useState<EstimateResponse | null>(null);
  const [states, setStates] = useState<Record<string, ApproachRunState>>({});
  const [savingConfig, setSavingConfig] = useState(false);
  const [configName, setConfigName] = useState("");

  // Apply a configuration handed over from History (one-shot).
  useEffect(() => {
    const pending = takePendingConfig();
    if (pending) {
      setApproaches(pending.approaches);
      setRetrieval(pending.retrieval);
      setCorpus((c) => ({ ...c, chunking: pending.chunking }));
      toast(`Applied configuration “${pending.name}”.`, "info");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSaveConfig() {
    const name = configName.trim();
    if (!name) return;
    saveConfig({ name, approaches, retrieval, chunking: corpus.chunking });
    setSavingConfig(false);
    setConfigName("");
    toast(`Saved configuration “${name}”.`, "success");
  }

  // Session reuse keyed by corpus signature.
  const sessionRef = useRef<{ id: string; sig: string } | null>(null);
  const corpusSig = useMemo(
    () => JSON.stringify({ d: corpus.documents, c: corpus.chunking }),
    [corpus.documents, corpus.chunking],
  );

  const ready = corpus.documents.length > 0 && approaches.length > 0 && question.trim().length > 0;

  // Pre-flight estimate (debounced).
  useEffect(() => {
    if (!corpus.stats || approaches.length === 0) {
      setEstimate(null);
      return;
    }
    const t = setTimeout(() => {
      api
        .estimate({
          n_questions: 1,
          approaches,
          corpus_tokens: corpus.stats!.est_tokens,
          n_docs: corpus.stats!.n_docs,
          retrieval,
          llm,
        })
        .then(setEstimate)
        .catch(() => setEstimate(null));
    }, 300);
    return () => clearTimeout(t);
  }, [corpus.stats, approaches, retrieval, llm]);

  const patch = useCallback((approach: string, fn: (s: ApproachRunState) => ApproachRunState) => {
    setStates((prev) => ({ ...prev, [approach]: fn(prev[approach]) }));
  }, []);

  async function ensureSession(): Promise<string> {
    if (sessionRef.current && sessionRef.current.sig === corpusSig) return sessionRef.current.id;
    const res = await api.createSession(corpus.documents, corpus.chunking);
    sessionRef.current = { id: res.session_id, sig: corpusSig };
    return res.session_id;
  }

  async function handleRun() {
    if (!present) {
      setKeyModal(true);
      return;
    }
    if (!ready) return;

    const init: Record<string, ApproachRunState> = {};
    approaches.forEach((a) => (init[a] = { approach: a, status: "queued", steps: [] }));
    setStates(init);

    let sessionId: string;
    try {
      sessionId = await ensureSession();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not prepare the corpus.", "error");
      return;
    }

    const finished: ApproachDoneEvent[] = [];
    const stepsByApproach: Record<string, StepEvent[]> = {};

    await start(
      "/run",
      { session_id: sessionId, question: question.trim(), approaches, retrieval, llm },
      (e: SSEvent) => {
        const ap = e.approach as string | undefined;
        switch (e.event) {
          case "approach_start":
            if (ap) patch(ap, (s) => ({ ...s, status: "running" }));
            break;
          case "index_building":
            if (ap) patch(ap, (s) => ({ ...s, status: "building" }));
            break;
          case "index_ready":
            if (ap) patch(ap, (s) => ({ ...s, status: "running", buildMs: e.ms as number }));
            break;
          case "step":
            if (ap) {
              const se = e as unknown as StepEvent;
              (stepsByApproach[ap] ||= []).push(se);
              patch(ap, (s) => ({ ...s, status: "running", steps: [...s.steps, se] }));
            }
            break;
          case "approach_done":
            if (ap) {
              finished.push(e as unknown as ApproachDoneEvent);
              patch(ap, (s) => ({ ...s, status: "done", done: e as unknown as ApproachDoneEvent }));
            }
            break;
          case "approach_error":
            if (ap) patch(ap, (s) => ({ ...s, status: "error", error: e.message as string }));
            break;
          case "fatal":
            toast((e.message as string) || "Run failed.", "error");
            break;
        }
      },
    );

    // Persist to history for the Compare page.
    if (finished.length) {
      saveRun({
        id: newId(),
        kind: "playground",
        createdAt: Date.now(),
        question: question.trim(),
        corpusLabel: corpus.label || `${corpus.stats?.n_docs ?? 0} docs`,
        approaches,
        totalCost: finished.reduce((acc, d) => acc + d.cost_usd, 0),
        results: finished.map((d) => ({
          approach: d.approach,
          answer: d.answer,
          refused: d.refused,
          cost_usd: d.cost_usd,
          latency_ms: d.latency_ms,
          wall_ms: d.wall_ms,
          tokens_in: d.tokens_in,
          tokens_out: d.tokens_out,
          n_steps: d.n_steps,
          retrieved: d.retrieved,
          steps: (stepsByApproach[d.approach] || []).map((s) => ({
            step: s.step,
            output: s.output,
            latency_ms: s.latency_ms,
            cost_usd: s.cost_usd,
          })),
        })),
      });
    }
  }

  const orderedStates = approaches.map((a) => states[a]).filter(Boolean);
  const hasResults = orderedStates.length > 0;

  return (
    <div className="shell space-y-6 py-10">
      {/* heading */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Playground</p>
          <h1 className="mt-2 font-display text-[44px] leading-none tracking-tightest">
            Ask anything, any way
          </h1>
          <p className="mt-3 max-w-[52ch] text-[15px] text-ink-muted">
            Bring a corpus, pick a few strategies, and watch each one retrieve and reason —
            side by side, with live cost.
          </p>
        </div>
        <Link href="/compare" className="inline-flex items-center gap-1.5 text-[13px] text-ink-muted hover:text-ink">
          <GitCompare className="h-4 w-4" /> Compare last run
        </Link>
      </div>

      {/* STEP 1 — corpus */}
      <Step n={1} title="Your corpus" hint="Paste, upload, or load the sample. We chunk it the same way for every strategy.">
        <CorpusUploader value={corpus} onChange={setCorpus} />
      </Step>

      {/* STEP 2 — approaches */}
      <Step n={2} title="Strategies to compare" hint="Choose any mix of RAG and non-RAG approaches.">
        <ApproachPicker
          selected={approaches}
          onChange={setApproaches}
          corpusTokens={corpus.stats?.est_tokens ?? null}
        />
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowAdvanced((v) => !v)}
            className="text-[12.5px] text-ink-faint hover:text-ink"
          >
            {showAdvanced ? "Hide" : "Show"} retrieval & model settings
          </button>
          <span className="text-ink-faint">·</span>
          {savingConfig ? (
            <span className="inline-flex items-center gap-2">
              <Input
                autoFocus
                value={configName}
                onChange={(e) => setConfigName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSaveConfig()}
                placeholder="Config name…"
                className="h-8 w-44 py-1"
              />
              <Button size="sm" onClick={handleSaveConfig} disabled={!configName.trim()}>Save</Button>
              <Button size="sm" variant="quiet" onClick={() => setSavingConfig(false)}>Cancel</Button>
            </span>
          ) : (
            <button
              onClick={() => setSavingConfig(true)}
              disabled={approaches.length === 0}
              className="inline-flex items-center gap-1 text-[12.5px] text-ink-faint hover:text-ink disabled:opacity-50"
            >
              <Bookmark className="h-3.5 w-3.5" /> Save as config
            </button>
          )}
        </div>
        {showAdvanced && (
          <div className="mt-4 rounded-card border border-line bg-canvas/40 p-4">
            <RetrievalConfig
              retrieval={retrieval}
              llm={llm}
              selected={approaches}
              onRetrieval={setRetrieval}
              onLLM={setLLM}
            />
          </div>
        )}
      </Step>

      {/* STEP 3 — ask */}
      <Step n={3} title="Your question" hint="Ask something your corpus can (or can’t) answer.">
        <div className="flex flex-col gap-3">
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ready && !running && handleRun()}
            placeholder="e.g. What year was the institute founded?"
          />
          <div className="flex flex-wrap gap-1.5">
            {SAMPLE_QUESTIONS.map((q) => (
              <button
                key={q.question}
                onClick={() => setQuestion(q.question)}
                className="rounded-pill border border-line px-2.5 py-1 text-[11.5px] text-ink-muted hover:bg-ink/[0.04] hover:text-ink"
                title={q.note}
              >
                {q.question.length > 48 ? q.question.slice(0, 48) + "…" : q.question}
              </button>
            ))}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-3">
            {running ? (
              <Button variant="danger" leftIcon={<Square className="h-4 w-4" />} onClick={stop}>
                Stop
              </Button>
            ) : present ? (
              <Button
                leftIcon={<Play className="h-4 w-4" />}
                onClick={handleRun}
                disabled={!ready}
              >
                Run {approaches.length} {approaches.length === 1 ? "strategy" : "strategies"}
              </Button>
            ) : (
              <Button leftIcon={<KeyRound className="h-4 w-4" />} onClick={() => setKeyModal(true)}>
                Add your key to run
              </Button>
            )}

            {estimate && (
              <span className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-muted">
                <Tag tone="neutral">≈ {fmtUSD(estimate.total_cost_usd)} / run</Tag>
                <HelpPopover>
                  Rough pre-flight estimate across the selected strategies for one question.
                </HelpPopover>
              </span>
            )}
          </div>
        </div>
      </Step>

      {/* RESULTS */}
      <section className="pt-2" aria-live="polite" aria-busy={running}>
        {hasResults ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {orderedStates.map((s) => (
              <AnswerCard key={s.approach} state={s} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<FlaskConical className="h-5 w-5" />}
            title="No runs yet"
            body="Load the sample corpus, keep the default strategies, and ask one of the suggested questions to see RAG Atlas in action."
            action={
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<Wand2 className="h-4 w-4" />}
                onClick={() => {
                  setCorpus((c) => c); // no-op; CorpusUploader has its own sample button
                  toast("Use “Load sample” in step 1, then pick a suggested question.", "info");
                }}
              >
                How do I start?
              </Button>
            }
          />
        )}
      </section>

      <KeyModal open={keyModal} onClose={() => setKeyModal(false)} />
    </div>
  );
}

function Step({
  n,
  title,
  hint,
  children,
}: {
  n: number;
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-4 flex items-start gap-3">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink font-mono text-[13px] text-canvas">
          {n}
        </span>
        <div>
          <h2 className="text-[17px] font-medium tracking-tight">{title}</h2>
          <p className="mt-0.5 text-[13px] text-ink-muted">{hint}</p>
        </div>
      </div>
      {children}
    </Card>
  );
}
