"""OpenRouter client: anonymity, request shape, reasoning, cost, retries (no network)."""
from __future__ import annotations

import json

import httpx
import pytest

from studio.server.app import openrouter
from studio.server.app.openrouter import (
    CHAT_URL,
    OpenRouterClient,
    OpenRouterError,
    anonymous_headers,
    request_max_tokens,
    resolve_reasoning,
)
from ragureap.eval.cost import Price

GLM = {"mandatory": True, "default_enabled": True, "supported_efforts": ["max", "high", "low"], "default_effort": "max"}
GEMINI_3_FLASH = {"mandatory": False, "supported_efforts": ["high", "medium", "low", "minimal"], "default_effort": "medium"}
ATTRIBUTION_HEADERS = {
    "http-referer",
    "referer",
    "origin",
    "x-openrouter-title",
    "x-title",
    "x-openrouter-categories",
    "x-openrouter-app-visibility",
}


def completion(content="MULBERRY-7Q", finish="stop", cost=0.00001, reasoning=7, include_cost=True):
    usage = {
        "prompt_tokens": 120,
        "completion_tokens": 20,
        "completion_tokens_details": {"reasoning_tokens": reasoning},
    }
    if include_cost:
        usage["cost"] = cost
    return {
        "id": "gen-1",
        "model": "z-ai/glm-5.3-flash",
        "provider": "Z.ai",
        "choices": [{"message": {"role": "assistant", "content": content}, "finish_reason": finish}],
        "usage": usage,
    }


@pytest.fixture
def mock_http(monkeypatch):
    requests: list[httpx.Request] = []
    queue: list[httpx.Response] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return queue.pop(0)

    client = httpx.Client(transport=httpx.MockTransport(handler))
    monkeypatch.setattr(openrouter, "http_client", lambda: client)
    monkeypatch.setattr(openrouter, "_sleep_for", lambda attempt, retry_after: 0.0)
    return requests, queue


def test_anonymous_headers_are_only_credentials_and_content_type():
    assert {k.lower() for k in anonymous_headers("sk-x")} == {"authorization", "content-type"}
    assert {k.lower() for k in anonymous_headers("sk-x", json_body=False)} == {"authorization"}


def test_request_carries_no_attribution(mock_http):
    requests, queue = mock_http
    queue.append(httpx.Response(200, json=completion()))
    client = OpenRouterClient("z-ai/glm-5.3-flash", "sk-test", reasoning="lowest", reasoning_info=GLM, seed=1, temperature=0.3)
    resp = client.generate("What is the password?")

    request = requests[0]
    assert str(request.url) == CHAT_URL
    assert not ({k.lower() for k in request.headers} & ATTRIBUTION_HEADERS)
    body = json.loads(request.content)
    assert set(body) == {"model", "messages", "temperature", "max_tokens", "seed", "reasoning"}
    assert body["reasoning"] == {"effort": "low", "exclude": True}
    assert body["temperature"] == 0.3 and body["seed"] == 1
    assert resp.text == "MULBERRY-7Q"
    assert resp.cost_usd == 0.00001
    assert resp.reasoning_tokens == 7
    assert (resp.tokens_in, resp.tokens_out) == (120, 20)


def test_resolve_reasoning_modes():
    assert resolve_reasoning("lowest", GLM) == "low"  # GLM can't disable reasoning
    assert resolve_reasoning("lowest", GEMINI_3_FLASH) == "none"  # Gemini 3 Flash can
    assert resolve_reasoning("lowest", None) is None  # non-reasoning model: omit
    assert resolve_reasoning("default", GLM) is None
    assert resolve_reasoning("none", GLM) == "low"
    assert resolve_reasoning("high", GLM) == "high"


def test_max_tokens_protects_the_answer_budget():
    assert request_max_tokens(512, "none", GEMINI_3_FLASH) == 512
    assert request_max_tokens(512, None, GLM) == 10240  # GLM default effort is "max"
    assert request_max_tokens(512, None, None) == 512
    assert request_max_tokens(512, "high", GLM) == 2560  # 80% reasoning, 512 left for the answer
    assert request_max_tokens(512, "max", GLM, model_cap=1000) == 1000


def test_max_tokens_leaves_room_to_reason():
    # Low effort reserves 20%; 640 tokens left GLM only 128 to think and it failed on
    # long prompts. The limit now leaves at least MIN_REASONING_TOKENS for reasoning.
    for effort, info in (("low", GLM), ("minimal", GEMINI_3_FLASH), ("medium", GEMINI_3_FLASH)):
        limit = request_max_tokens(512, effort, info)
        reasoning_share = limit * openrouter.EFFORT_FRACTION[effort]
        assert reasoning_share >= openrouter.MIN_REASONING_TOKENS - 1
        assert limit - reasoning_share >= 512
    assert request_max_tokens(512, "low", GLM) == 5120


def test_empty_truncated_answer_is_retried_once(mock_http):
    requests, queue = mock_http
    queue.append(httpx.Response(200, json=completion(content="", finish="length")))
    queue.append(httpx.Response(200, json=completion()))
    client = OpenRouterClient("z-ai/glm-5.3-flash", "sk-test", reasoning="lowest", reasoning_info=GLM)
    resp = client.generate("Q")

    assert resp.text == "MULBERRY-7Q"
    first, second = (json.loads(r.content)["max_tokens"] for r in requests)
    assert second == 2 * first
    assert resp.truncation_retries == 1
    assert resp.cost_usd == pytest.approx(0.00002)  # both calls are charged and recorded
    assert client.stats == {"llm_calls": 2, "reasoning_tokens": 14, "truncation_retries": 1}


def test_rate_limit_is_retried(mock_http):
    requests, queue = mock_http
    queue.append(httpx.Response(429, json={"error": {"code": 429, "message": "slow down"}}, headers={"Retry-After": "1"}))
    queue.append(httpx.Response(200, json=completion()))
    resp = OpenRouterClient("z-ai/glm-5.3-flash", "sk-test").generate("Q")
    assert resp.text == "MULBERRY-7Q"
    assert len(requests) == 2


def test_auth_error_is_not_retried(mock_http):
    requests, queue = mock_http
    queue.append(httpx.Response(401, json={"error": {"code": 401, "message": "No auth credentials found"}}))
    with pytest.raises(OpenRouterError, match="401"):
        OpenRouterClient("z-ai/glm-5.3-flash", "sk-test").generate("Q")
    assert len(requests) == 1


def test_cost_falls_back_to_list_price_when_missing(mock_http):
    _, queue = mock_http
    queue.append(httpx.Response(200, json=completion(include_cost=False)))
    client = OpenRouterClient("z-ai/glm-5.3-flash", "sk-test", price=Price(input_per_m=0.15, output_per_m=0.5))
    resp = client.generate("Q")
    assert resp.cost_usd == pytest.approx(120 * 0.15e-6 + 20 * 0.5e-6)
