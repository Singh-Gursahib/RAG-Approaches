"""Corpus preview + session creation (no API key required — pure ingestion)."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..schemas import (
    ChunkPreview,
    CorpusPreviewRequest,
    CorpusPreviewResponse,
    CorpusStats,
    DocStat,
    SessionCreateRequest,
    SessionCreateResponse,
)
from ..sessions import STORE, Session

router = APIRouter(tags=["corpus"])

_SAMPLE_CHUNKS = 6


def _stats(session: Session) -> CorpusStats:
    docs = [
        DocStat(doc_id=d.doc_id, words=len(d.text.split()), chars=len(d.text))
        for d in session.documents
    ]
    total_words = sum(d.words for d in docs)
    return CorpusStats(
        n_docs=len(docs),
        n_chunks=len(session.chunks),
        total_words=total_words,
        total_chars=sum(d.chars for d in docs),
        est_tokens=total_words,  # whitespace-word count ≈ token proxy (same as ragureap)
        documents=docs,
    )


def _sample(session: Session, n: int = _SAMPLE_CHUNKS) -> list[ChunkPreview]:
    out = []
    for c in session.chunks[:n]:
        out.append(
            ChunkPreview(
                chunk_id=c.chunk_id,
                doc_id=c.doc_id,
                idx=c.idx,
                n_tokens=c.n_tokens,
                text=c.text if len(c.text) <= 600 else c.text[:600] + "…",
            )
        )
    return out


@router.post("/corpus/preview", response_model=CorpusPreviewResponse)
def corpus_preview(req: CorpusPreviewRequest) -> CorpusPreviewResponse:
    """Stateless chunk preview — lets the UI teach chunking live without a session."""
    try:
        session = STORE.create(
            [(d.doc_id, d.text) for d in req.documents],
            req.chunking.model_dump(),
        )
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=422, detail={"message": str(e)})
    resp = CorpusPreviewResponse(stats=_stats(session), sample_chunks=_sample(session))
    STORE.delete(session.session_id)  # ephemeral preview
    return resp


@router.post("/session", response_model=SessionCreateResponse)
def create_session(req: SessionCreateRequest) -> SessionCreateResponse:
    try:
        session = STORE.create(
            [(d.doc_id, d.text) for d in req.documents],
            req.chunking.model_dump(),
        )
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=422, detail={"message": str(e)})
    return SessionCreateResponse(
        session_id=session.session_id,
        stats=_stats(session),
        sample_chunks=_sample(session),
    )


@router.delete("/session/{session_id}")
def delete_session(session_id: str) -> dict:
    return {"deleted": STORE.delete(session_id)}
