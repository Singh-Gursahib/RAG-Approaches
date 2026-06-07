"""RAG Atlas API — application entrypoint.

Run (from repo root, with the venv active):
    .venv/bin/uvicorn studio.server.app.main:app --reload --port 8000

Design rules enforced here:
  * CORS is restricted to the local Next.js dev origin.
  * The user's Gemini API key travels in the `X-Gemini-Key` header per request
    and is NEVER logged or persisted (see app/deps.py in Phase 2).
"""
from __future__ import annotations

import logging
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# ---------------------------------------------------------------------------
# Make the repo's `ragureap` package importable even when it is not pip-installed
# (defensive: the documented setup installs it editable, but a bare checkout
# should still boot). Repo root is three levels up: app/ -> server/ -> studio/ -> repo.
# ---------------------------------------------------------------------------
_REPO_ROOT = Path(__file__).resolve().parents[3]
_SRC = _REPO_ROOT / "src"
if _SRC.is_dir() and str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

from .routers import corpus, eval as eval_router, keys, meta, replay, run  # noqa: E402

logger = logging.getLogger("rag_atlas")

# Local Next.js dev origins.
_DEFAULT_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
ALLOWED_ORIGINS = (
    os.environ.get("RAG_ATLAS_CORS_ORIGINS", "").split(",")
    if os.environ.get("RAG_ATLAS_CORS_ORIGINS")
    else _DEFAULT_ORIGINS
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s  %(levelname)-7s %(name)s  %(message)s",
    )
    logger.info("RAG Atlas API starting up.")
    logger.info(
        "Note: local embedding + reranker models download on first use "
        "(~80MB MiniLM, ~1GB bge-reranker). First live run will be slow."
    )
    logger.info("Repo root: %s", _REPO_ROOT)
    yield
    logger.info("RAG Atlas API shutting down.")


app = FastAPI(
    title="RAG Atlas API",
    description="Live, model-agnostic comparison harness for RAG / non-RAG strategies.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(meta.router)
app.include_router(keys.router)
app.include_router(corpus.router)
app.include_router(run.router)
app.include_router(eval_router.router)
app.include_router(replay.router)


@app.get("/")
def root() -> dict:
    return {"service": "rag-atlas-api", "docs": "/docs", "health": "/health"}
