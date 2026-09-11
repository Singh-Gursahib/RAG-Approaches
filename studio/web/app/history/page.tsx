"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Archive, Trash2, GitCompare, Gauge, Wand2, Download, Upload, FlaskConical, ClipboardCheck, Bookmark } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Segmented } from "@/components/ui/Controls";
import { Input } from "@/components/ui/Input";
import { Dot, Tag } from "@/components/ui/Tag";
import { useToast } from "@/components/ui/Toast";
import { APPROACHES } from "@/lib/approaches";
import { fmtUSD } from "@/lib/format";
import {
  listRuns, deleteRun, listEvals, deleteEval, listConfigs, deleteConfig,
  setPendingConfig, exportAll, importAll, ensureStarterConfigs,
  type StoredRun, type StoredEval, type SavedConfig,
} from "@/lib/store";

type Tab = "all" | "runs" | "evals" | "configs";

export default function HistoryPage() {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");
  const [runs, setRuns] = useState<StoredRun[]>([]);
  const [evals, setEvals] = useState<StoredEval[]>([]);
  const [configs, setConfigs] = useState<SavedConfig[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  function refresh() {
    setRuns(listRuns());
    setEvals(listEvals());
    setConfigs(listConfigs());
  }

  useEffect(() => {
    ensureStarterConfigs();
    refresh();
    const on = () => refresh();
    ["rag-atlas:runs-change", "rag-atlas:evals-change", "rag-atlas:configs-change"].forEach((e) =>
      window.addEventListener(e, on),
    );
    return () =>
      ["rag-atlas:runs-change", "rag-atlas:evals-change", "rag-atlas:configs-change"].forEach((e) =>
        window.removeEventListener(e, on),
      );
  }, []);

  const needle = q.trim().toLowerCase();
  const fRuns = useMemo(
    () => runs.filter((r) => !needle || r.question.toLowerCase().includes(needle) || r.corpusLabel.toLowerCase().includes(needle)),
    [runs, needle],
  );
  const fEvals = useMemo(
    () => evals.filter((e) => !needle || e.label.toLowerCase().includes(needle)),
    [evals, needle],
  );
  const fConfigs = useMemo(
    () => configs.filter((c) => !needle || c.name.toLowerCase().includes(needle)),
    [configs, needle],
  );

  const isEmpty = runs.length === 0 && evals.length === 0 && configs.length === 0;

  function applyConfig(c: SavedConfig) {
    setPendingConfig(c);
    toast(`Applying “${c.name}” in the Playground.`, "info");
    router.push("/playground");
  }

  function handleExport() {
    const blob = new Blob([exportAll()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "rag-atlas-history.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(file: File) {
    try {
      const counts = importAll(await file.text());
      refresh();
      toast(`Imported ${counts.runs} runs, ${counts.evals} evals, ${counts.configs} configs.`, "success");
    } catch {
      toast("Could not import that file.", "error");
    }
  }

  return (
    <div className="shell space-y-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">History</p>
          <h1 className="mt-2 font-display text-[44px] leading-none tracking-tightest">Everything you’ve run</h1>
          <p className="mt-3 max-w-[52ch] text-[15px] text-ink-muted">
            Your runs, evaluations, and saved configurations — stored only in this browser. Reopen,
            re-apply, or export them anytime.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" leftIcon={<Download className="h-4 w-4" />} onClick={handleExport} disabled={isEmpty}>
            Export
          </Button>
          <Button size="sm" variant="ghost" leftIcon={<Upload className="h-4 w-4" />} onClick={() => fileRef.current?.click()}>
            Import
          </Button>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => e.target.files?.[0] && handleImport(e.target.files[0])} />
        </div>
      </div>

      {isEmpty ? (
        <EmptyState
          icon={<Archive className="h-5 w-5" />}
          title="Nothing here yet"
          body="Run a question in the Playground or grade strategies in Evaluate — they’ll appear here for you to revisit, compare, and re-apply."
          action={
            <Link href="/playground">
              <Button size="sm" leftIcon={<Wand2 className="h-4 w-4" />}>Open the playground</Button>
            </Link>
          }
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Segmented
              value={tab}
              onChange={setTab}
              options={[
                { value: "all", label: "All" },
                { value: "runs", label: `Runs (${runs.length})` },
                { value: "evals", label: `Evals (${evals.length})` },
                { value: "configs", label: `Configs (${configs.length})` },
              ]}
            />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="max-w-[240px]" />
          </div>

          {(tab === "all" || tab === "runs") && fRuns.length > 0 && (
            <Section title="Playground runs">
              {fRuns.map((r) => (
                <RunRow key={r.id} run={r} onDelete={() => deleteRun(r.id)} />
              ))}
            </Section>
          )}

          {(tab === "all" || tab === "evals") && fEvals.length > 0 && (
            <Section title="Evaluations">
              {fEvals.map((e) => (
                <EvalRow key={e.id} ev={e} onDelete={() => deleteEval(e.id)} onProfile={() => router.push(`/profiler?eval=${e.id}`)} />
              ))}
            </Section>
          )}

          {(tab === "all" || tab === "configs") && fConfigs.length > 0 && (
            <Section title="Saved configurations">
              {fConfigs.map((c) => (
                <ConfigRow key={c.id} cfg={c} onApply={() => applyConfig(c)} onDelete={() => deleteConfig(c.id)} />
              ))}
            </Section>
          )}
        </>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="eyebrow mb-3">{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function ApproachDots({ approaches }: { approaches: (keyof typeof APPROACHES)[] }) {
  return (
    <span className="flex items-center gap-1">
      {approaches.map((a) => (
        <span key={a} title={APPROACHES[a].label}>
          <Dot color={APPROACHES[a].color} />
        </span>
      ))}
    </span>
  );
}

function RunRow({ run, onDelete }: { run: StoredRun; onDelete: () => void }) {
  return (
    <Card className="flex items-center gap-3 p-3.5">
      <FlaskConical className="h-4 w-4 shrink-0 text-ink-faint" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-medium text-ink">{run.question}</p>
        <p className="mt-0.5 flex items-center gap-2 text-[12px] text-ink-faint">
          {run.corpusLabel} · {new Date(run.createdAt).toLocaleString()} · {fmtUSD(run.totalCost)}
        </p>
      </div>
      <ApproachDots approaches={run.approaches} />
      <Link href={`/compare?run=${run.id}`}>
        <Button size="sm" variant="ghost" leftIcon={<GitCompare className="h-4 w-4" />}>Compare</Button>
      </Link>
      <DeleteBtn onClick={onDelete} />
    </Card>
  );
}

function EvalRow({ ev, onDelete, onProfile }: { ev: StoredEval; onDelete: () => void; onProfile: () => void }) {
  return (
    <Card className="flex items-center gap-3 p-3.5">
      <ClipboardCheck className="h-4 w-4 shrink-0 text-ink-faint" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-medium text-ink">{ev.label}</p>
        <p className="mt-0.5 text-[12px] text-ink-faint">
          {new Date(ev.createdAt).toLocaleString()} · {ev.results.totals.n_questions} Q · {fmtUSD(ev.totalCost)}
        </p>
      </div>
      {ev.modelLabel && <Tag tone="neutral">{ev.modelLabel}</Tag>}
      {ev.source === "replay" && <Tag tone="accent">replay</Tag>}
      <ApproachDots approaches={ev.approaches} />
      <Button size="sm" variant="ghost" leftIcon={<Gauge className="h-4 w-4" />} onClick={onProfile}>Profile</Button>
      <DeleteBtn onClick={onDelete} />
    </Card>
  );
}

function ConfigRow({ cfg, onApply, onDelete }: { cfg: SavedConfig; onApply: () => void; onDelete: () => void }) {
  return (
    <Card className="flex items-center gap-3 p-3.5">
      <Bookmark className="h-4 w-4 shrink-0 text-ink-faint" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-medium text-ink">
          {cfg.name} {cfg.builtin && <Tag tone="neutral">starter</Tag>}
        </p>
        <p className="mt-0.5 text-[12px] text-ink-faint">
          {cfg.approaches.length} strategies · top-k {cfg.retrieval.top_k} · chunk {cfg.chunking.target_tokens}
        </p>
      </div>
      <ApproachDots approaches={cfg.approaches} />
      <Button size="sm" variant="ghost" leftIcon={<Wand2 className="h-4 w-4" />} onClick={onApply}>Apply</Button>
      <DeleteBtn onClick={onDelete} />
    </Card>
  );
}

function DeleteBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label="Delete" className="grid h-8 w-8 place-items-center rounded-full text-ink-faint hover:bg-approach-recursive/10 hover:text-approach-recursive">
      <Trash2 className="h-4 w-4" />
    </button>
  );
}
