// Domain-aware recommendation engine. Combines the per-domain priors from
// domains.ts with the user's answers, scoring each approach and attaching
// plain-English rationale tied to the research findings.

import { DOMAIN_BY_KEY } from "./domains";
import { APPROACH_ORDER } from "./approaches";
import type { ApproachKey } from "./types";

export interface RecAnswers {
  corpus: "fits" | "large";
  priority: "needle" | "reasoning" | "mixed";
  refusal: "critical" | "normal";
  budget: "tight" | "flexible";
}

export interface Rec {
  approach: ApproachKey;
  score: number;
  reasons: string[];
}

export function recommend(domainKey: string, answers: RecAnswers): Rec[] {
  const domain = DOMAIN_BY_KEY[domainKey];
  const score: Record<ApproachKey, number> = {} as Record<ApproachKey, number>;
  const reasons: Record<ApproachKey, string[]> = {} as Record<ApproachKey, string[]>;
  APPROACH_ORDER.forEach((a) => {
    score[a] = 0;
    reasons[a] = [];
  });

  const bump = (a: ApproachKey, pts: number, why: string) => {
    score[a] += pts;
    if (pts !== 0 && why) reasons[a].push(why);
  };

  // Domain priors.
  if (domain) {
    domain.recommended.forEach((a, i) => bump(a, 3 - i, `Recommended for ${domain.label.toLowerCase()}`));
    domain.avoid.forEach((a) => bump(a, -5, `Generally avoided for ${domain.label.toLowerCase()}`));
  }

  // Corpus size.
  if (answers.corpus === "large") {
    bump("full_context", -6, "Your corpus is too large to fit in one prompt");
    bump("recursive_summary", -1, "Summarizing a large corpus loses more detail");
    bump("rerank", 2, "Retrieval earns its keep when the corpus won’t fit in context");
    bump("hybrid", 2, "Retrieval scales to large corpora");
    bump("hyde", 1, "Query expansion helps find chunks in a large corpus");
  } else {
    bump("full_context", 3, "Your corpus fits in context — often the highest accuracy");
    bump("sliding_window", 1, "Per-document reading works well at this scale");
  }

  // Primary need.
  if (answers.priority === "needle") {
    bump("rerank", 2, "Reranking protects exact-match recall of specific facts");
    bump("hybrid", 1, "Lexical signal helps match exact identifiers");
    bump("recursive_summary", -4, "Summarization strips the exact identifiers needles depend on");
  } else if (answers.priority === "reasoning") {
    bump("sliding_window", 2, "Per-document carry-over helps chain facts across documents");
    bump("full_context", 1, "Seeing everything at once aids multi-hop reasoning");
    bump("rerank", 1, "Better chunk selection helps multi-hop");
  } else {
    bump("rerank", 1, "Solid all-rounder for mixed question types");
  }

  // Refusal sensitivity.
  if (answers.refusal === "critical") {
    bump("rerank", 1, "Reliable retrieval + a strict refusal prompt = honest abstention");
    bump("full_context", 1, "Full context makes ‘not in corpus’ judgments reliable");
    bump("hyde", -2, "A hypothetical answer can nudge toward plausible-but-wrong content");
    bump("recursive_summary", -1, "Lossy summaries make grounding harder to verify");
  }

  // Budget sensitivity.
  if (answers.budget === "tight") {
    bump("naive", 2, "Cheapest single-call option");
    bump("rerank", 1, "Near-naive cost with better quality");
    bump("hybrid", 1, "Single-call, low cost");
    bump("sliding_window", -3, "One model call per document — the most expensive option");
    bump("full_context", -2, "Cost scales with the whole corpus every question");
    bump("hyde", -1, "Adds a second model call per question");
  }

  return APPROACH_ORDER.map((a) => ({ approach: a, score: score[a], reasons: reasons[a] }))
    .sort((x, y) => y.score - x.score);
}

export const REC_QUESTIONS = [
  {
    key: "corpus" as const,
    label: "How big is your corpus?",
    options: [
      { value: "fits", label: "Fits in context", hint: "A handful of documents / under ~100K tokens" },
      { value: "large", label: "Large library", hint: "Won’t fit in one prompt" },
    ],
  },
  {
    key: "priority" as const,
    label: "What matters most?",
    options: [
      { value: "needle", label: "Exact facts", hint: "Codes, names, dates, citations" },
      { value: "reasoning", label: "Multi-hop reasoning", hint: "Chaining facts across docs" },
      { value: "mixed", label: "A mix", hint: "Both kinds of questions" },
    ],
  },
  {
    key: "refusal" as const,
    label: "How costly is a wrong answer?",
    options: [
      { value: "critical", label: "Very — must refuse", hint: "Legal / clinical / high-stakes" },
      { value: "normal", label: "Tolerable", hint: "A wrong answer is recoverable" },
    ],
  },
  {
    key: "budget" as const,
    label: "How tight is your budget?",
    options: [
      { value: "tight", label: "Cost-sensitive", hint: "High volume / low cost per query" },
      { value: "flexible", label: "Quality first", hint: "Spend more for accuracy" },
    ],
  },
];
