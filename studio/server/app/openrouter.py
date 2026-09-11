"""OpenRouter chat-completions client (OpenAI-compatible API).

One model call per `generate()`: POST https://openrouter.ai/api/v1/chat/completions
with {model, messages, temperature, max_tokens, seed?, reasoning?}. Token counts
and the dollar cost come from the `usage` object OpenRouter returns with every
response, so the recorded cost is what the account was actually charged.

Anonymity
---------
OpenRouter attributes traffic to an app only through optional request headers:
`HTTP-Referer` (required for attribution), `X-OpenRouter-Title` (legacy
`X-Title`), `X-OpenRouter-Categories` and `X-OpenRouter-App-Visibility`. This
client sends none of them and never sends a `user` field. Calls are made
server-side, so no browser Origin or Referer reaches OpenRouter either.
`anonymous_headers()` is the single place request headers are built; tests
assert nothing else is added.

Reasoning
---------
Most current "flash" models think before answering. Reasoning modes:
  lowest   disable reasoning when the model allows it, otherwise use its lowest
           supported effort (the default; closest to a direct-answer setup)
  default  send no reasoning parameter; the model uses its own default
  none | minimal | low | medium | high | max   request that effort explicitly
OpenRouter reserves an effort-dependent share of `max_tokens` for reasoning, so
the request's `max_tokens` is scaled up to keep the answer budget intact and to
leave reasoning at least MIN_REASONING_TOKENS of room. If a
reply still comes back empty because it hit the limit, it is retried once with
double the limit.
"""
from __future__ import annotations

import math
import random
import threading
import time
from dataclasses import dataclass

import httpx

from ragureap.eval.cost import BudgetLedger, Price

API_BASE = "https://openrouter.ai/api/v1"
CHAT_URL = f"{API_BASE}/chat/completions"
KEY_URL = f"{API_BASE}/key"

# Share of max_tokens OpenRouter allocates to reasoning at each effort level.
EFFORT_FRACTION = {
    "none": 0.0,
    "minimal": 0.10,
    "low": 0.20,
    "medium": 0.50,
    "high": 0.80,
    "xhigh": 0.95,
    "max": 0.95,
}
MAX_TOKENS_CAP = 32768
# Least room a request leaves for reasoning. A small share of a small limit (20% of
# 640 tokens at low effort) starves models that must reason: on long prompts they
# return cut-off or wrong answers. max_tokens is only a ceiling; unused tokens cost nothing.
MIN_REASONING_TOKENS = 1024
RETRYABLE_STATUS = frozenset({408, 409, 425, 429, 500, 502, 503, 504, 520, 522, 524, 529})

_http_lock = threading.Lock()
_http_client: httpx.Client | None = None


def http_client() -> httpx.Client:
    """Shared, thread-safe connection pool (patched in tests)."""
    global _http_client
    with _http_lock:
        if _http_client is None:
            _http_client = httpx.Client(timeout=httpx.Timeout(300.0, connect=20.0))
        return _http_client


def anonymous_headers(api_key: str, *, json_body: bool = True) -> dict[str, str]:
    """The only headers sent to OpenRouter: credentials and content type.

    Deliberately omits `HTTP-Referer`, `X-OpenRouter-Title` and `X-Title`, the
    headers OpenRouter uses for app attribution and rankings.
    """
    headers = {"Authorization": f"Bearer {api_key}"}
    if json_body:
        headers["Content-Type"] = "application/json"
    return headers


class OpenRouterError(RuntimeError):
    def __init__(self, message: str, status: int | None = None):
        super().__init__(message)
        self.status = status


@dataclass(frozen=True)
class LLMResponse:
    text: str
    tokens_in: int
    tokens_out: int
    cost_usd: float
    latency_ms: float
    model: str
    reasoning_tokens: int = 0
    finish_reason: str | None = None
    reasoning_effort: str | None = None
    max_tokens_sent: int | None = None
    truncation_retries: int = 0
    provider: str | None = None


def resolve_reasoning(mode: str | None, reasoning_info: dict | None) -> str | None:
    """Translate a reasoning mode into the `reasoning.effort` to send (None = omit)."""
    mode = mode or "lowest"
    if mode == "default":
        return None
    info = reasoning_info or {}
    efforts = list(info.get("supported_efforts") or [])
    lowest = efforts[-1] if efforts else "low"
    mandatory = bool(info.get("mandatory"))
    if mode == "lowest":
        if not reasoning_info:
            return None
        return lowest if mandatory else "none"
    if mode == "none" and mandatory:
        return lowest
    return mode


