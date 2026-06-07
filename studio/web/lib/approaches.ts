import type { ApproachFamily, ApproachKey } from "./types";

export interface ApproachMeta {
  key: ApproachKey;
  label: string;
  family: ApproachFamily;
  color: string;
  tagline: string;
  /** Plain-English, one-paragraph explainer for non-experts. */
  explainer: string;
  bestFor: string;
  weakAt: string;
  cost: "low" | "medium" | "high";
  /** Human-readable pipeline steps shown in the picker + trace legend. */
  steps: string[];
}

// Mirrors src/ragureap/approaches/* and frontend/web/lib/colors.ts so RAG Atlas,
// the results dashboard, and the paper figures share one visual language.
export const APPROACHES: Record<ApproachKey, ApproachMeta> = {
  naive: {
    key: "naive",
    label: "Naive RAG",
    family: "RAG",
    color: "#6b7280",
    tagline: "Embed query → top-k → generate",
    explainer:
      "The simplest retrieval recipe: turn your question into a vector, pull the few most similar chunks, and hand them to the model. It’s the baseline every fancier method has to beat.",
    bestFor: "A fast, cheap starting point on any corpus.",
    weakAt: "Multi-hop questions where the answer is split across chunks the query doesn’t directly match.",
    cost: "low",
    steps: ["Retrieve top-k", "Generate"],
  },
  hybrid: {
    key: "hybrid",
    label: "Hybrid RAG",
    family: "RAG",
    color: "#8b6f5e",
    tagline: "BM25 + dense, fused via RRF",
    explainer:
      "Runs keyword search (BM25) and vector search side by side, then blends their rankings. The idea: lexical search catches exact terms and codes, vector search catches meaning.",
    bestFor: "Corpora full of exact identifiers, codes, or names alongside prose.",
    weakAt: "Cases where keyword overlap misleads — a distractor sharing words but not the answer.",
    cost: "low",
    steps: ["BM25 + dense", "Fuse (RRF)", "Generate"],
  },
  hyde: {
    key: "hyde",
    label: "HyDE",
    family: "RAG",
    color: "#b8761a",
    tagline: "Hypothetical answer drives retrieval",
    explainer:
      "Asks the model to first imagine an answer, then retrieves using that hypothetical text instead of the bare question. A richer query can surface chunks a short question would miss.",
    bestFor: "Short or under-specified questions on a large corpus.",
    weakAt: "Small corpora — the extra LLM call adds cost and can pull toward plausible-sounding distractors.",
    cost: "medium",
    steps: ["Write hypothetical", "Retrieve", "Generate"],
  },
  rerank: {
    key: "rerank",
    label: "Reranker",
    family: "RAG",
    color: "#2d6a4f",
    tagline: "Dense top-20 → cross-encoder → top-5",
    explainer:
      "Casts a wide net (top-20), then a cross-encoder re-scores each candidate against the question and keeps the best five. The late re-scoring rescues relevant chunks that ranked low at first.",
    bestFor: "Best quality-per-dollar in the RAG family; needle-style recall.",
    weakAt: "Adds a model load; marginal benefit when retrieval already nails it.",
    cost: "low",
    steps: ["Retrieve top-20", "Rerank → top-5", "Generate"],
  },
  full_context: {
    key: "full_context",
    label: "Full-Context",
    family: "non-RAG",
    color: "#cf4520",
    tagline: "Entire corpus in a single prompt",
    explainer:
      "Skips retrieval entirely — drops the whole corpus into one prompt and lets the model read everything. Unbeatable when the corpus fits in the context window; impossible when it doesn’t.",
    bestFor: "Small corpora that fit comfortably in context — often the top accuracy.",
    weakAt: "Cost and feasibility scale with corpus size; doesn’t generalize to large libraries.",
    cost: "high",
    steps: ["Whole corpus → Generate"],
  },
  recursive_summary: {
    key: "recursive_summary",
    label: "Recursive Summary",
    family: "non-RAG",
    color: "#9b1d20",
    tagline: "Per-doc summary → answer",
    explainer:
      "Summarizes each document once, then answers from the summaries. Cheap per question — but summarization strips the exact identifiers, dates, and numbers that factoid questions ask about.",
    bestFor: "High-level questions whose answers survive summarization.",
    weakAt: "Factoid recall — it reliably loses specific details. The research found this the only significant loser.",
    cost: "medium",
    steps: ["Summarize each doc", "Answer over summaries"],
  },
  sliding_window: {
    key: "sliding_window",
    label: "Sliding-Window",
    family: "non-RAG",
    color: "#1d1d1f",
    tagline: "Per-document reasoning with running state",
    explainer:
      "Reads the corpus one document at a time, carrying a running ‘best answer’ forward. Each window gets focused attention, and the model consolidates as it goes.",
    bestFor: "High accuracy when focused per-document attention helps; multi-hop.",
    weakAt: "Most expensive (one call per document) and highest seed-to-seed variance.",
    cost: "high",
    steps: ["Window 1…N", "Carry running answer"],
  },
};

export const APPROACH_ORDER: ApproachKey[] = [
  "naive",
  "hybrid",
  "hyde",
  "rerank",
  "full_context",
  "recursive_summary",
  "sliding_window",
];

export const PROBE_LABEL: Record<string, string> = {
  sanity: "Sanity",
  hallucination: "Hallucination",
  needle: "Needle",
  multi_hop: "Multi-hop",
  distractor: "Distractor",
};

export const PROBE_COLOR: Record<string, string> = {
  sanity: "#7d8597",
  hallucination: "#9b1d20",
  needle: "#cf4520",
  multi_hop: "#2d6a4f",
  distractor: "#b8761a",
};
