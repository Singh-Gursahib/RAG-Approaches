"""Saved test results: list them, and load one back exactly as it ran."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from .. import results_store

router = APIRouter(tags=["results"])


@router.get("/results")
def list_saved() -> dict:
    return {"results": results_store.list_results()}


@router.get("/results/{result_id}")
def get_saved(result_id: str) -> dict:
    payload = results_store.load_result(result_id)
    if payload is None:
        raise HTTPException(
            status_code=404,
            detail={"message": "No saved result with that id.", "code": "not_found"},
        )
    return payload
