"""Price resolution for estimates and fallbacks.

Live runs record the cost OpenRouter reports for each call. The prices here feed
pre-flight estimates, the Profiler's defaults, and the rare response that carries
no cost.
"""
from __future__ import annotations

from ragureap.eval.cost import (
    DEFAULT_PRICE_INPUT_PER_M,
    DEFAULT_PRICE_OUTPUT_PER_M,
    Price,
)

from .models_catalog import DEFAULT_MODEL, get_model_info


def resolve_price(input_per_m: float | None = None, output_per_m: float | None = None) -> Price:
    return Price(
        input_per_m=float(input_per_m) if input_per_m is not None else DEFAULT_PRICE_INPUT_PER_M,
        output_per_m=float(output_per_m) if output_per_m is not None else DEFAULT_PRICE_OUTPUT_PER_M,
    )


def default_price_dict(model_id: str | None = None) -> dict:
    model = model_id or DEFAULT_MODEL
    info = get_model_info(model)
    known = info.get("input_per_m") is not None and info.get("output_per_m") is not None
    return {
        "model": model,
        "input_per_m": info["input_per_m"] if known else DEFAULT_PRICE_INPUT_PER_M,
        "output_per_m": info["output_per_m"] if known else DEFAULT_PRICE_OUTPUT_PER_M,
        "currency": "USD",
        "source": info.get("source") if known else "fallback",
        "note": (
            "OpenRouter list price per 1M tokens. Runs record the actual cost OpenRouter "
            "reports for every call."
            if known
            else "Price unknown for this model; showing a generic flash-tier estimate."
        ),
    }
