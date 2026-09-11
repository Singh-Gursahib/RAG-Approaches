"use client";

// Model selection shared by Playground, Evaluate and Replay. The chosen model and
// reasoning mode are remembered in localStorage (they are not secrets); the
// other settings stay per page.

import { useCallback, useEffect, useState } from "react";
import type { LLMConfig, ReasoningMode } from "./types";

export const PAPER_MODEL = "google/gemini-3-flash-preview";

export const REASONING_OPTIONS: { value: ReasoningMode; label: string; hint: string }[] = [
  { value: "lowest", label: "Lowest available", hint: "Off when the model allows it, otherwise its lowest effort. Closest to the paper's direct-answer setup." },
  { value: "default", label: "Model default", hint: "Send no reasoning setting; the model decides how much to think." },
  { value: "none", label: "Off", hint: "Disable reasoning (falls back to the lowest effort on models that always reason)." },
  { value: "minimal", label: "Minimal", hint: "About 10% of the token limit reserved for reasoning." },
  { value: "low", label: "Low", hint: "About 20% of the token limit reserved for reasoning." },
  { value: "medium", label: "Medium", hint: "About 50% of the token limit reserved for reasoning." },
  { value: "high", label: "High", hint: "About 80% of the token limit reserved for reasoning." },
  { value: "max", label: "Max", hint: "Nearly all of the token limit reserved for reasoning." },
];

// Same pattern the backend validates (schemas.MODEL_SLUG_PATTERN).
export const MODEL_SLUG = /^~?[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._:+-]*$/;

export const DEFAULT_LLM: LLMConfig = {
  model: PAPER_MODEL,
  temperature: 0,
  max_output_tokens: 512,
  reasoning: "lowest",
};

const CHOICE_KEY = "rag-atlas:model-choice";

function readChoice(): Partial<Pick<LLMConfig, "model" | "reasoning">> {
  if (typeof window === "undefined") return {};
  try {
    const raw = JSON.parse(window.localStorage.getItem(CHOICE_KEY) || "{}");
    return {
      model: typeof raw.model === "string" && MODEL_SLUG.test(raw.model) ? raw.model : undefined,
      reasoning: REASONING_OPTIONS.some((o) => o.value === raw.reasoning) ? raw.reasoning : undefined,
    };
  } catch {
    return {};
  }
}

/** LLM settings for a page, starting from `defaults` plus the remembered model choice. */
export function useLLMConfig(defaults: Partial<LLMConfig> = {}) {
  const [llm, setLLMState] = useState<LLMConfig>({ ...DEFAULT_LLM, ...defaults });

  useEffect(() => {
    const saved = readChoice();
    setLLMState((cur) => ({
      ...cur,
      ...(saved.model ? { model: saved.model } : {}),
      ...(saved.reasoning ? { reasoning: saved.reasoning } : {}),
    }));
  }, []);

  const setLLM = useCallback((next: LLMConfig) => {
    setLLMState(next);
    try {
      window.localStorage.setItem(CHOICE_KEY, JSON.stringify({ model: next.model, reasoning: next.reasoning }));
    } catch {
      /* quota or disabled storage: the choice just isn't remembered */
    }
  }, []);

  return [llm, setLLM] as const;
}
