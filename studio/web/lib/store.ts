// Browser-local experiment history + saved configs.
//
// Phase 5 uses this to hand a finished run to the Compare page. Phase 9 expands
// it (filters, saved configs, import/export). localStorage for now; small payloads.

import type { ApproachKey, ChunkConfig, EvalResults, RetrievalConfig, RetrievedChunk } from "./types";

const RUNS_KEY = "rag-atlas:runs";
const EVALS_KEY = "rag-atlas:evals";
const CONFIGS_KEY = "rag-atlas:configs";
const PENDING_KEY = "rag-atlas:pending-config";
const STARTERS_FLAG = "rag-atlas:starters-seeded";
const MAX_RUNS = 40;
const MAX_EVALS = 25;

export interface StoredApproachResult {
  approach: ApproachKey;
  answer: string;
  refused: boolean;
  cost_usd: number;
  latency_ms: number;
  wall_ms: number;
  tokens_in: number;
  tokens_out: number;
  n_steps: number;
  retrieved: RetrievedChunk[];
  steps: { step: string; output: string; latency_ms: number; cost_usd: number }[];
  error?: string;
}

export interface StoredRun {
  id: string;
  kind: "playground";
  createdAt: number;
  question: string;
  corpusLabel: string;
  approaches: ApproachKey[];
  results: StoredApproachResult[];
  totalCost: number;
}

function read(): StoredRun[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(RUNS_KEY) || "[]");
  } catch {
    return [];
  }
}

function write(runs: StoredRun[]) {
  try {
    window.localStorage.setItem(RUNS_KEY, JSON.stringify(runs.slice(0, MAX_RUNS)));
    window.dispatchEvent(new Event("rag-atlas:runs-change"));
  } catch {
    /* quota — ignore */
  }
}

export function saveRun(run: StoredRun) {
  const runs = read();
  runs.unshift(run);
  write(runs);
}

export function listRuns(): StoredRun[] {
  return read();
}

export function getRun(id: string): StoredRun | undefined {
  return read().find((r) => r.id === id);
}

export function getLatestRun(): StoredRun | undefined {
  return read()[0];
}

export function deleteRun(id: string) {
  write(read().filter((r) => r.id !== id));
}

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

// --- eval experiments ----------------------------------------------------

export interface StoredEval {
  id: string;
  kind: "eval";
  createdAt: number;
  label: string;
  source: "custom" | "replay";
  approaches: ApproachKey[];
  results: EvalResults;
  totalCost: number;
  /** OpenRouter model slug the evaluation ran on. */
  model?: string;
  modelLabel?: string;
  /** Id of the matching JSON file in studio/results/, when the server saved one. */
  savedResultId?: string;
}

