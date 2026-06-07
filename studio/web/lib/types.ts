// Shared API types. Kept in sync with studio/server/app/schemas.py.

export type ApproachKey =
  | "naive"
  | "hybrid"
  | "hyde"
  | "rerank"
  | "full_context"
  | "recursive_summary"
  | "sliding_window";

export type ProbeType =
  | "sanity"
  | "hallucination"
  | "needle"
  | "multi_hop"
  | "distractor";

export type ApproachFamily = "RAG" | "non-RAG";

export interface HealthResponse {
  status: string;
  service: string;
  api_version: string;
  ragureap_version: string;
  model_default: string;
  provider: string;
}

export interface KeyCheckResponse {
  ok: boolean;
  model?: string;
  latency_ms?: number;
  cost_usd?: number;
  message?: string;
}

export interface ChunkConfig {
  target_tokens: number;
  overlap_tokens: number;
}

export interface RetrievalConfig {
  top_k: number;
  top_n_for_rerank: number;
}

export interface LLMConfig {
  model: string;
  temperature: number;
  max_output_tokens: number;
}

export interface DocIn {
  doc_id?: string;
  text: string;
}

export interface DocStat {
  doc_id: string;
  words: number;
  chars: number;
}

export interface CorpusStats {
  n_docs: number;
  n_chunks: number;
  total_words: number;
  total_chars: number;
  est_tokens: number;
  documents: DocStat[];
}

export interface ChunkPreview {
  chunk_id: string;
  doc_id: string;
  idx: number;
  n_tokens: number;
  text: string;
}

export interface CorpusPreviewResponse {
  stats: CorpusStats;
  sample_chunks: ChunkPreview[];
}

export interface SessionCreateResponse {
  session_id: string;
  stats: CorpusStats;
  sample_chunks: ChunkPreview[];
}

export interface ApproachCatalogEntry {
  key: ApproachKey;
  label: string;
  family: ApproachFamily;
  color: string;
  tagline: string;
  steps: string[];
  llm_calls_per_question: number | null;
}

export interface RetrievedChunk {
  chunk_id: string;
  doc_id: string | null;
  text: string;
  score: number | null;
}

// --- SSE event payloads (loose; discriminated by `event`) ---------------

export interface SSEvent {
  event: string;
  [k: string]: unknown;
}

export interface ApproachDoneEvent extends SSEvent {
  event: "approach_done";
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
}

export interface StepEvent extends SSEvent {
  event: "step";
  approach: ApproachKey;
  index: number;
  n_steps: number;
  step: string;
  output: string;
  tokens_in: number;
  tokens_out: number;
  latency_ms: number;
  cost_usd: number;
  meta: Record<string, unknown>;
}

// --- eval results -------------------------------------------------------

export interface HeadlineRow {
  approach: ApproachKey;
  n: number;
  em: number;
  em_lo: number;
  em_hi: number;
  f1: number;
  f1_lo: number;
  f1_hi: number;
  accuracy: number;
  cost_usd: number;
  tokens_in: number;
  tokens_out: number;
  p50_ms: number;
  p95_ms: number;
}

export interface PerProbeRow {
  approach: ApproachKey;
  probe_type: ProbeType;
  n: number;
  em: number;
  em_lo: number;
  em_hi: number;
  f1: number;
  f1_lo: number;
  f1_hi: number;
}

export interface WinCell {
  wins: number;
  losses: number;
  ties: number;
  n: number;
}

export interface EvalQuestionResult {
  qid: string;
  type: ProbeType;
  gold: string;
  /** Attached client-side from the input question set (backend omits it). */
  question_text?: string;
  predictions: Partial<
    Record<ApproachKey, { pred: string; em: number; f1: number; correct: number }>
  >;
}

export interface EvalResults {
  approaches: ApproachKey[];
  headline: HeadlineRow[];
  per_probe: PerProbeRow[];
  pairwise_em: Record<string, Record<string, number>>;
  pairwise_f1: Record<string, Record<string, number>>;
  win_matrix: Record<string, Record<string, WinCell>>;
  questions: EvalQuestionResult[];
  totals: { cost_usd: number; n_questions: number };
}

export interface EstimateResponse {
  per_approach: {
    approach: ApproachKey;
    llm_calls: number;
    est_tokens_in: number;
    est_tokens_out: number;
    est_cost_usd: number;
  }[];
  total_llm_calls: number;
  total_cost_usd: number;
  note: string;
}
