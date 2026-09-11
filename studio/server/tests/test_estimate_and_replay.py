"""Pre-flight cost estimate, replay metadata, model catalog, pricing (no key, no spend)."""
from __future__ import annotations

from ragureap.indexing.chroma_store import ChromaStore

CURATED = {
    "google/gemini-3-flash-preview",
    "google/gemini-3.7-flash",
    "google/gemini-3.8-flash",
    "z-ai/glm-5.3-flash",
    "deepseek/deepseek-v4.1-flash",
}


def test_estimate_monotonic_in_questions(client):
    base = {"approaches": ["naive", "full_context"], "corpus_tokens": 8000, "n_docs": 4}
    small = client.post("/eval/estimate", json={**base, "n_questions": 10}).json()
    big = client.post("/eval/estimate", json={**base, "n_questions": 100}).json()
    assert big["total_cost_usd"] > small["total_cost_usd"]
    assert big["total_llm_calls"] > small["total_llm_calls"]


def test_estimate_scales_with_repeats(client):
    base = {"approaches": ["naive"], "corpus_tokens": 8000, "n_docs": 4, "n_questions": 10}
    once = client.post("/eval/estimate", json=base).json()
    thrice = client.post("/eval/estimate", json={**base, "repeats": 3}).json()
    assert thrice["total_llm_calls"] == 3 * once["total_llm_calls"]


def test_estimate_uses_model_price(client):
    base = {"approaches": ["full_context"], "corpus_tokens": 8000, "n_docs": 4, "n_questions": 10}
    glm = client.post("/eval/estimate", json={**base, "llm": {"model": "z-ai/glm-5.3-flash"}}).json()
    gemini = client.post("/eval/estimate", json={**base, "llm": {"model": "google/gemini-3.8-flash"}}).json()
    assert glm["total_cost_usd"] < gemini["total_cost_usd"]


def test_estimate_full_context_costlier_than_naive(client):
    r = client.post(
        "/eval/estimate",
        json={"n_questions": 20, "approaches": ["naive", "full_context"], "corpus_tokens": 8000, "n_docs": 4},
    ).json()
    by = {a["approach"]: a for a in r["per_approach"]}
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
    assert body["paper_model"] == "google/gemini-3-flash-preview"
    assert body["paper_settings"] == {"temperature": 0.3, "repeats": 3, "answer_token_budget": 512}


def test_replay_subset_saves_labelled_result(client, patched_service):
    from .conftest import KEY_HEADER, parse_sse

    r = client.post(
        "/replay/run",
        json={
            "approaches": ["full_context"],
            "llm": {"model": "z-ai/glm-5.3-flash", "temperature": 0.3, "reasoning": "high"},
            "repeats": 1,
            "soft_cap_usd": 0.2,
        },
        headers={KEY_HEADER: "sk-or-v1-TEST"},
    )
    done = parse_sse(r.text)[-1]
    saved = client.get(f"/results/{done['saved_result_id']}").json()
    assert saved["label"] == "GLM 5.3 Flash · paper case study · 1 run · Full-Context · high reasoning"
    assert saved["config"]["reasoning_effort_sent"] == "high"
    assert saved["config"]["max_tokens_sent"] == 2560
    assert saved["dataset"]["n_questions"] == 34


def test_approaches_catalog(client):
    body = client.get("/approaches").json()
    keys = [a["key"] for a in body["approaches"]]
    assert set(keys) == {
        "naive", "hybrid", "hyde", "rerank",
        "full_context", "recursive_summary", "sliding_window",
    }


def test_models_catalog_offline_snapshot(client):
    body = client.get("/models").json()
    assert body["default"] == "google/gemini-3-flash-preview"
    models = {m["id"]: m for m in body["models"]}
    assert set(models) == CURATED
    glm = models["z-ai/glm-5.3-flash"]
    assert glm["source"] == "snapshot"
    assert glm["input_per_m"] == 0.15 and glm["output_per_m"] == 0.5
    assert glm["open_weights"] is True
    assert models["google/gemini-3.8-flash"]["open_weights"] is False
    assert models["google/gemini-3-flash-preview"]["paper_model"] is True


def test_model_lookup_unknown_slug_offline(client):
    body = client.get("/models/lookup", params={"id": "acme/unknown-model"}).json()
    assert body["found"] is None and body["source"] == "unknown"


def test_pricing_for_model(client):
    assert client.get("/pricing").json()["input_per_m"] == 0.5
    glm = client.get("/pricing", params={"model": "z-ai/glm-5.3-flash"}).json()
    assert glm["input_per_m"] == 0.15 and glm["output_per_m"] == 0.5


def test_chroma_stores_get_isolated_collections():
    a = ChromaStore(embedder=object())
    b = ChromaStore(embedder=object())
    assert a.collection_name != b.collection_name
    assert "ragureap" not in (a.collection_name, b.collection_name)
    assert ChromaStore(embedder=object(), collection_name="custom").collection_name == "custom"
