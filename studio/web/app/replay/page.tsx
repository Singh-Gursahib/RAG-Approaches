"use client";

import { useEffect, useMemo, useState } from "react";
import { Play, Square, KeyRound, BookOpenCheck } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Tag, Dot } from "@/components/ui/Tag";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { KeyModal } from "@/components/shell/KeyModal";
import { ApproachPicker } from "@/components/run/ApproachPicker";
import { EvalProgress, type ApproachProgress } from "@/components/eval/EvalProgress";
import { EvalResultsView } from "@/components/eval/EvalResultsView";
import { api } from "@/lib/api";
import { useStream } from "@/lib/sse";
import { useKey } from "@/lib/useKey";
import { APPROACHES, PROBE_LABEL } from "@/lib/approaches";
import { fmtPct, fmtUSD } from "@/lib/format";
import { saveEval, newId } from "@/lib/store";
import type { ApproachKey, EvalResults, SSEvent } from "@/lib/types";

interface ReplayMeta {
  corpus: { n_docs: number; total_words: number; documents: { doc_id: string; words: number }[] };
  eval_set: { n_questions: number; by_probe_type: Record<string, number> };
  paper_headline: { approach: string; em: number; f1: number; cost_usd: number }[];
  model: string;
  note: string;
}

export default function ReplayPage() {
  const { present } = useKey();
  const toast = useToast();
  const { running, start, stop } = useStream();

  const [meta, setMeta] = useState<ReplayMeta | null>(null);
  const [approaches, setApproaches] = useState<ApproachKey[]>([]);
  const [keyModal, setKeyModal] = useState(false);
  const [progress, setProgress] = useState<Record<string, ApproachProgress>>({});
  const [results, setResults] = useState<EvalResults | null>(null);
  const [metric, setMetric] = useState<"em" | "f1">("f1");

  useEffect(() => {
    api
      .replayMeta()
      .then((m) => {
        setMeta(m);
        setApproaches(m.paper_headline.map((h) => h.approach as ApproachKey));
      })
      .catch(() => toast("Could not load the bundled case study.", "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const paperByApproach = useMemo(
    () => new Map((meta?.paper_headline ?? []).map((h) => [h.approach, h])),
    [meta],
  );

  async function handleRun() {
    if (!present) return setKeyModal(true);
    if (!approaches.length) return;
    setResults(null);
    const n = meta?.eval_set.n_questions ?? 34;
    const init: Record<string, ApproachProgress> = {};
    approaches.forEach((a) => (init[a] = { approach: a, done: 0, total: n, cost: 0, status: "queued" }));
    setProgress(init);

    const patch = (a: string, fn: (p: ApproachProgress) => ApproachProgress) =>
      setProgress((prev) => ({ ...prev, [a]: fn(prev[a]) }));

    await start(
      "/replay/run",
      { approaches },
      (e: SSEvent) => {
        const ap = e.approach as string | undefined;
        switch (e.event) {
          case "index_building":
            if (ap) patch(ap, (p) => ({ ...p, status: "building" }));
            break;
          case "approach_eval_start":
          case "index_ready":
            if (ap) patch(ap, (p) => ({ ...p, status: "running" }));
            break;
          case "question_done":
            if (ap) patch(ap, (p) => ({ ...p, status: "running", done: e.i as number, cost: p.cost + (e.cost_usd as number) }));
            break;
          case "approach_eval_done":
            if (ap) patch(ap, (p) => ({ ...p, status: "done", done: p.total }));
            break;
          case "eval_done": {
            const res = e.results as EvalResults;
            setResults(res);
            saveEval({
              id: newId(),
              kind: "eval",
              createdAt: Date.now(),
              label: `Paper replay · ${res.totals.n_questions} Q`,
              source: "replay",
              approaches: res.approaches,
              results: res,
              totalCost: res.totals.cost_usd,
            });
            toast("Replay complete and saved to history.", "success");
            break;
          }
          case "fatal":
            toast((e.message as string) || "Replay failed.", "error");
            break;
        }
      },
    );
  }

  const progressItems = approaches.map((a) => progress[a]).filter(Boolean);

  return (
    <div className="shell space-y-6 py-10">
      <div>
        <p className="eyebrow">Replay</p>
        <h1 className="mt-2 font-display text-[44px] leading-none tracking-tightest">Reproduce the paper</h1>
        <p className="mt-3 max-w-[58ch] text-[15px] text-ink-muted">
          Run the framework’s bundled 8K-token corpus and 34-question evaluation with your own key, then
          compare your numbers to the published case study. Small deltas are expected and explained.
        </p>
      </div>

      {/* case study description */}
      <Card className="p-5 sm:p-6">
        <p className="eyebrow mb-4">The bundled case study</p>
        {!meta ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Stat label="Documents" value={`${meta.corpus.n_docs}`} sub={`≈ ${meta.corpus.total_words.toLocaleString()} words`} />
            <Stat label="Questions" value={`${meta.eval_set.n_questions}`} sub={Object.entries(meta.eval_set.by_probe_type).filter(([k]) => k !== "total").map(([k, v]) => `${v} ${PROBE_LABEL[k] ?? k}`).join(" · ")} />
            <Stat label="Generator" value={meta.model} sub="single model, all strategies" />
          </div>
        )}
      </Card>

      {/* approach selection + run */}
      <Card className="p-5 sm:p-6">
        <p className="eyebrow mb-4">Strategies to reproduce</p>
        <ApproachPicker selected={approaches} onChange={setApproaches} corpusTokens={meta?.corpus.total_words ?? null} />
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {running ? (
            <Button variant="danger" leftIcon={<Square className="h-4 w-4" />} onClick={stop}>Stop</Button>
          ) : present ? (
            <Button leftIcon={<Play className="h-4 w-4" />} onClick={handleRun} disabled={!approaches.length}>
              Run replay with your key
            </Button>
          ) : (
            <Button leftIcon={<KeyRound className="h-4 w-4" />} onClick={() => setKeyModal(true)}>
              Add your key to replay
            </Button>
          )}
          <span className="text-[12.5px] text-ink-faint">
            {approaches.length} strategies × {meta?.eval_set.n_questions ?? 34} questions
          </span>
        </div>
      </Card>

      {progressItems.length > 0 && (
        <Card className="p-5">
          <p className="eyebrow mb-4">{running ? "Reproducing…" : "Replay complete"}</p>
          <EvalProgress items={progressItems} />
        </Card>
      )}

      {/* reproduction vs paper */}
      {results && meta && (
        <Card className="p-5 sm:p-6">
          <p className="eyebrow mb-1">Your run vs the paper</p>
          <p className="mb-4 text-[12.5px] text-ink-faint">{meta.note}</p>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-line text-[11px] uppercase tracking-wide text-ink-faint">
                  <th className="px-3 py-2 text-left font-medium">Strategy</th>
                  <th className="px-3 py-2 text-right font-medium">Your F1</th>
                  <th className="px-3 py-2 text-right font-medium">Paper F1</th>
                  <th className="px-3 py-2 text-right font-medium">Δ</th>
                </tr>
              </thead>
              <tbody>
                {[...results.headline].sort((a, b) => b.f1 - a.f1).map((h) => {
                  const paper = paperByApproach.get(h.approach);
                  const delta = paper ? h.f1 - paper.f1 : 0;
                  return (
                    <tr key={h.approach} className="border-b border-line/60 last:border-0">
                      <td className="px-3 py-2.5">
                        <span className="flex items-center gap-2">
                          <Dot color={APPROACHES[h.approach].color} /> {APPROACHES[h.approach].label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono">{fmtPct(h.f1, 1)}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-ink-muted">{paper ? fmtPct(paper.f1, 1) : "—"}</td>
                      <td className="px-3 py-2.5 text-right font-mono">
                        {paper ? (
                          <span className={delta >= 0 ? "text-approach-rerank" : "text-approach-recursive"}>
                            {delta >= 0 ? "+" : ""}{(delta * 100).toFixed(1)}
                          </span>
                        ) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* full results */}
      {results && <EvalResultsView results={results} metric={metric} setMetric={setMetric} />}

      {!results && !running && progressItems.length === 0 && meta && (
        <div className="flex items-center gap-2 text-[13px] text-ink-faint">
          <BookOpenCheck className="h-4 w-4" /> Press run to reproduce the published results with your key.
        </div>
      )}

      <KeyModal open={keyModal} onClose={() => setKeyModal(false)} />
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-card border border-line bg-canvas/40 p-4">
      <p className="eyebrow">{label}</p>
      <p className="mt-1.5 font-display text-[26px] tracking-tightest">{value}</p>
      {sub && <p className="mt-0.5 text-[12px] text-ink-muted">{sub}</p>}
    </div>
  );
}
