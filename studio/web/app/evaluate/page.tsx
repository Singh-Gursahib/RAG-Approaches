"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Square, KeyRound, Download, ClipboardCheck, Save } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";
import { EmptyState } from "@/components/ui/EmptyState";
import { Segmented } from "@/components/ui/Controls";
import { HelpPopover } from "@/components/ui/Tooltip";
import { useToast } from "@/components/ui/Toast";
import { KeyModal } from "@/components/shell/KeyModal";
import { CorpusUploader, type CorpusState } from "@/components/run/CorpusUploader";
import { ApproachPicker } from "@/components/run/ApproachPicker";
import { QuestionSetEditor, type EvalRow } from "@/components/eval/QuestionSetEditor";
import { EvalProgress, type ApproachProgress } from "@/components/eval/EvalProgress";
import { EvalResultsView } from "@/components/eval/EvalResultsView";
import { api, ApiError } from "@/lib/api";
import { useStream } from "@/lib/sse";
import { useKey } from "@/lib/useKey";
import { fmtUSD } from "@/lib/format";
import { saveEval, newId } from "@/lib/store";
import type { ApproachKey, EvalResults, SSEvent } from "@/lib/types";

const DEFAULT_CORPUS: CorpusState = {
  documents: [],
  chunking: { target_tokens: 150, overlap_tokens: 30 },
  stats: null,
  label: "",
};