def request_max_tokens(
    answer_budget: int,
    effort: str | None,
    reasoning_info: dict | None,
    model_cap: int | None = None,
) -> int:
    """`max_tokens` to request so reasoning neither eats the answer budget nor runs out of room."""
    if effort is not None:
        fraction = EFFORT_FRACTION.get(effort, 0.5)
    elif reasoning_info:
        fraction = EFFORT_FRACTION.get(reasoning_info.get("default_effort") or "", 0.5)
    else:
        fraction = 0.0
    # Round first so float noise (1 - 0.8 = 0.19999…) doesn't add a token.
    wanted = math.ceil(round(answer_budget / max(0.05, 1.0 - fraction), 6))
    if fraction > 0:
        wanted = max(wanted, math.ceil(round(MIN_REASONING_TOKENS / fraction, 6)))
    cap = min(MAX_TOKENS_CAP, int(model_cap) if model_cap else MAX_TOKENS_CAP)
    return max(answer_budget, min(wanted, cap))


def _content_text(content) -> str:
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(part.get("text", "") for part in content if isinstance(part, dict))
    return str(content)


def _error_detail(resp: httpx.Response) -> str:
    try:
        body = resp.json()
        err = body.get("error") if isinstance(body, dict) else None
        if isinstance(err, dict) and err.get("message"):
            return str(err["message"])[:300]
    except ValueError:
        pass
    return resp.text[:300]


def _sleep_for(attempt: int, retry_after: str | None) -> float:
    if retry_after:
        try:
            return min(60.0, max(0.5, float(retry_after)))
        except ValueError:
            pass
    return min(30.0, 2**attempt + random.uniform(0, 0.5))


def fetch_key_info(api_key: str) -> dict:
    """Validate a key for free via GET /api/v1/key (no generation, no cost)."""
    try:
        resp = http_client().get(KEY_URL, headers=anonymous_headers(api_key, json_body=False))
    except httpx.TransportError as e:
        raise OpenRouterError(f"Could not reach OpenRouter ({type(e).__name__}).") from e
    if resp.status_code != 200:
        raise OpenRouterError(
            f"OpenRouter rejected the key (HTTP {resp.status_code}): {_error_detail(resp)}",
            resp.status_code,
        )
    return (resp.json() or {}).get("data", {})


