"""Price resolution. Wraps ragureap.eval.cost.Price with optional overrides so
users can model their own provider tier without changing the framework defaults.
"""
from __future__ import annotations

from ragureap.eval.cost import (
    DEFAULT_PRICE_INPUT_PER_M,
    DEFAULT_PRICE_OUTPUT_PER_M,
    Price,
)


def resolve_price(input_per_m: float | None = None, output_per_m: float | None = None) -> Price:
    return Price(
        input_per_m=float(input_per_m) if input_per_m is not None else DEFAULT_PRICE_INPUT_PER_M,
        output_per_m=float(output_per_m) if output_per_m is not None else DEFAULT_PRICE_OUTPUT_PER_M,
    )


def default_price_dict() -> dict:
    return {
        "input_per_m": DEFAULT_PRICE_INPUT_PER_M,
        "output_per_m": DEFAULT_PRICE_OUTPUT_PER_M,
        "currency": "USD",
        "note": (
            "Defaults match a Gemini Flash-tier estimate. Override per request to "
            "model your own provider's pricing; over-estimating only triggers the "
            "budget guard earlier."
        ),
    }
