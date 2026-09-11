"""RAG Atlas — FastAPI backend.

A thin, model-agnostic web layer over the read-only `ragureap` research package.
It accepts a user-supplied OpenRouter API key per request (never persisted, never
logged), calls any OpenRouter model without app-attribution headers, builds
per-session indexes, runs the seven reference approaches live, streams traces +
cost over SSE, and saves finished tests as JSON results that can be reopened.
"""

__version__ = "0.2.0"
