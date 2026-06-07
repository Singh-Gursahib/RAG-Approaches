"""Corpus preview + session creation (no key, no spend)."""
from __future__ import annotations

DOCS = {
    "documents": [
        {"doc_id": "alpha", "text": "The hidden token is MULBERRY-7Q. " * 20},
        {"doc_id": "beta", "text": "Veridian was founded in 1991. " * 20},
    ],
    "chunking": {"target_tokens": 60, "overlap_tokens": 10},
}


def test_corpus_preview(client):
    r = client.post("/corpus/preview", json=DOCS)
    assert r.status_code == 200
    body = r.json()
    assert body["stats"]["n_docs"] == 2
    assert body["stats"]["n_chunks"] > 0
    assert body["stats"]["total_words"] > 0
    assert len(body["sample_chunks"]) > 0
    assert body["sample_chunks"][0]["text"]


def test_chunking_responds_to_config(client):
    small = client.post(
        "/corpus/preview",
        json={**DOCS, "chunking": {"target_tokens": 30, "overlap_tokens": 5}},
    ).json()["stats"]["n_chunks"]
    big = client.post(
        "/corpus/preview",
        json={**DOCS, "chunking": {"target_tokens": 200, "overlap_tokens": 10}},
    ).json()["stats"]["n_chunks"]
    assert small >= big  # smaller target → at least as many chunks


def test_overlap_must_be_less_than_target(client):
    r = client.post(
        "/corpus/preview",
        json={**DOCS, "chunking": {"target_tokens": 50, "overlap_tokens": 50}},
    )
    assert r.status_code == 422


def test_session_create_and_delete(client):
    r = client.post("/session", json=DOCS)
    assert r.status_code == 200
    sid = r.json()["session_id"]
    assert sid
    d = client.delete(f"/session/{sid}")
    assert d.json()["deleted"] is True
