"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Square, KeyRound, BookOpenCheck, RotateCcw } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Tag, Dot } from "@/components/ui/Tag";
import { Skeleton } from "@/components/ui/Skeleton";
import { HelpPopover } from "@/components/ui/Tooltip";
import { useToast } from "@/components/ui/Toast";
import { KeyModal } from "@/components/shell/KeyModal";
import { ApproachPicker } from "@/components/run/ApproachPicker";
import { ModelPicker, RunsControl, modelLabel, useModelCatalog } from "@/components/run/ModelPicker";
import { EvalProgress, type ApproachProgress } from "@/components/eval/EvalProgress";
import { EvalResultsView } from "@/components/eval/EvalResultsView";
import { LoadPreviousButton } from "@/components/eval/SavedResultsModal";
import { ResultMetaCard } from "@/components/eval/ResultMetaCard";
import { api } from "@/lib/api";
import { useStream } from "@/lib/sse";
import { useKey } from "@/lib/useKey";
import { useLLMConfig } from "@/lib/model";
import { APPROACHES, PROBE_LABEL } from "@/lib/approaches";
import { fmtInt, fmtPct, fmtUSD } from "@/lib/format";
import { saveEval, newId } from "@/lib/store";
import type {
  ApproachKey,
  EstimateResponse,
  EvalResults,
  HeadlineRow,
  PaperHeadlineRow,
  ReplayMeta,
  SavedResult,
  SSEvent,
} from "@/lib/types";

const PAPER_SETTINGS = { temperature: 0.3, repeats: 3, max_output_tokens: 512 };

/** Mean absolute F1 gap and Spearman rank correlation between two strategy orderings. */
function similarity(pairs: { ours: number; paper: number }[]) {
  const n = pairs.length;
  if (n < 2) return null;
  const meanAbs = pairs.reduce((s, p) => s + Math.abs(p.ours - p.paper), 0) / n;
  const rank = (vals: number[]) => {
    const order = vals.map((v, i) => [v, i] as const).sort((a, b) => b[0] - a[0]);
    const ranks = new Array<number>(n);
    let i = 0;
    while (i < n) {
      let j = i;
      while (j + 1 < n && order[j + 1][0] === order[i][0]) j++;
      for (let k = i; k <= j; k++) ranks[order[k][1]] = (i + j) / 2 + 1;
      i = j + 1;
    }
    return ranks;
  };
  const ra = rank(pairs.map((p) => p.ours));
  const rb = rank(pairs.map((p) => p.paper));
  const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
  const ma = mean(ra);
  const mb = mean(rb);
  let num = 0;
  let da = 0;
  let db = 0;
  for (let k = 0; k < n; k++) {
    num += (ra[k] - ma) * (rb[k] - mb);
    da += (ra[k] - ma) ** 2;
    db += (rb[k] - mb) ** 2;
  }
  return { meanAbs, rho: da && db ? num / Math.sqrt(da * db) : 1 };
}

