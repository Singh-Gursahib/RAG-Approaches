// Typed fetch client for the RAG Atlas backend.
//
// Requests go to /api/* which Next rewrites to FastAPI (see next.config.mjs), so
// the browser stays same-origin. The OpenRouter key is attached per-request from
// sessionStorage via the X-OpenRouter-Key header on endpoints that spend.

import { getKey } from "./key";
import type {
  ApproachCatalogEntry,
  CorpusPreviewResponse,
  DocIn,
  ChunkConfig,
  EstimateResponse,
  HealthResponse,
  KeyCheckResponse,
  LLMConfig,
  ModelInfo,
  ModelsResponse,
  PricingResponse,
  ReplayMeta,
  RetrievalConfig,
  SavedResult,
  SavedResultSummary,
  SessionCreateResponse,
} from "./types";

export class ApiError extends Error {
  status: number;
  detail: unknown;
  constructor(status: number, message: string, detail?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

interface RequestOpts {
  withKey?: boolean;
  signal?: AbortSignal;
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  opts: RequestOpts = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body) headers.set("Content-Type", "application/json");
  if (opts.withKey) {
    const key = getKey();
    if (key) headers.set("X-OpenRouter-Key", key);
  }

  let resp: Response;
  try {
    resp = await fetch(`/api${path}`, { ...init, headers, signal: opts.signal });
  } catch (e) {
    throw new ApiError(0, "Could not reach the RAG Atlas backend. Is it running?", e);
  }

  const isJson = resp.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await resp.json().catch(() => null) : await resp.text();

  if (!resp.ok) {
    const message =
      (isJson && body && (body.detail?.message || body.detail || body.message)) ||
      `Request failed (${resp.status})`;
    throw new ApiError(resp.status, String(message), body);
  }
  return body as T;
}

export const api = {
  health: (signal?: AbortSignal) => request<HealthResponse>("/health", {}, { signal }),

  approaches: () =>
    request<{ approaches: ApproachCatalogEntry[] }>("/approaches"),

  models: () => request<ModelsResponse>("/models"),

  modelLookup: (id: string) =>
    request<ModelInfo>(`/models/lookup?id=${encodeURIComponent(id)}`),

  pricing: (model?: string) =>
    request<PricingResponse>(`/pricing${model ? `?model=${encodeURIComponent(model)}` : ""}`),

  checkKey: (signal?: AbortSignal) =>
    request<KeyCheckResponse>("/key/check", { method: "POST" }, { withKey: true, signal }),

  corpusPreview: (documents: DocIn[], chunking: ChunkConfig, signal?: AbortSignal) =>
    request<CorpusPreviewResponse>(
      "/corpus/preview",
      { method: "POST", body: JSON.stringify({ documents, chunking }) },
      { signal },
    ),

  createSession: (documents: DocIn[], chunking: ChunkConfig, signal?: AbortSignal) =>
    request<SessionCreateResponse>(
      "/session",
      { method: "POST", body: JSON.stringify({ documents, chunking }) },
      { signal },
    ),

  deleteSession: (sessionId: string) =>
    request<{ deleted: boolean }>(`/session/${sessionId}`, { method: "DELETE" }),

  estimate: (params: {
    n_questions: number;
    approaches: string[];
    corpus_tokens: number;
    n_docs: number;
    retrieval?: RetrievalConfig;
    llm?: LLMConfig;
    repeats?: number;
  }) =>
    request<EstimateResponse>("/eval/estimate", {
      method: "POST",
      body: JSON.stringify(params),
    }),

  replayMeta: () => request<ReplayMeta>("/replay/meta"),

  results: () => request<{ results: SavedResultSummary[] }>("/results"),

  result: (id: string) => request<SavedResult>(`/results/${encodeURIComponent(id)}`),
};
