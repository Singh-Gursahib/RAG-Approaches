import type { ApproachDoneEvent, ApproachKey, StepEvent } from "@/lib/types";

export type RunStatus = "queued" | "building" | "running" | "done" | "error";

export interface ApproachRunState {
  approach: ApproachKey;
  status: RunStatus;
  steps: StepEvent[];
  buildMs?: number;
  done?: ApproachDoneEvent;
  error?: string;
}

const STEP_LABELS: Record<string, string> = {
  retrieve: "Retrieve top-k",
  retrieve_hybrid: "Hybrid retrieve + fuse",
  retrieve_then_rerank: "Retrieve + rerank",
  retrieve_via_hypothetical: "Retrieve via hypothetical",
  hyde_rewrite: "Write hypothetical answer",
  generate: "Generate answer",
  generate_full_context: "Read full corpus → answer",
  summarize_corpus_amortized: "Summarize corpus (once)",
  generate_over_summaries: "Answer over summaries",
};

export function humanizeStep(step: string): string {
  if (STEP_LABELS[step]) return STEP_LABELS[step];
  const m = step.match(/^window_(\d+)_of_(\d+)$/);
  if (m) return `Read document ${m[1]} of ${m[2]}`;
  return step.replace(/_/g, " ");
}
