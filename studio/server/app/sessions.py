"""Session store + per-(session, approach) index cache.

A session holds a user's corpus: the uploaded documents are materialized to a
private temp directory (so the file-reading approaches — recursive_summary and
sliding_window — work via ragureap.load_corpus unchanged), chunked once, and
kept in memory. Built approach instances (which carry the embedded Chroma /
BM25 / reranker indexes) are cached so repeat questions don't re-embed.

In-memory, single-process, LRU + TTL bounded. Local-first; not a clustered store.
"""
from __future__ import annotations

import re
import shutil
import tempfile
import threading
import time
import uuid
from collections import OrderedDict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from ragureap.data.corpus import Document, chunk_corpus, load_corpus
from ragureap.data.chunk import Chunk

MAX_SESSIONS = 24
SESSION_TTL_S = 60 * 60  # 1 hour idle eviction
_SAFE = re.compile(r"[^a-zA-Z0-9_-]+")


def _safe_stem(doc_id: str) -> str:
    s = _SAFE.sub("-", doc_id.strip()).strip("-")
    return s or "doc"


@dataclass
class Session:
    session_id: str
    tmp_dir: Path
    documents: list[Document]
    chunks: list[Chunk]
    full_text: str
    chunk_cfg: dict
    created_at: float
    last_used: float
    # Cache of built approach instances, keyed by (approach, retrieval-signature).
    _approach_cache: dict[str, Any] = field(default_factory=dict)
    lock: threading.Lock = field(default_factory=threading.Lock)

    @property
    def chunk_by_id(self) -> dict[str, Chunk]:
        return {c.chunk_id: c for c in self.chunks}

    def touch(self) -> None:
        self.last_used = time.time()


class SessionStore:
    def __init__(self, max_sessions: int = MAX_SESSIONS, ttl_s: int = SESSION_TTL_S):
        self._sessions: "OrderedDict[str, Session]" = OrderedDict()
        self._lock = threading.Lock()
        self.max_sessions = max_sessions
        self.ttl_s = ttl_s

    # --- lifecycle -------------------------------------------------------

    def create(self, documents: list[tuple[str | None, str]], chunk_cfg: dict) -> Session:
        """documents: list of (doc_id_or_None, text). Materialize + chunk."""
        self._evict_expired()
        session_id = uuid.uuid4().hex[:12]
        tmp_dir = Path(tempfile.mkdtemp(prefix=f"ragatlas_{session_id}_"))

        seen: set[str] = set()
        for i, (doc_id, text) in enumerate(documents):
            stem = _safe_stem(doc_id) if doc_id else f"doc_{i + 1:02d}"
            # Ensure uniqueness + stable sort order matching input order.
            fname = f"{i:03d}_{stem}.txt"
            (tmp_dir / fname).write_text(text, encoding="utf-8")
            seen.add(fname)

        # Re-read via load_corpus so the session's docs/ids are byte-identical to
        # what recursive_summary/sliding_window see when they call load_corpus().
        docs = load_corpus(tmp_dir)
        chunks = chunk_corpus(
            docs,
            target_tokens=int(chunk_cfg["target_tokens"]),
            overlap_tokens=int(chunk_cfg["overlap_tokens"]),
        )
        full_text = "\n\n".join(d.text for d in docs)

        now = time.time()
        session = Session(
            session_id=session_id,
            tmp_dir=tmp_dir,
            documents=docs,
            chunks=chunks,
            full_text=full_text,
            chunk_cfg=dict(chunk_cfg),
            created_at=now,
            last_used=now,
        )
        with self._lock:
            self._sessions[session_id] = session
            self._sessions.move_to_end(session_id)
            self._evict_over_capacity_locked()
        return session

    def get(self, session_id: str) -> Session | None:
        with self._lock:
            session = self._sessions.get(session_id)
            if session is None:
                return None
            if time.time() - session.last_used > self.ttl_s:
                self._drop_locked(session_id)
                return None
            session.touch()
            self._sessions.move_to_end(session_id)
            return session

    def delete(self, session_id: str) -> bool:
        with self._lock:
            if session_id in self._sessions:
                self._drop_locked(session_id)
                return True
        return False

    # --- eviction --------------------------------------------------------

    def _drop_locked(self, session_id: str) -> None:
        session = self._sessions.pop(session_id, None)
        if session is not None:
            shutil.rmtree(session.tmp_dir, ignore_errors=True)

    def _evict_over_capacity_locked(self) -> None:
        while len(self._sessions) > self.max_sessions:
            oldest, _ = next(iter(self._sessions.items()))
            self._drop_locked(oldest)

    def _evict_expired(self) -> None:
        now = time.time()
        with self._lock:
            stale = [
                sid
                for sid, s in self._sessions.items()
                if now - s.last_used > self.ttl_s
            ]
            for sid in stale:
                self._drop_locked(sid)


# Process-wide singleton.
STORE = SessionStore()
