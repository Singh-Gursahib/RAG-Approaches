"use client";

import { useEffect, useState } from "react";
import { ChevronRight, FolderOpen, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tag } from "@/components/ui/Tag";
import { api } from "@/lib/api";
import { APPROACHES } from "@/lib/approaches";
import { fmtPct, fmtUSD } from "@/lib/format";
import type { SavedResult, SavedResultSummary } from "@/lib/types";

/** Opens the list of saved tests and hands the chosen one back, unchanged. */
export function LoadPreviousButton({
  onLoad,
  source,
  disabled = false,
}: {
  onLoad: (result: SavedResult) => void;
  source?: "replay" | "custom";
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" leftIcon={<FolderOpen className="h-4 w-4" />} onClick={() => setOpen(true)} disabled={disabled}>
        Load the results from a previous test
      </Button>
      <SavedResultsModal
        open={open}
        source={source}
        onClose={() => setOpen(false)}
        onLoad={(r) => {
          setOpen(false);
          onLoad(r);
        }}
      />
    </>
  );
}

export function SavedResultsModal({
  open,
  onClose,
  onLoad,
  source,
}: {
  open: boolean;
  onClose: () => void;
  onLoad: (result: SavedResult) => void;
  source?: "replay" | "custom";
}) {
  const [items, setItems] = useState<SavedResultSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setItems(null);
    setError(null);
    api
      .results()
      .then((r) => setItems(r.results))
      .catch((e) => setError((e as Error).message));
  }, [open]);

  const shown = (items ?? []).filter((i) => !source || i.source === source);

  async function pick(id: string) {
    setLoadingId(id);
    setError(null);
    try {
      onLoad(await api.result(id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Previous tests" maxWidth={660}>
      <p className="mb-4 text-[13px] leading-relaxed text-ink-muted">
        Every finished test is saved on this machine as a JSON file in{" "}
        <span className="font-mono text-ink">studio/results/</span>. Loading one shows its results exactly
        as they were produced. Nothing is re-run and nothing is spent.
      </p>

      {error && (
        <p className="mb-3 rounded-[10px] bg-approach-recursive/10 px-3 py-2 text-[12.5px] text-approach-recursive">{error}</p>
      )}

      {!items && !error && (
        <div className="space-y-2">
          <Skeleton className="h-[74px] w-full" />
          <Skeleton className="h-[74px] w-full" />
        </div>
      )}

      {items && shown.length === 0 && (
        <p className="py-6 text-center text-[13px] text-ink-faint">No saved tests yet. Finished runs appear here automatically.</p>
      )}

      <ul className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
        {shown.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => pick(item.id)}
              disabled={!!loadingId}
              className="w-full rounded-[14px] border border-line bg-surface px-4 py-3 text-left transition-colors hover:border-ink/20 hover:bg-ink/[0.02] disabled:opacity-70"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-medium text-ink">{item.label}</p>
                  <p className="mt-0.5 truncate font-mono text-[11.5px] text-ink-faint">
                    {item.model?.id}
                    {item.created_at ? ` · ${new Date(item.created_at).toLocaleString()}` : ""}
                  </p>
                </div>
                {loadingId === item.id ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-ink-faint" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" />
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Tag tone={item.source === "replay" ? "accent" : "neutral"}>
                  {item.source === "replay" ? "paper case study" : "custom evaluation"}
                </Tag>
                {item.model?.open_weights && <Tag tone="success">open weights</Tag>}
                {item.repeats != null && <Tag>{item.repeats} {item.repeats === 1 ? "run" : "runs"}</Tag>}
                {item.temperature != null && <Tag>T = {item.temperature}</Tag>}
                {item.reasoning_effort_sent && <Tag>{item.reasoning_effort_sent} reasoning</Tag>}
                {item.n_questions != null && <Tag>{item.n_questions} questions</Tag>}
                {item.total_cost_usd != null && <Tag>{fmtUSD(item.total_cost_usd)}</Tag>}
                {item.best && (
                  <Tag tone="success">
                    best F1 {fmtPct(item.best.f1, 1)} · {APPROACHES[item.best.approach]?.label ?? item.best.approach}
                  </Tag>
                )}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
