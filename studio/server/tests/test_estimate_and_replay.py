"""Pre-flight cost estimate + replay metadata (no key, no spend)."""
from __future__ import annotations


def test_estimate_monotonic_in_questions(client):
    base = {
        "approaches": ["naive", "full_context"],
        "corpus_tokens": 8000,
        "n_docs": 4,
    }
    small = client.post("/eval/estimate", json={**base, "n_questions": 10}).json()
    big = client.post("/eval/estimate", json={**base, "n_questions": 100}).json()
    assert big["total_cost_usd"] > small["total_cost_usd"]
    assert big["total_llm_calls"] > small["total_llm_calls"]


def test_estimate_full_context_costlier_than_naive(client):
    r = client.post(
        "/eval/estimate",
        json={"n_questions": 20, "approaches": ["naive", "full_context"], "corpus_tokens": 8000, "n_docs": 4},
    ).json()
    by = {a["approach"]: a for a in r["per_approach"]}
    # full_context stuffs the whole corpus every question → far more input tokens.
    assert by["full_context"]["est_tokens_in"] > by["naive"]["est_tokens_in"]


def test_estimate_sliding_window_calls_scale_with_docs(client):
    r = client.post(
        "/eval/estimate",
        json={"n_questions": 5, "approaches": ["sliding_window"], "corpus_tokens": 8000, "n_docs": 4},
    ).json()
    assert r["per_approach"][0]["llm_calls"] == 5 * 4


def test_replay_meta_loads_bundled_assets(client):
    r = client.get("/replay/meta")
    assert r.status_code == 200
    body = r.json()
    assert body["corpus"]["n_docs"] >= 1
    assert body["eval_set"]["n_questions"] >= 1
    assert len(body["paper_headline"]) == 7


def test_approaches_catalog(client):
    body = client.get("/approaches").json()
    keys = [a["key"] for a in body["approaches"]]
    assert set(keys) == {
        "naive", "hybrid", "hyde", "rerank",
        "full_context", "recursive_summary", "sliding_window",
    }


def test_pricing_defaults(client):
    body = client.get("/pricing").json()
    assert body["input_per_m"] > 0
    assert body["output_per_m"] > 0
