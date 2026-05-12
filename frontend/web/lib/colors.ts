import type { ApproachKey, ProbeType } from "./types";

export const APPROACH_COLOR: Record<ApproachKey, string> = {
  sliding_window: "#1d1d1f",
  full_context: "#cf4520",
  rerank: "#2d6a4f",
  naive: "#6b7280",
  hyde: "#b8761a",
  hybrid: "#8b6f5e",
  recursive_summary: "#9b1d20",
};

export const APPROACH_LABEL: Record<ApproachKey, string> = {
  sliding_window: "Sliding-Window",
  full_context: "Full-Context",
  rerank: "Reranker",
  naive: "Naive RAG",
  hyde: "HyDE",
  hybrid: "Hybrid RAG",
  recursive_summary: "Recursive Summary",
};

export const APPROACH_FAMILY: Record<ApproachKey, "RAG" | "non-RAG"> = {
  sliding_window: "non-RAG",
  full_context: "non-RAG",
  rerank: "RAG",
  naive: "RAG",
  hyde: "RAG",
  hybrid: "RAG",
  recursive_summary: "non-RAG",
};

export const APPROACH_TAGLINE: Record<ApproachKey, string> = {
  sliding_window: "Per-document reasoning with running state",
  full_context: "Entire corpus into a single prompt",
  rerank: "Dense top-20 → cross-encoder → top-5",
  naive: "Embed query → top-k → generate",
  hyde: "Hypothetical answer drives retrieval",
  hybrid: "BM25 + dense fused via RRF",
  recursive_summary: "Per-doc summary → answer",
};

export const PROBE_COLOR: Record<ProbeType, string> = {
  sanity: "#7d8597",
  hallucination: "#9b1d20",
  needle: "#cf4520",
  multi_hop: "#2d6a4f",
  distractor: "#b8761a",
};

export const PROBE_LABEL: Record<ProbeType, string> = {
  sanity: "Sanity",
  hallucination: "Hallucination",
  needle: "Needle",
  multi_hop: "Multi-hop",
  distractor: "Distractor",
};
