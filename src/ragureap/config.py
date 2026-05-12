"""Configuration loader: pydantic-settings + YAML overlay.

Hierarchy: defaults < base.yaml < approach YAML < env vars.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Project-wide settings. Env vars (prefixed `RAGUREAP_`) override YAML."""

    google_api_key: str = Field(default="", description="Gemini API key. From .env as GOOGLE_API_KEY.")
    llm_model: str = Field(default="gemini-3-flash-preview", description="Generation model.")
    embedding_model: str = Field(default="sentence-transformers/all-MiniLM-L6-v2")
    reranker_model: str = Field(default="BAAI/bge-reranker-base")
    budget_cap_usd: float = Field(default=5.0, description="Hard project-wide spend cap.")
    runs_dir: Path = Field(default=Path("runs"))
    data_dir: Path = Field(default=Path("data"))
    eval_corpus_dir: Path = Field(default=Path("data/eval_corpus"))
    eval_set_path: Path = Field(default=Path("tests/eval_set.jsonl"))

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_prefix="",  # allow GOOGLE_API_KEY directly
        extra="ignore",
    )


def load_yaml(path: str | Path) -> dict[str, Any]:
    """Load a YAML file into a dict."""
    with open(path, "r", encoding="utf-8") as fh:
        return yaml.safe_load(fh) or {}


def load_settings() -> Settings:
    """Return resolved settings (env + .env)."""
    return Settings()
