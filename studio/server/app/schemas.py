"""Pydantic request/response models for the RAG Atlas API.

Kept in sync with studio/web/lib/types.ts on the frontend.
"""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

from .catalog import APPROACH_KEYS
from .models_catalog import DEFAULT_MODEL

ProbeType = Literal["needle", "multi_hop", "distractor", "hallucination", "sanity"]
ReasoningMode = Literal["lowest", "default", "none", "minimal", "low", "medium", "high", "max"]

# OpenRouter model slugs, e.g. "z-ai/glm-5.3-flash", "~google/gemini-flash-latest",
# "google/gemini-3.8-flash:batch".
MODEL_SLUG_PATTERN = r"^~?[A-Za-z0-9][A-Za-z0-9._-]*/[A-Za-z0-9][A-Za-z0-9._:+-]*$"


def _known_approaches(values: list[str] | None) -> list[str] | None:
    if values is None:
        return values
    unknown = [a for a in values if a not in APPROACH_KEYS]
    if unknown:
        raise ValueError(f"Unknown approaches: {unknown}. Known: {APPROACH_KEYS}")
    return values


# --- config blocks -------------------------------------------------------

class ChunkConfig(BaseModel):
    target_tokens: int = Field(150, ge=20, le=2000)
    overlap_tokens: int = Field(30, ge=0, le=500)

    @field_validator("overlap_tokens")
    @classmethod
    def _overlap_lt_target(cls, v, info):
        target = info.data.get("target_tokens", 150)
        if v >= target:
            raise ValueError("overlap_tokens must be < target_tokens")
        return v


class RetrievalConfig(BaseModel):
    top_k: int = Field(5, ge=1, le=50)
    top_n_for_rerank: int = Field(20, ge=1, le=100)


class LLMConfig(BaseModel):
    model: str = Field(DEFAULT_MODEL, pattern=MODEL_SLUG_PATTERN, max_length=200)
    temperature: float = Field(0.0, ge=0.0, le=2.0)
    max_output_tokens: int = Field(512, ge=16, le=8192)
    reasoning: ReasoningMode = "lowest"
    seed: Optional[int] = Field(default=None, ge=0, le=2_147_483_647)


class PriceConfig(BaseModel):
    """Optional per-million-token price overrides for cost modelling."""

    input_per_m: Optional[float] = Field(default=None, ge=0)
    output_per_m: Optional[float] = Field(default=None, ge=0)


class DocIn(BaseModel):
    doc_id: Optional[str] = None
    text: str = Field(..., min_length=1)


# --- corpus / session ----------------------------------------------------

class CorpusPreviewRequest(BaseModel):
    documents: list[DocIn] = Field(..., min_length=1)
    chunking: ChunkConfig = ChunkConfig()


class ChunkPreview(BaseModel):
    chunk_id: str
    doc_id: str
    idx: int
    n_tokens: int
    text: str


class DocStat(BaseModel):
    doc_id: str
    words: int
    chars: int


class CorpusStats(BaseModel):
    n_docs: int
    n_chunks: int
    total_words: int
    total_chars: int
    est_tokens: int
    documents: list[DocStat]


class CorpusPreviewResponse(BaseModel):
    stats: CorpusStats
    sample_chunks: list[ChunkPreview]


class SessionCreateRequest(BaseModel):
    documents: list[DocIn] = Field(..., min_length=1)
    chunking: ChunkConfig = ChunkConfig()


class SessionCreateResponse(BaseModel):
    session_id: str
    stats: CorpusStats
    sample_chunks: list[ChunkPreview]


# --- run (single question) ----------------------------------------------

class RunRequest(BaseModel):
    session_id: str
    question: str = Field(..., min_length=1)
    approaches: list[str] = Field(..., min_length=1)
    retrieval: RetrievalConfig = RetrievalConfig()
    llm: LLMConfig = LLMConfig()
    price: PriceConfig = PriceConfig()
    soft_cap_usd: Optional[float] = Field(default=None, ge=0)

    _check_approaches = field_validator("approaches")(classmethod(lambda cls, v: _known_approaches(v)))


# --- eval ----------------------------------------------------------------

class EvalQuestionIn(BaseModel):
    id: Optional[str] = None
    type: Optional[ProbeType] = None
    question: str = Field(..., min_length=1)
    gold_answer: str = Field(..., min_length=1)


class EvalRequest(BaseModel):
    session_id: str
    questions: list[EvalQuestionIn] = Field(..., min_length=1, max_length=200)
    approaches: list[str] = Field(..., min_length=1)
    retrieval: RetrievalConfig = RetrievalConfig()
    llm: LLMConfig = LLMConfig()
    price: PriceConfig = PriceConfig()
    soft_cap_usd: Optional[float] = Field(default=None, ge=0)
    repeats: int = Field(1, ge=1, le=5)
    label: Optional[str] = Field(default=None, max_length=120)

    _check_approaches = field_validator("approaches")(classmethod(lambda cls, v: _known_approaches(v)))


class ReplayRunRequest(BaseModel):
    approaches: Optional[list[str]] = None
    llm: LLMConfig = Field(default_factory=lambda: LLMConfig(temperature=0.3))
    repeats: int = Field(1, ge=1, le=5)
    soft_cap_usd: Optional[float] = Field(default=None, gt=0)

    _check_approaches = field_validator("approaches")(classmethod(lambda cls, v: _known_approaches(v)))


class EstimateRequest(BaseModel):
    """Pre-flight cost estimate: no key, no spend."""

    n_questions: int = Field(..., ge=1, le=2000)
    approaches: list[str] = Field(..., min_length=1)
    corpus_tokens: int = Field(..., ge=0)
    n_docs: int = Field(1, ge=1)
    retrieval: RetrievalConfig = RetrievalConfig()
    llm: LLMConfig = LLMConfig()
    price: PriceConfig = PriceConfig()
    repeats: int = Field(1, ge=1, le=5)


class ApproachEstimate(BaseModel):
    approach: str
    llm_calls: int
    est_tokens_in: int
    est_tokens_out: int
    est_cost_usd: float


class EstimateResponse(BaseModel):
    per_approach: list[ApproachEstimate]
    total_llm_calls: int
    total_cost_usd: float
    note: str