class OpenRouterClient:
    """LLM client with the `generate(prompt)` interface the ragureap approaches use."""

    def __init__(
        self,
        model: str,
        api_key: str,
        *,
        temperature: float = 0.0,
        max_output_tokens: int = 512,
        reasoning: str | None = "lowest",
        reasoning_info: dict | None = None,
        model_max_completion: int | None = None,
        seed: int | None = None,
        budget_ledger: BudgetLedger | None = None,
        price: Price | None = None,
        run_id: str | None = None,
        max_retries: int = 5,
    ):
        if not api_key:
            raise OpenRouterError("OpenRouter API key is missing.")
        self.model_name = model
        self.api_key = api_key
        self.temperature = float(temperature)
        self.answer_budget = int(max_output_tokens)
        self.reasoning_mode = reasoning or "lowest"
        self.effort = resolve_reasoning(self.reasoning_mode, reasoning_info)
        self.max_tokens = request_max_tokens(
            self.answer_budget, self.effort, reasoning_info, model_max_completion
        )
        self.seed = seed
        self.budget = budget_ledger
        self.price = price or Price(input_per_m=0.0, output_per_m=0.0)
        self.run_id = run_id
        self.max_retries = int(max_retries)
        self._stats_lock = threading.Lock()
        self.stats = {"llm_calls": 0, "reasoning_tokens": 0, "truncation_retries": 0}

    def payload(self, prompt: str, max_tokens: int | None = None) -> dict:
        body = {
            "model": self.model_name,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": self.temperature,
            "max_tokens": int(max_tokens or self.max_tokens),
        }
        if self.seed is not None:
            body["seed"] = int(self.seed)
        if self.effort is not None:
            body["reasoning"] = (
                {"effort": "none"} if self.effort == "none" else {"effort": self.effort, "exclude": True}
            )
        return body

    def _post(self, body: dict) -> tuple[dict, float]:
        last_error: OpenRouterError | None = None
        retry_after: str | None = None
        for attempt in range(self.max_retries + 1):
            if attempt:
                time.sleep(_sleep_for(attempt - 1, retry_after))
                retry_after = None
            started = time.perf_counter()
            try:
                resp = http_client().post(CHAT_URL, headers=anonymous_headers(self.api_key), json=body)
            except httpx.TransportError as e:
                last_error = OpenRouterError(f"Network error talking to OpenRouter ({type(e).__name__}).")
                continue
            latency_ms = (time.perf_counter() - started) * 1000.0

            if resp.status_code != 200:
                last_error = OpenRouterError(
                    f"OpenRouter HTTP {resp.status_code}: {_error_detail(resp)}", resp.status_code
                )
                if resp.status_code in RETRYABLE_STATUS:
                    retry_after = resp.headers.get("Retry-After")
                    continue
                raise last_error

            try:
                data = resp.json()
            except ValueError:
                last_error = OpenRouterError("OpenRouter returned a non-JSON response.")
                continue

            err = data.get("error") if isinstance(data, dict) else None
            choices = (data.get("choices") if isinstance(data, dict) else None) or []
            if err or (choices and choices[0].get("finish_reason") == "error"):
                code = err.get("code") if isinstance(err, dict) else None
                message = err.get("message") if isinstance(err, dict) else "generation error"
                last_error = OpenRouterError(
                    f"OpenRouter error {code if code is not None else ''}: {message}".replace("  ", " "),
                    code if isinstance(code, int) else None,
                )
                if code is None or (isinstance(code, int) and code in RETRYABLE_STATUS):
                    continue
                raise last_error
            if not choices:
                last_error = OpenRouterError("OpenRouter returned no choices.")
                continue
            return data, latency_ms
        raise last_error or OpenRouterError("OpenRouter request failed.")

    def generate(self, prompt: str) -> LLMResponse:
        if self.budget is not None:
            estimate = self.price.usd(max(1, len(prompt) // 4), self.max_tokens)
            self.budget.preflight(estimate, run_id=self.run_id)

        max_tokens = self.max_tokens
        tokens_in = tokens_out = reasoning_tokens = 0
        cost = latency = 0.0
        retries = 0
        while True:
            data, latency_ms = self._post(self.payload(prompt, max_tokens))
            choice = data["choices"][0]
            text = _content_text((choice.get("message") or {}).get("content")).strip()
            finish = choice.get("finish_reason")
            usage = data.get("usage") or {}
            call_in = int(usage.get("prompt_tokens") or 0)
            call_out = int(usage.get("completion_tokens") or 0)
            call_reasoning = int(((usage.get("completion_tokens_details") or {}).get("reasoning_tokens")) or 0)
            call_cost = usage.get("cost")
            call_cost = float(call_cost) if call_cost is not None else self.price.usd(call_in, call_out)

            tokens_in += call_in
            tokens_out += call_out
            reasoning_tokens += call_reasoning
            cost += call_cost
            latency += latency_ms
            if self.budget is not None:
                self.budget.record(
                    cost_usd=call_cost,
                    tokens_in=call_in,
                    tokens_out=call_out,
                    model=self.model_name,
                    run_id=self.run_id,
                    kind="generate",
                )

            if not text and finish == "length" and retries < 1 and max_tokens < MAX_TOKENS_CAP:
                retries += 1
                max_tokens = min(MAX_TOKENS_CAP, max_tokens * 2)
                continue
            break

        with self._stats_lock:
            self.stats["llm_calls"] += 1 + retries
            self.stats["reasoning_tokens"] += reasoning_tokens
            self.stats["truncation_retries"] += retries

        return LLMResponse(
            text=text,
            tokens_in=tokens_in,
            tokens_out=tokens_out,
            cost_usd=cost,
            latency_ms=latency,
            model=data.get("model") or self.model_name,
            reasoning_tokens=reasoning_tokens,
            finish_reason=finish,
            reasoning_effort=self.effort,
            max_tokens_sent=max_tokens,
            truncation_retries=retries,
            provider=data.get("provider"),
        )
