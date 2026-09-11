"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Check, ChevronDown, PenLine } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Tag } from "@/components/ui/Tag";
import { Segmented, Slider } from "@/components/ui/Controls";
import { HelpPopover } from "@/components/ui/Tooltip";
import { api } from "@/lib/api";
import { fmtTokens } from "@/lib/format";
import { MODEL_SLUG, REASONING_OPTIONS } from "@/lib/model";
import type { LLMConfig, ModelInfo, ModelsResponse, ReasoningMode } from "@/lib/types";

let catalogRequest: Promise<ModelsResponse> | null = null;

export function loadModelCatalog(): Promise<ModelsResponse> {
  if (!catalogRequest) {
    catalogRequest = api.models().catch((e) => {
      catalogRequest = null;
      throw e;
    });
  }
  return catalogRequest;
}

/** The curated OpenRouter models (fetched once per page load). */
export function useModelCatalog() {
  const [catalog, setCatalog] = useState<ModelsResponse | null>(null);
  useEffect(() => {
    let alive = true;
    loadModelCatalog()
      .then((c) => alive && setCatalog(c))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return catalog;
}

export function modelLabel(catalog: ModelsResponse | null, id: string): string {
  return catalog?.models.find((m) => m.id === id)?.label ?? id;
}

function trimNum(v: number) {
  return v.toFixed(3).replace(/\.?0+$/, "");
}

export function priceLabel(m: Pick<ModelInfo, "input_per_m" | "output_per_m">) {
  if (m.input_per_m == null || m.output_per_m == null) return "price unknown";
  return `$${trimNum(m.input_per_m)} in · $${trimNum(m.output_per_m)} out per 1M tokens`;
}

function reasoningNote(mode: ReasoningMode, info: ModelInfo | null): string {
  if (!info || info.source === "unknown") return "";
  const r = info.reasoning;
  if (!r) return "This model has no reasoning controls, so no reasoning setting is sent.";
  const efforts = r.supported_efforts ?? [];
  const lowest = efforts[efforts.length - 1] ?? "low";
  if (mode === "default") return `Model default: ${r.default_effort ?? "provider default"} effort.`;
  if (mode === "lowest" || mode === "none") {
    return r.mandatory
      ? `This model always reasons, so the lowest setting sends "${lowest}" effort.`
      : "Reasoning is turned off for this model.";
  }
  return `Sends "${mode}" effort. The token limit is raised so the answer keeps its full budget.`;
}

/** OpenRouter model dropdown with a custom-slug option and reasoning control. */
export function ModelPicker({
  llm,
  onChange,
  showTemperature = false,
  disabled = false,
}: {
  llm: LLMConfig;
  onChange: (next: LLMConfig) => void;
  showTemperature?: boolean;
  disabled?: boolean;
}) {
  const catalog = useModelCatalog();
  const [open, setOpen] = useState(false);
  const [customMode, setCustomMode] = useState(false);
  const [draft, setDraft] = useState("");
  const [lookup, setLookup] = useState<ModelInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const curated = catalog?.models.find((m) => m.id === llm.model) ?? null;
  const custom = customMode || (!!catalog && !curated);
  const reasoning = llm.reasoning ?? "lowest";

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // A custom model remembered from a previous visit: show its slug and metadata.
  useEffect(() => {
    if (!catalog || curated) return;
    setDraft((d) => d || llm.model);
    if (lookup?.id === llm.model) return;
    api.modelLookup(llm.model).then(setLookup).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog, llm.model]);

  function choose(id: string) {
    setCustomMode(false);
    setLookupError(null);
    setOpen(false);
    onChange({ ...llm, model: id });
  }

  function chooseCustom() {
    setCustomMode(true);
    setOpen(false);
  }

  async function applyCustom() {
    const slug = draft.trim();
    if (!MODEL_SLUG.test(slug)) {
      setLookupError("Use an OpenRouter model id in the form provider/model-name.");
      return;
    }
    setChecking(true);
    setLookupError(null);
    try {
      const info = await api.modelLookup(slug);
      setLookup(info);
      if (info.found === false) {
        setLookupError(`OpenRouter's model list has no model called ${slug}.`);
        return;
      }
      onChange({ ...llm, model: slug });
    } catch {
      onChange({ ...llm, model: slug });
    } finally {
      setChecking(false);
    }
  }

  const info: ModelInfo | null = curated ?? (lookup && lookup.id === llm.model ? lookup : null);
  const title = curated?.label ?? (catalog ? info?.name ?? "Custom model" : llm.model);
  const note = reasoningNote(reasoning, info);

  return (
    <div className="space-y-3">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_210px]">
        <div ref={wrapRef} className="relative">
          <span className="mb-1.5 block text-[13px] font-medium text-ink">Model</span>
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-label="Choose a model"
            disabled={disabled}
            onClick={() => setOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-3 rounded-[12px] border border-line bg-surface px-3.5 py-2.5 text-left transition-colors hover:border-ink/20 disabled:opacity-60"
          >
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 truncate text-[14px] font-medium text-ink">
                {title}
                {curated?.paper_model && <Tag tone="accent">paper</Tag>}
                {(curated?.open_weights || (!curated && info?.hugging_face_id)) && <Tag tone="success">open weights</Tag>}
              </span>
              <span className="block truncate font-mono text-[11.5px] text-ink-faint">{llm.model}</span>
            </span>
            <ChevronDown className={clsx("h-4 w-4 shrink-0 text-ink-faint transition-transform", open && "rotate-180")} />
          </button>

          {open && (
            <ul
              role="listbox"
              aria-label="Models"
              className="absolute z-30 mt-1.5 w-full overflow-hidden rounded-[14px] border border-line bg-surface p-1 shadow-lift"
            >
              {(catalog?.models ?? []).map((m) => {
                const selected = m.id === llm.model && !customMode;
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => choose(m.id)}
                      className={clsx(
                        "flex w-full items-start gap-2.5 rounded-[10px] px-3 py-2 text-left hover:bg-ink/[0.04]",
                        selected && "bg-ink/[0.03]",
                      )}
                    >
                      <span className="mt-0.5 w-4 shrink-0">{selected && <Check className="h-4 w-4 text-accent" />}</span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5 text-[13.5px] font-medium text-ink">
                          {m.label}
                          <span className="text-[11.5px] font-normal text-ink-faint">{m.lab}</span>
                          {m.paper_model && <Tag tone="accent">paper</Tag>}
                          {m.open_weights && <Tag tone="success">open weights</Tag>}
                        </span>
                        <span className="block truncate font-mono text-[11px] text-ink-faint">
                          {m.id} · {priceLabel(m)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
              {!catalog && <li className="px-3 py-2 text-[12.5px] text-ink-faint">Loading models…</li>}
              <li className="mt-1 border-t border-line pt-1">
                <button
                  type="button"
                  role="option"
                  aria-selected={custom}
                  onClick={chooseCustom}
                  className="flex w-full items-start gap-2.5 rounded-[10px] px-3 py-2 text-left hover:bg-ink/[0.04]"
                >
                  <span className="mt-0.5 w-4 shrink-0">
                    <PenLine className="h-4 w-4 text-ink-faint" />
                  </span>
                  <span>
                    <span className="block text-[13.5px] font-medium text-ink">Custom model slug…</span>
                    <span className="block text-[11.5px] text-ink-faint">Any model id listed on openrouter.ai/models</span>
                  </span>
                </button>
              </li>
            </ul>
          )}
        </div>

        <label className="block">
          <span className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium text-ink">
            Reasoning
            <HelpPopover>
              {REASONING_OPTIONS.find((o) => o.value === reasoning)?.hint ??
                "How much the model may think before answering."}
            </HelpPopover>
          </span>
          <select
            value={reasoning}
            disabled={disabled}
            onChange={(e) => onChange({ ...llm, reasoning: e.target.value as ReasoningMode })}
            className="h-[54px] w-full rounded-[12px] border border-line bg-surface px-3 text-[13.5px] text-ink disabled:opacity-60"
          >
            {REASONING_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {custom && (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyCustom()}
            placeholder="provider/model-name"
            aria-label="Custom OpenRouter model slug"
            className="max-w-[360px] font-mono"
            disabled={disabled}
          />
          <Button size="sm" variant="ghost" onClick={applyCustom} loading={checking} disabled={disabled || !draft.trim()}>
            Use this model
          </Button>
          {lookupError && <span className="text-[12px] text-approach-recursive">{lookupError}</span>}
        </div>
      )}

      {info && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-muted">
          <span className="font-mono">{priceLabel(info)}</span>
          {info.context_length ? (
            <span>
              {info.context_length >= 1_000_000
                ? `${(info.context_length / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
                : fmtTokens(info.context_length)}{" "}
              token context
            </span>
          ) : null}
          {curated?.note && <span>{curated.note}</span>}
          {info.source === "unknown" && (
            <span className="text-approach-hyde">Couldn't check this id against OpenRouter right now.</span>
          )}
        </div>
      )}
      {note && <p className="text-[12px] text-ink-faint">{note}</p>}

      {showTemperature && (
        <div className="max-w-[420px] pt-1">
          <Slider
            label="temperature"
            value={llm.temperature}
            min={0}
            max={1}
            step={0.1}
            disabled={disabled}
            onChange={(v) => onChange({ ...llm, temperature: v })}
            hint={<HelpPopover>0 = deterministic. The paper used 0.3.</HelpPopover>}
          />
        </div>
      )}
    </div>
  );
}

/** How many times to repeat an evaluation (each run uses a different seed). */
export function RunsControl({
  value,
  onChange,
  note,
  disabled = false,
}: {
  value: number;
  onChange: (n: number) => void;
  note?: string;
  disabled?: boolean;
}) {
  return (
    <div className={clsx("flex flex-wrap items-center gap-3", disabled && "pointer-events-none opacity-60")}>
      <span className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
        Runs
        <HelpPopover>
          Repeat the whole evaluation with a different seed each time. Scores become the mean across
          runs with a run-to-run spread, like the paper&apos;s 3-run sweep.
        </HelpPopover>
      </span>
      <Segmented
        options={["1", "2", "3", "4", "5"].map((v) => ({ value: v, label: v }))}
        value={String(value)}
        onChange={(v) => onChange(Number(v))}
      />
      {note && <span className="text-[12px] text-ink-faint">{note}</span>}
    </div>
  );
}
