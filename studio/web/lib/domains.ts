import type { ApproachKey } from "./types";

export interface DomainGuide {
  key: string;
  label: string;
  blurb: string;
  /** Ranked recommendations with rationale tied to the research findings. */
  recommended: ApproachKey[];
  avoid: ApproachKey[];
  rationale: string;
}

// Derived from FINDINGS.md / the paper's domain-aware discussion. These are
// starting points the framework expects users to refine on their own data.
export const DOMAINS: DomainGuide[] = [
  {
    key: "education",
    label: "Education & tutoring",
    blurb: "Explaining concepts, summarizing material, answering student questions.",
    recommended: ["rerank", "full_context", "naive"],
    avoid: ["recursive_summary"],
    rationale:
      "Tutoring tolerates verbose, synthesized answers, so reranked retrieval or full-context both work well. Avoid pre-summarization when students ask for specific facts, dates, or formulas.",
  },
  {
    key: "legal",
    label: "Legal research",
    blurb: "Statutes, citations, clause lookup — exact identifiers matter.",
    recommended: ["rerank", "hybrid", "full_context"],
    avoid: ["recursive_summary"],
    rationale:
      "Legal work is needle-heavy (statute numbers, case citations). Hybrid’s lexical signal and reranking both protect exact-match recall. Refusal honesty is essential — a wrong citation is worse than none.",
  },
  {
    key: "healthcare",
    label: "Healthcare & clinical",
    blurb: "Drug names, dosages, guidelines — accuracy and honesty are critical.",
    recommended: ["rerank", "full_context"],
    avoid: ["recursive_summary", "hyde"],
    rationale:
      "Prioritize needle recall and refusal honesty. Summarization strips identifiers like drug codes; HyDE can hallucinate a plausible-but-wrong hypothetical. Reranking + a strict refusal prompt is the safest stack.",
  },
  {
    key: "enterprise",
    label: "Enterprise search",
    blurb: "Large, heterogeneous internal corpora across many docs.",
    recommended: ["rerank", "hybrid", "hyde"],
    avoid: ["full_context"],
    rationale:
      "At enterprise scale the corpus won’t fit in context, so retrieval earns its keep. Hybrid handles mixed exact-term + semantic queries; reranking lifts quality; HyDE helps terse queries.",
  },
  {
    key: "support",
    label: "Customer support",
    blurb: "FAQ and ticket deflection — fast, cheap, honest answers.",
    recommended: ["naive", "rerank", "hybrid"],
    avoid: ["sliding_window", "recursive_summary"],
    rationale:
      "Support needs low latency and low cost at volume. Single-call RAG (naive/rerank/hybrid) fits; sliding-window’s per-document calls are too slow and costly for high throughput.",
  },
  {
    key: "knowledge",
    label: "Knowledge management",
    blurb: "Wikis, runbooks, and docs spanning many topics.",
    recommended: ["rerank", "hybrid", "full_context"],
    avoid: ["recursive_summary"],
    rationale:
      "Mixed factoid + conceptual questions. Reranking gives the best quality-per-dollar; full-context shines for smaller, self-contained knowledge bases. Keep summaries out of the answer path for fact lookups.",
  },
];

export const DOMAIN_BY_KEY: Record<string, DomainGuide> = Object.fromEntries(
  DOMAINS.map((d) => [d.key, d]),
);
