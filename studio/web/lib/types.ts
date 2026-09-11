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

export type ReasoningMode = "lowest" | "default" | "none" | "minimal" | "low" | "medium" | "high" | "max";

export interface HealthResponse {
  status: string;
  service: string;
  api_version: string;
  ragureap_version: string;
  model_default: string;
  provider: string;
  server_key_configured?: boolean;
}

export interface KeyCheckResponse {
  ok: boolean;
  source?: "browser" | "server";
  is_free_tier?: boolean | null;
  limit_remaining?: number | null;
  usage_usd?: number | null;
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
  /** OpenRouter model slug, e.g. "z-ai/glm-5.3-flash". */
  model: string;
  temperature: number;
  max_output_tokens: number;
  reasoning?: ReasoningMode;
  seed?: number | null;
}

// --- OpenRouter models ----------------------------------------------------

export interface ReasoningInfo {
  mandatory?: boolean;
  default_enabled?: boolean;
  supported_efforts?: string[];
  default_effort?: string | null;
}

export interface ModelInfo {
  id: string;
  name: string | null;
  input_per_m: number | null;
  output_per_m: number | null;
  context_length: number | null;
  max_completion_tokens: number | null;
  hugging_face_id: string | null;
  reasoning: ReasoningInfo | null;
  supported_parameters?: string[];
  /** true = exists on OpenRouter, false = not in the live list, null = couldn't check. */
  found?: boolean | null;
  source: "live" | "snapshot" | "unknown" | string;
}

export interface CuratedModel extends ModelInfo {
  label: string;
  lab: string;
  note: string | null;
  open_weights: boolean;
  paper_model: boolean;
}

export interface ModelsResponse {
  default: string;
  paper_model: string;
  reasoning_modes: ReasoningMode[];
  models: CuratedModel[];
}

export interface PricingResponse {
  model: string;
  input_per_m: number;
  output_per_m: number;
  currency: string;
  source: string;
  note: string;
}

// --- corpus ---------------------------------------------------------------

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
  reasoning_tokens?: number;
  model?: string;
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
  /** Graded answers (questions × runs). */
  n: number;
  n_seeds?: number;
  n_questions_per_seed?: number;
  em: number;
  em_seed_std?: number;
  em_lo: number;
  em_hi: number;
  f1: number;
  f1_seed_std?: number;
  f1_lo: number;
  f1_hi: number;
  accuracy: number;
  /** Mean cost of one full run. */
  cost_usd: number;
  cost_seed_std?: number;
  cost_total_usd?: number;
  tokens_in: number;
  tokens_out: number;
  p50_ms: number;
  p95_ms: number;
  errors?: number;
  llm_calls?: number | null;
  reasoning_tokens?: number | null;
  truncation_retries?: number;
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

export interface EvalPredictionRun {
  repeat: number;
  pred: string;
  em?: number;
  f1: number;
  correct: number;
  cost_usd?: number;
  latency_ms?: number;
  error?: string | null;
}

export interface EvalPrediction {
  /** First run's answer. */
  pred: string;
  em: number;
  f1: number;
  /** Correct in most runs. */
  correct: number;
  correct_rate?: number;
  n_seeds?: number;
  preds?: EvalPredictionRun[];
}

export interface EvalQuestionResult {
  qid: string;
  type: ProbeType;
  gold: string;
  question_text?: string;
  predictions: Partial<Record<ApproachKey, EvalPrediction>>;
}

export interface EvalResults {
  approaches: ApproachKey[];
  headline: HeadlineRow[];
  per_probe: PerProbeRow[];
  pairwise_em: Record<string, Record<string, number>>;
  pairwise_f1: Record<string, Record<string, number>>;
  win_matrix: Record<string, Record<string, WinCell>>;
  questions: EvalQuestionResult[];
  totals: { cost_usd: number; n_questions: number; repeats?: number; n_graded?: number };
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

// --- saved test results (studio/results/*.json) -------------------------

export interface SavedModel {
  id: string;
  label: string;
  lab: string;
  name: string | null;
  open_weights: boolean;
  hugging_face_id: string | null;
  pricing_per_m: { input: number | null; output: number | null };
  metadata_source: string | null;
}

export interface SavedResultSummary {
  id: string;
  created_at: string | null;
  source: "replay" | "custom" | string;
  label: string;
  provider: string;
  model: SavedModel;
  temperature: number | null;
  repeats: number | null;
  reasoning_effort_sent: string | null;
  dataset: string | null;
  n_questions: number | null;
  approaches: ApproachKey[];
  total_cost_usd: number | null;
  best: { approach: ApproachKey; f1: number } | null;
}

export interface SavedResult {
  schema_version: number;
  id: string;
  created_at: string | null;
  source: "replay" | "custom" | string;
  label: string;
  provider: string;
  model: SavedModel;
  config: {
    temperature: number;
    answer_token_budget: number;
    max_tokens_sent: number;
    reasoning_requested: string;
    reasoning_effort_sent: string | null;
    repeats: number;
    seeds: number[];
    retrieval: RetrievalConfig;
    chunking: ChunkConfig;
    approaches: ApproachKey[];
    eval_concurrency: number;
    attribution_headers_sent: boolean;
    note?: string;
  };
  dataset: {
    name: string;
    n_questions: number;
    n_docs: number;
    questions: { id: string; type: ProbeType; question: string; gold_answer: string }[];
  };
  runtime: {
    started_at: string | null;
    finished_at: string | null;
    wall_s: number | null;
    total_cost_usd: number;
    llm_calls: number | null;
    reasoning_tokens: number | null;
    truncation_retries: number;
    per_approach: Record<string, { llm_calls: number; reasoning_tokens: number; truncation_retries: number }>;
  };
  results: EvalResults;
}

// --- replay ----------------------------------------------------------------

export interface PaperHeadlineRow {
  approach: ApproachKey;
  em: number;
  em_std: number;
  f1: number;
  f1_std: number;
  f1_lo: number;
  f1_hi: number;
  cost_usd: number;
}

export interface ReplayMeta {
  corpus: { n_docs: number; total_words: number; documents: { doc_id: string; words: number }[] };
  eval_set: { n_questions: number; by_probe_type: Record<string, number> };
  paper_headline: PaperHeadlineRow[];
  paper_model: string;
  paper_settings: { temperature: number; repeats: number; answer_token_budget: number };
  paper_result_id: string | null;
  model: string;
  note: string;
}
