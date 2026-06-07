"""RAG Atlas — FastAPI backend.

A thin, model-agnostic web layer over the read-only `ragureap` research package.
It accepts a user-supplied Gemini API key per request (never persisted, never
logged), builds per-session indexes, runs the seven reference approaches live,
and streams traces + cost over SSE.
"""

__version__ = "0.1.0"