export default function ReplayPage() {
  const { present } = useKey();
  const toast = useToast();
  const { running, start, stop } = useStream();
  const catalog = useModelCatalog();

  const [meta, setMeta] = useState<ReplayMeta | null>(null);
  const [approaches, setApproaches] = useState<ApproachKey[]>([]);
  const [llm, setLLM] = useLLMConfig({
    temperature: PAPER_SETTINGS.temperature,
    max_output_tokens: PAPER_SETTINGS.max_output_tokens,
  });
  const [repeats, setRepeats] = useState(PAPER_SETTINGS.repeats);
  const [keyModal, setKeyModal] = useState(false);
  const [estimate, setEstimate] = useState<EstimateResponse | null>(null);
  const [progress, setProgress] = useState<Record<string, ApproachProgress>>({});
  const [results, setResults] = useState<EvalResults | null>(null);
  const [saved, setSaved] = useState<SavedResult | null>(null);
  const [resultModel, setResultModel] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [metric, setMetric] = useState<"em" | "f1">("f1");
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .replayMeta()
      .then((m) => {
        setMeta(m);
        setApproaches(m.paper_headline.map((h) => h.approach));
      })
      .catch(() => toast("Could not load the bundled case study.", "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!meta || !approaches.length) {
      setEstimate(null);
      return;
    }
    const t = setTimeout(() => {
      api
        .estimate({
          n_questions: meta.eval_set.n_questions,
          approaches,
          corpus_tokens: Math.round(meta.corpus.total_words * 1.3),
          n_docs: meta.corpus.n_docs,
          llm,
          repeats,
        })
        .then(setEstimate)
        .catch(() => setEstimate(null));
    }, 300);
    return () => clearTimeout(t);
  }, [meta, approaches, llm, repeats]);

  const paperByApproach = useMemo(
    () => new Map((meta?.paper_headline ?? []).map((h) => [h.approach, h])),
    [meta],
  );

  const matchesPaper =
    llm.temperature === PAPER_SETTINGS.temperature &&
    repeats === PAPER_SETTINGS.repeats &&
    llm.max_output_tokens === PAPER_SETTINGS.max_output_tokens;

  function usePaperSettings() {
    setLLM({ ...llm, temperature: PAPER_SETTINGS.temperature, max_output_tokens: PAPER_SETTINGS.max_output_tokens });
    setRepeats(PAPER_SETTINGS.repeats);
  }

  function showResults(res: EvalResults, from: SavedResult | null, isLoaded: boolean) {
    setResults(res);
    setSaved(from);
    setLoaded(isLoaded);
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  }

  function handleLoad(r: SavedResult) {
    setProgress({});
    setResultModel(r.model.id);
    showResults(r.results, r, true);
    toast(`Loaded “${r.label}”.`, "success");
  }

  async function handleRun() {
    if (!present) return setKeyModal(true);
    if (!approaches.length || !meta) return;
    setResults(null);
    setSaved(null);
    setLoaded(false);
    const runLLM = llm;
    const runRepeats = repeats;
    const label = modelLabel(catalog, runLLM.model);
    setResultModel(runLLM.model);

    const n = meta.eval_set.n_questions;
    const init: Record<string, ApproachProgress> = {};
    approaches.forEach(
      (a) => (init[a] = { approach: a, done: 0, total: n * runRepeats, cost: 0, status: "queued", run: 1, runs: runRepeats }),
    );
    setProgress(init);

    const patch = (a: string, fn: (p: ApproachProgress) => ApproachProgress) =>
      setProgress((prev) => (prev[a] ? { ...prev, [a]: fn(prev[a]) } : prev));

    await start("/replay/run", { approaches, llm: runLLM, repeats: runRepeats }, (e: SSEvent) => {
      const ap = e.approach as string | undefined;
      switch (e.event) {
        case "index_building":
          if (ap) patch(ap, (p) => ({ ...p, status: "building" }));
          break;
        case "approach_eval_start":
        case "index_ready":
          if (ap) patch(ap, (p) => ({ ...p, status: p.status === "done" ? "done" : "running" }));
          break;
        case "question_done":
          if (ap) {
            const rep = (e.repeat as number) ?? 0;
            patch(ap, (p) => ({
              ...p,
              status: "running",
              run: rep + 1,
              done: rep * n + (e.i as number),
              cost: p.cost + (e.cost_usd as number),
            }));
          }
          break;
        case "approach_eval_done":
          if (ap) patch(ap, (p) => ({ ...p, status: "done", done: p.total }));
          break;
        case "approach_eval_error":
          if (ap) patch(ap, (p) => ({ ...p, status: "error" }));
          toast(`${APPROACHES[ap as ApproachKey]?.label ?? ap}: ${e.message as string}`, "error");
          break;
        case "save_error":
          toast(`The results could not be saved to disk: ${e.message as string}`, "error");
          break;
        case "eval_done": {
          const res = e.results as EvalResults;
          const savedId = (e.saved_result_id as string | null) ?? null;
          showResults(res, null, false);
          saveEval({
            id: newId(),
            kind: "eval",
            createdAt: Date.now(),
            label: `Paper replay · ${label} · ${runRepeats} ${runRepeats === 1 ? "run" : "runs"}`,
            source: "replay",
            approaches: res.approaches,
            results: res,
            totalCost: res.totals.cost_usd,
            model: runLLM.model,
            modelLabel: label,
            savedResultId: savedId ?? undefined,
          });
          if (savedId) api.result(savedId).then(setSaved).catch(() => {});
          toast(savedId ? "Replay complete. Results saved and added to history." : "Replay complete and added to history.", "success");
          break;
        }
        case "fatal":
          toast((e.message as string) || "Replay failed.", "error");
          break;
      }
    });
  }

  const progressItems = approaches.map((a) => progress[a]).filter(Boolean);
  const spent = progressItems.reduce((acc, p) => acc + p.cost, 0);
  const shownModel = saved?.model.label ?? modelLabel(catalog, resultModel ?? llm.model);
  const isPaperItself = !!saved && !!meta?.paper_result_id && saved.id === meta.paper_result_id;

  const comparison = useMemo(() => {
    if (!results || !meta) return null;
    const rows = [...results.headline]
      .sort((a, b) => b.f1 - a.f1)
      .map((h) => ({ h, paper: paperByApproach.get(h.approach) }));
    const both = rows.filter((r): r is { h: HeadlineRow; paper: PaperHeadlineRow } => !!r.paper);
    const paperBest = [...meta.paper_headline].sort((a, b) => b.f1 - a.f1)[0]?.approach;
    return {
      rows,
      both,
      sim: similarity(both.map((r) => ({ ours: r.h.f1, paper: r.paper.f1 }))),
      insideCI: both.filter((r) => r.h.f1 >= r.paper.f1_lo && r.h.f1 <= r.paper.f1_hi).length,
      best: rows[0]?.h.approach,
      paperBest,
    };
  }, [results, meta, paperByApproach]);

  return (
    <div className="shell space-y-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Replay</p>
          <h1 className="mt-2 font-display text-[44px] leading-none tracking-tightest">Reproduce the paper</h1>
          <p className="mt-3 max-w-[60ch] text-[15px] text-ink-muted">
            Run the framework&apos;s bundled 8K-token corpus and 34-question evaluation on any OpenRouter model,
            then compare the numbers to the published case study, which used Gemini 3 Flash.
          </p>
        </div>
        <LoadPreviousButton source="replay" onLoad={handleLoad} disabled={running} />
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
            <Stat
              label="Questions"
              value={`${meta.eval_set.n_questions}`}
              sub={Object.entries(meta.eval_set.by_probe_type)
                .filter(([k]) => k !== "total")
                .map(([k, v]) => `${v} ${PROBE_LABEL[k] ?? k}`)
                .join(" · ")}
            />
            <Stat
              label="Paper's generator"
              value={modelLabel(catalog, meta.paper_model)}
              sub={`T = ${meta.paper_settings.temperature} · ${meta.paper_settings.repeats} runs · ${meta.paper_settings.answer_token_budget}-token answers`}
            />
          </div>
        )}
      </Card>

      {/* model + sampling */}
      <Card className="p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <p className="eyebrow">Model &amp; settings</p>
          {matchesPaper ? (
            <Tag tone="success">matches the paper&apos;s settings</Tag>
          ) : (
            <Button size="sm" variant="quiet" leftIcon={<RotateCcw className="h-4 w-4" />} onClick={usePaperSettings}>
              Use the paper&apos;s settings
            </Button>
          )}
        </div>
        <ModelPicker llm={llm} onChange={setLLM} showTemperature disabled={running} />
        <div className="mt-5">
          <RunsControl value={repeats} onChange={setRepeats} note="The paper averaged 3 runs." disabled={running} />
        </div>
      </Card>

      {/* approach selection + run */}
      <Card className="p-5 sm:p-6">
        <p className="eyebrow mb-4">Strategies to reproduce</p>
        <ApproachPicker selected={approaches} onChange={setApproaches} corpusTokens={meta?.corpus.total_words ?? null} />
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {running ? (
            <Button variant="danger" leftIcon={<Square className="h-4 w-4" />} onClick={stop}>Stop</Button>
          ) : present ? (
            <Button leftIcon={<Play className="h-4 w-4" />} onClick={handleRun} disabled={!approaches.length || !meta}>
              Run replay on {modelLabel(catalog, llm.model)}
            </Button>
          ) : (
            <Button leftIcon={<KeyRound className="h-4 w-4" />} onClick={() => setKeyModal(true)}>
              Add your key to replay
            </Button>
          )}
          <span className="text-[12.5px] text-ink-faint">
            {approaches.length} strategies × {meta?.eval_set.n_questions ?? 34} questions × {repeats} {repeats === 1 ? "run" : "runs"}
          </span>
          {estimate && !running && (
            <span className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-muted">
              <Tag tone="neutral">≈ {fmtUSD(estimate.total_cost_usd)} · {fmtInt(estimate.total_llm_calls)} model calls</Tag>
              <HelpPopover>{estimate.note}</HelpPopover>
            </span>
          )}
        </div>
      </Card>

      {progressItems.length > 0 && (
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <p className="eyebrow">{running ? `Reproducing on ${shownModel}…` : "Replay complete"}</p>
            <span className="tnum font-mono text-[12.5px] text-ink-muted">{fmtUSD(spent)} spent</span>
          </div>
          <EvalProgress items={progressItems} />
        </Card>
      )}

      <div ref={resultsRef} className="scroll-mt-24 space-y-6">
        {saved && <ResultMetaCard result={saved} loaded={loaded} />}

        {/* reproduction vs paper */}
        {results && meta && comparison && (
          <Card className="p-5 sm:p-6">
            <p className="eyebrow mb-1">{shownModel} vs the paper (Gemini 3 Flash)</p>
            <p className="mb-4 text-[12.5px] text-ink-faint">
              {isPaperItself ? "This saved test is the published sweep itself, so every difference is zero." : meta.note}
            </p>
            {!isPaperItself && comparison.sim && (
              <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <MiniStat label="Mean F1 gap" value={`${(comparison.sim.meanAbs * 100).toFixed(1)} pts`} sub="average |Δ| per strategy" />
                <MiniStat label="Rank agreement" value={`ρ = ${comparison.sim.rho.toFixed(2)}`} sub="Spearman, strategies by F1" />
                <MiniStat label="Inside paper's 95% CI" value={`${comparison.insideCI} of ${comparison.both.length}`} sub="strategies" />
                <MiniStat
                  label="Top strategy"
                  value={comparison.best ? APPROACHES[comparison.best].label : "—"}
                  sub={comparison.paperBest ? `paper: ${APPROACHES[comparison.paperBest].label}` : undefined}
                />
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-line text-[11px] uppercase tracking-wide text-ink-faint">
                    <th className="px-3 py-2 text-left font-medium">Strategy</th>
                    <th className="px-3 py-2 text-right font-medium">{shownModel} F1</th>
                    <th className="px-3 py-2 text-right font-medium">Paper F1</th>
                    <th className="px-3 py-2 text-right font-medium">Δ F1</th>
                    <th className="px-3 py-2 text-right font-medium">Cost / run</th>
                    <th className="px-3 py-2 text-right font-medium">Paper cost / run</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.rows.map(({ h, paper }) => {
                    const delta = paper ? h.f1 - paper.f1 : 0;
                    return (
                      <tr key={h.approach} className="border-b border-line/60 last:border-0">
                        <td className="px-3 py-2.5">
                          <span className="flex items-center gap-2">
                            <Dot color={APPROACHES[h.approach].color} /> {APPROACHES[h.approach].label}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono">
                          {fmtPct(h.f1, 1)}
                          {(h.n_seeds ?? 1) > 1 && h.f1_seed_std != null && (
                            <span className="ml-1 text-[10.5px] text-ink-faint">±{(h.f1_seed_std * 100).toFixed(1)}</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono text-ink-muted">
                          {paper ? (
                            <>
                              {fmtPct(paper.f1, 1)}
                              <span className="ml-1 text-[10.5px] text-ink-faint">±{(paper.f1_std * 100).toFixed(1)}</span>
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono">
                          {paper ? (
                            <span className={delta >= 0 ? "text-approach-rerank" : "text-approach-recursive"}>
                              {delta >= 0 ? "+" : ""}
                              {(delta * 100).toFixed(1)}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono">{fmtUSD(h.cost_usd)}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-ink-muted">{paper ? fmtUSD(paper.cost_usd) : "—"}</td>
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
      </div>

      {!results && !running && progressItems.length === 0 && meta && (
        <div className="flex items-center gap-2 text-[13px] text-ink-faint">
          <BookOpenCheck className="h-4 w-4" /> Pick a model and press run, or load the results from a previous test.
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

function MiniStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-[12px] border border-line bg-canvas/40 px-3.5 py-3">
      <p className="text-[11px] uppercase tracking-wide text-ink-faint">{label}</p>
      <p className="mt-0.5 font-display text-[20px] tracking-tight">{value}</p>
      {sub && <p className="text-[11.5px] text-ink-muted">{sub}</p>}
    </div>
  );
}
