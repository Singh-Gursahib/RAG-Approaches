"""Gemini wrapper with token + cost accounting and rate-limit retry."""
from __future__ import annotations

import os
import random
import time
from dataclasses import dataclass

from ..eval.cost import BudgetLedger, Price


@dataclass(frozen=True)
class GeminiResponse:
    text: str
    tokens_in: int
    tokens_out: int
    cost_usd: float
    latency_ms: float
    model: str


class GeminiClient:
    """Single-model client for `gemini-3-flash-preview` (or override).

    Every `generate` call:
      1. Pre-flight checks the BudgetLedger using an *estimated* cost based on prompt length.
      2. Calls the model with deterministic settings (temperature 0, fixed seed not supported by Gemini API).
      3. Records the *actual* cost into the ledger.
      4. Retries on transient errors with exponential backoff.
    """

    def __init__(
        self,
        model_name: str = "gemini-3-flash-preview",
        api_key: str | None = None,
        temperature: float = 0.0,
        max_output_tokens: int = 512,
        budget_ledger: BudgetLedger | None = None,
        price: Price | None = None,
        max_retries: int = 4,
        run_id: str | None = None,
    ):
        self.model_name = model_name
        self.api_key = api_key or os.environ.get("GOOGLE_API_KEY", "")
        if not self.api_key:
            raise RuntimeError(
                "GOOGLE_API_KEY not set. Put it in .env or pass api_key= explicitly."
            )
        self.temperature = temperature
        self.max_output_tokens = max_output_tokens
        self.budget = budget_ledger or BudgetLedger()
        self.price = price or Price.from_env()
        self.max_retries = max_retries
        self.run_id = run_id
        self._model = None  # lazy

    def _ensure_model(self):
        if self._model is not None:
            return self._model
        import google.generativeai as genai

        genai.configure(api_key=self.api_key)
        self._model = genai.GenerativeModel(model_name=self.model_name)
        return self._model

    def _estimate_cost(self, prompt: str) -> float:
        # Very rough: ~4 chars/token in English; assume max_output_tokens is fully used.
        est_in = max(1, len(prompt) // 4)
        return self.price.usd(est_in, self.max_output_tokens)

    def generate(self, prompt: str) -> GeminiResponse:
        """Send a single prompt; return text + token + cost telemetry."""
        self.budget.preflight(self._estimate_cost(prompt), run_id=self.run_id)
        model = self._ensure_model()

        import google.generativeai as genai

        gen_config = genai.GenerationConfig(
            temperature=self.temperature,
            max_output_tokens=self.max_output_tokens,
        )

        last_exc: Exception | None = None
        for attempt in range(self.max_retries + 1):
            t0 = time.perf_counter()
            try:
                response = model.generate_content(prompt, generation_config=gen_config)
                latency_ms = (time.perf_counter() - t0) * 1000.0
                text = self._extract_text(response)
                tokens_in, tokens_out = self._extract_tokens(response, prompt, text)
                cost = self.price.usd(tokens_in, tokens_out)
                self.budget.record(
                    cost_usd=cost,
                    tokens_in=tokens_in,
                    tokens_out=tokens_out,
                    model=self.model_name,
                    run_id=self.run_id,
                    kind="generate",
                )
                return GeminiResponse(
                    text=text,
                    tokens_in=tokens_in,
                    tokens_out=tokens_out,
                    cost_usd=cost,
                    latency_ms=latency_ms,
                    model=self.model_name,
                )
            except Exception as e:  # broad on purpose — transient API issues vary by SDK version
                last_exc = e
                if attempt >= self.max_retries:
                    break
                # Exponential backoff with jitter.
                sleep_s = min(30.0, (2**attempt) + random.uniform(0, 0.5))
                msg = str(e)[:200]
                print(
                    f"[gemini] attempt {attempt + 1} failed ({type(e).__name__}: {msg}); "
                    f"retrying in {sleep_s:.1f}s",
                    flush=True,
                )
                time.sleep(sleep_s)
        raise RuntimeError(
            f"Gemini generate failed after {self.max_retries + 1} attempts: {last_exc!r}"
        )

    # ---- helpers ----

    @staticmethod
    def _extract_text(response) -> str:
        """Extract response text, handling safety-blocked / empty outputs gracefully."""
        try:
            text = response.text
            if text is None:
                return ""
            return text.strip()
        except (ValueError, AttributeError):
            # `response.text` raises when the candidate has no text part
            # (safety block, function call, etc.). Fall back to part traversal.
            try:
                parts = response.candidates[0].content.parts
                return " ".join(getattr(p, "text", "") for p in parts).strip()
            except Exception:
                return ""

    def _extract_tokens(self, response, prompt: str, output_text: str) -> tuple[int, int]:
        meta = getattr(response, "usage_metadata", None)
        if meta is not None:
            try:
                return (
                    int(getattr(meta, "prompt_token_count", 0) or 0),
                    int(getattr(meta, "candidates_token_count", 0) or 0),
                )
            except Exception:
                pass
        # Fallback heuristic — should rarely fire.
        return max(1, len(prompt) // 4), max(1, len(output_text) // 4)
