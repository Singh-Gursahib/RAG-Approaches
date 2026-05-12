// Shape mirrors what scripts/build_dashboard_data.py emits.

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

export interface HeadlineRow {
  approach: ApproachKey;
  run_id: string;
  n: number;
  em: number;
  em_lo: number;
  em_hi: number;
  f1: number;
  f1_lo: number;
  f1_hi: number;
  cost_usd: number;
  tokens_in: number;
  tokens_out: number;
  p50_ms: number;
  p95_ms: number;
  wall_s: number;
  // Optional, present when data was built from a multi-seed sweep
  n_seeds?: number;
  em_seed_std?: number;
  f1_seed_std?: number;
}

export interface PerProbeRow {
  approach: ApproachKey;
  run_id: string;
  probe_type: ProbeType;
  n: number;
  em: number;
  em_lo: number;
  em_hi: number;
  f1: number;
  f1_lo: number;
  f1_hi: number;
}

export interface QuestionPrediction {
  pred: string;
  em: number;
  f1: number;
  correct: number;
  // Optional, present when data was built from a multi-seed sweep
  correct_rate?: number;
  n_seeds?: number;
}

export interface Question {
  qid: string;
  type: ProbeType;
  gold: string;
  predictions: Partial<Record<ApproachKey, QuestionPrediction>>;
}

export interface WinCell {
  wins: number;
  losses: number;
  ties: number;
  n: number;
}

export interface DashboardData {
  generated_at: string;
  project: {
    name: string;
    budget_cap_usd: number;
    cumulative_spend_usd: number;
    spend_pct: number;
    total_llm_calls: number;
    model: string;
  };
  corpus: {
    n_docs: number;
    total_words: number;
    documents: { doc_id: string; words: number; chars: number }[];
  };
  eval_set: {
    n_questions: number;
    by_probe_type: Partial<Record<ProbeType, number>>;
  };
  headline: HeadlineRow[];
  per_probe: PerProbeRow[];
  pairwise_em: Record<string, Record<string, number>>;
  pairwise_f1: Record<string, Record<string, number>>;
  win_matrix: Record<string, Record<string, WinCell>>;
  questions: Question[];
  is_sweep?: boolean;
  temperature?: number;
}