function readEvals(): StoredEval[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(EVALS_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeEvals(evals: StoredEval[]) {
  try {
    window.localStorage.setItem(EVALS_KEY, JSON.stringify(evals.slice(0, MAX_EVALS)));
    window.dispatchEvent(new Event("rag-atlas:evals-change"));
  } catch {
    /* quota — ignore */
  }
}

export function saveEval(ev: StoredEval) {
  const evals = readEvals();
  evals.unshift(ev);
  writeEvals(evals);
}

export function listEvals(): StoredEval[] {
  return readEvals();
}

export function getEval(id: string): StoredEval | undefined {
  return readEvals().find((e) => e.id === id);
}

export function getLatestEval(): StoredEval | undefined {
  return readEvals()[0];
}

export function deleteEval(id: string) {
  writeEvals(readEvals().filter((e) => e.id !== id));
}

// --- saved configurations ------------------------------------------------

export interface SavedConfig {
  id: string;
  name: string;
  createdAt: number;
  approaches: ApproachKey[];
  retrieval: RetrievalConfig;
  chunking: ChunkConfig;
  builtin?: boolean;
}

const STARTER_CONFIGS: Omit<SavedConfig, "id" | "createdAt">[] = [
  {
    name: "Needle stress test",
    approaches: ["naive", "rerank", "hybrid", "full_context"],
    retrieval: { top_k: 5, top_n_for_rerank: 20 },
    chunking: { target_tokens: 120, overlap_tokens: 24 },
    builtin: true,
  },
  {
    name: "Multi-hop reasoning",
    approaches: ["rerank", "hyde", "full_context", "sliding_window"],
    retrieval: { top_k: 8, top_n_for_rerank: 25 },
    chunking: { target_tokens: 180, overlap_tokens: 40 },
    builtin: true,
  },
  {
    name: "Refusal honesty check",
    approaches: ["naive", "rerank", "full_context"],
    retrieval: { top_k: 5, top_n_for_rerank: 20 },
    chunking: { target_tokens: 150, overlap_tokens: 30 },
    builtin: true,
  },
  {
    name: "Cheapest viable",
    approaches: ["naive", "hybrid", "rerank"],
    retrieval: { top_k: 4, top_n_for_rerank: 15 },
    chunking: { target_tokens: 150, overlap_tokens: 30 },
    builtin: true,
  },
];

function readConfigs(): SavedConfig[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(CONFIGS_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeConfigs(configs: SavedConfig[]) {
  try {
    window.localStorage.setItem(CONFIGS_KEY, JSON.stringify(configs));
    window.dispatchEvent(new Event("rag-atlas:configs-change"));
  } catch {
    /* ignore */
  }
}

/** Seed the built-in starter configs once. */
export function ensureStarterConfigs() {
  if (typeof window === "undefined") return;
  if (window.localStorage.getItem(STARTERS_FLAG)) return;
  const existing = readConfigs();
  const seeded = STARTER_CONFIGS.map((c, i) => ({
    ...c,
    id: `starter-${i}`,
    createdAt: Date.now() - i,
  }));
  writeConfigs([...existing, ...seeded]);
  window.localStorage.setItem(STARTERS_FLAG, "1");
}

export function listConfigs(): SavedConfig[] {
  return readConfigs();
}

export function saveConfig(cfg: Omit<SavedConfig, "id" | "createdAt">) {
  const configs = readConfigs();
  configs.unshift({ ...cfg, id: newId(), createdAt: Date.now() });
  writeConfigs(configs);
}

export function deleteConfig(id: string) {
  writeConfigs(readConfigs().filter((c) => c.id !== id));
}

// Hand a config to the Playground/Evaluate page to apply on next mount.
export function setPendingConfig(cfg: SavedConfig) {
  try {
    window.localStorage.setItem(PENDING_KEY, JSON.stringify(cfg));
  } catch {
    /* ignore */
  }
}

export function takePendingConfig(): SavedConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    window.localStorage.removeItem(PENDING_KEY);
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// --- export / import all -------------------------------------------------

export function exportAll(): string {
  return JSON.stringify(
    { runs: read(), evals: readEvals(), configs: readConfigs(), version: 1 },
    null,
    2,
  );
}

export function importAll(json: string): { runs: number; evals: number; configs: number } {
  const data = JSON.parse(json);
  const runs: StoredRun[] = Array.isArray(data.runs) ? data.runs : [];
  const evals: StoredEval[] = Array.isArray(data.evals) ? data.evals : [];
  const configs: SavedConfig[] = Array.isArray(data.configs) ? data.configs : [];
  // Merge by id (imported wins on conflict).
  const mergeById = <T extends { id: string }>(existing: T[], incoming: T[]) => {
    const map = new Map(existing.map((x) => [x.id, x]));
    incoming.forEach((x) => map.set(x.id, x));
    return [...map.values()];
  };
  write(mergeById(read(), runs).sort((a, b) => b.createdAt - a.createdAt));
  writeEvals(mergeById(readEvals(), evals).sort((a, b) => b.createdAt - a.createdAt));
  writeConfigs(mergeById(readConfigs(), configs).sort((a, b) => b.createdAt - a.createdAt));
  return { runs: runs.length, evals: evals.length, configs: configs.length };
}