export default function EvaluatePage() {
  const { present } = useKey();
  const toast = useToast();
  const { running, start, stop } = useStream();

  const [corpus, setCorpus] = useState<CorpusState>(DEFAULT_CORPUS);
  const [rows, setRows] = useState<EvalRow[]>([]);
  const [approaches, setApproaches] = useState<ApproachKey[]>(["naive", "rerank", "full_context"]);
  const [keyModal, setKeyModal] = useState(false);
  const [estimateCost, setEstimateCost] = useState<number | null>(null);

  const [progress, setProgress] = useState<Record<string, ApproachProgress>>({});
  const [results, setResults] = useState<EvalResults | null>(null);
  const [metric, setMetric] = useState<"em" | "f1">("f1");
  const submittedRef = useRef<EvalRow[]>([]);

  const validRows = rows.filter((r) => r.question.trim() && r.gold_answer.trim());
  const ready = corpus.documents.length > 0 && validRows.length > 0 && approaches.length > 0;

  useEffect(() => {
    if (!corpus.stats || !validRows.length || !approaches.length) {
      setEstimateCost(null);
      return;
    }
    const t = setTimeout(() => {
      api
        .estimate({
          n_questions: validRows.length,
          approaches,
          corpus_tokens: corpus.stats!.est_tokens,
          n_docs: corpus.stats!.n_docs,
        })
        .then((e) => setEstimateCost(e.total_cost_usd))
        .catch(() => setEstimateCost(null));
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [corpus.stats, validRows.length, approaches]);

  async function handleRun() {
    if (!present) return setKeyModal(true);
    if (!ready) return;
    setResults(null);
    submittedRef.current = validRows;

    const init: Record<string, ApproachProgress> = {};
    approaches.forEach((a) => (init[a] = { approach: a, done: 0, total: validRows.length, cost: 0, status: "queued" }));
    setProgress(init);

    let sessionId: string;
    try {
      const res = await api.createSession(corpus.documents, corpus.chunking);
      sessionId = res.session_id;
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not prepare the corpus.", "error");
      return;
    }

    const patch = (a: string, fn: (p: ApproachProgress) => ApproachProgress) =>
      setProgress((prev) => ({ ...prev, [a]: fn(prev[a]) }));

    await start(
      "/eval",
      {
        session_id: sessionId,
        questions: validRows.map((r) => ({ question: r.question, gold_answer: r.gold_answer, type: r.type })),
        approaches,
        retrieval: { top_k: 5, top_n_for_rerank: 20 },
        llm: { model: "gemini-3-flash-preview", temperature: 0, max_output_tokens: 256 },
      },
      (e: SSEvent) => {
        const ap = e.approach as string | undefined;
        switch (e.event) {
          case "approach_eval_start":
            if (ap) patch(ap, (p) => ({ ...p, status: "running" }));
            break;
          case "index_building":
            if (ap) patch(ap, (p) => ({ ...p, status: "building" }));
            break;
          case "index_ready":
            if (ap) patch(ap, (p) => ({ ...p, status: "running" }));
            break;
          case "question_done":
            if (ap)
              patch(ap, (p) => ({ ...p, status: "running", done: e.i as number, cost: p.cost + (e.cost_usd as number) }));
            break;
          case "approach_eval_done":
            if (ap) patch(ap, (p) => ({ ...p, status: "done", done: p.total }));
            break;
          case "eval_done": {
            const res = e.results as EvalResults;
            // Attach question text by index (backend omits it).
            res.questions = res.questions.map((q, i) => ({
              ...q,
              question_text: submittedRef.current[i]?.question,
            }));
            setResults(res);
            saveEval({
              id: newId(),
              kind: "eval",
              createdAt: Date.now(),
              label: corpus.label || `${corpus.stats?.n_docs ?? 0} docs · ${res.totals.n_questions} Q`,
              source: "custom",
              approaches: res.approaches,
              results: res,
              totalCost: res.totals.cost_usd,
            });
            toast("Evaluation complete and saved to history.", "success");
            break;
          }
          case "fatal":
            toast((e.message as string) || "Evaluation failed.", "error");
            break;
        }
      },
    );
  }

  const progressItems = approaches.map((a) => progress[a]).filter(Boolean);
  const totalCost = progressItems.reduce((acc, p) => acc + p.cost, 0);

  return (
    <div className="shell space-y-6 py-10">
      <div>
        <p className="eyebrow">Evaluate</p>
        <h1 className="mt-2 font-display text-[44px] leading-none tracking-tightest">
          Grade strategies on your data
        </h1>
        <p className="mt-3 max-w-[56ch] text-[15px] text-ink-muted">
          Bring questions with known answers. RAG Atlas runs every strategy, scores them with EM and F1,
          and reports confidence intervals, significance, and refusal honesty — the paper’s methodology,
          on your corpus.
        </p>
      </div>

      <Step n={1} title="Corpus" hint="The documents your questions are about.">
        <CorpusUploader value={corpus} onChange={setCorpus} />
      </Step>

      <Step n={2} title="Question set with gold answers" hint="Type or import questions paired with their correct answers.">
        <QuestionSetEditor rows={rows} onChange={setRows} />
      </Step>

      <Step n={3} title="Strategies" hint="Every selected strategy is graded on the same questions.">
        <ApproachPicker selected={approaches} onChange={setApproaches} corpusTokens={corpus.stats?.est_tokens ?? null} />
      </Step>

      <Card className="flex flex-wrap items-center gap-3 p-5">
        {running ? (
          <Button variant="danger" leftIcon={<Square className="h-4 w-4" />} onClick={stop}>
            Stop
          </Button>
        ) : present ? (
          <Button leftIcon={<Play className="h-4 w-4" />} onClick={handleRun} disabled={!ready}>
            Evaluate {validRows.length} question{validRows.length === 1 ? "" : "s"} × {approaches.length}
          </Button>
        ) : (
          <Button leftIcon={<KeyRound className="h-4 w-4" />} onClick={() => setKeyModal(true)}>
            Add your key to evaluate
          </Button>
        )}
        {estimateCost != null && (
          <span className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-muted">
            <Tag tone="neutral">≈ {fmtUSD(estimateCost)} total</Tag>
            <HelpPopover>Pre-flight estimate across {approaches.length} strategies × {validRows.length} questions.</HelpPopover>
          </span>
        )}
        {!ready && <span className="text-[12.5px] text-ink-faint">Add a corpus, at least one question with a gold answer, and a strategy.</span>}
      </Card>

      {/* live progress */}
      {progressItems.length > 0 && (
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <p className="eyebrow">{running ? "Running…" : "Run complete"}</p>
            <span className="tnum font-mono text-[12.5px] text-ink-muted">{fmtUSD(totalCost)} spent</span>
          </div>
          <EvalProgress items={progressItems} />
        </Card>
      )}

      {/* results */}
      {results ? (
        <EvalResultsView results={results} metric={metric} setMetric={setMetric} />
      ) : (
        !running &&
        progressItems.length === 0 && (
          <EmptyState
            icon={<ClipboardCheck className="h-5 w-5" />}
            title="No evaluation yet"
            body="Load the sample corpus and the sample question set, keep the default strategies, and press Evaluate to see a full scored leaderboard."
          />
        )
      )}

      <KeyModal open={keyModal} onClose={() => setKeyModal(false)} />
    </div>
  );
}

function Step({ n, title, hint, children }: { n: number; title: string; hint: string; children: React.ReactNode }) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-4 flex items-start gap-3">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink font-mono text-[13px] text-canvas">{n}</span>
        <div>
          <h2 className="text-[17px] font-medium tracking-tight">{title}</h2>
          <p className="mt-0.5 text-[13px] text-ink-muted">{hint}</p>
        </div>
      </div>
      {children}
    </Card>
  );
}
