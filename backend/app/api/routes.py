"""HTTP routes. Thin layer: validation is in schemas, maths in services."""

from __future__ import annotations

import copy
import logging

from fastapi import APIRouter
from starlette.concurrency import run_in_threadpool

from app.schemas.requests import AnalysisRequest
from app.schemas.responses import AircraftProfilesResponse, AnalysisResponse, ErrorResponse
from app.services import explanation_service as text
from app.services.analysis_service import DEMO_SCENARIO, run_analysis

logger = logging.getLogger("skytrace.api")

router = APIRouter(prefix="/api/v1", tags=["analysis"])

_ERRORS = {
    422: {"model": ErrorResponse, "description": "Validation, projection or geometry error"},
    500: {"model": ErrorResponse, "description": "Internal error"},
}


@router.get("/aircraft-profiles", response_model=AircraftProfilesResponse, summary="Generic demo aircraft categories")
async def aircraft_profiles() -> dict:
    return {
        "note": text.AIRCRAFT_PROFILES_NOTE,
        "affects_calculations": False,
        "profiles": copy.deepcopy(text.AIRCRAFT_PROFILES),
    }


@router.get("/demo-scenario", summary="A complete, valid over-water example request (Bay of Bengal)")
async def demo_scenario() -> dict:
    return copy.deepcopy(DEMO_SCENARIO)


@router.post(
    "/analyze",
    response_model=AnalysisResponse,
    responses=_ERRORS,
    summary="Compute an illustrative search-area sketch",
)
async def analyze(request: AnalysisRequest) -> dict:
    # Geometry work is CPU-bound (tens of ms up to ~150 ms for large grids), so it
    # runs in the threadpool to keep the event loop responsive.
    result = await run_in_threadpool(run_analysis, request)
    logger.info(
        "analysis complete id=%s distance_nm=%s scenarios=%d cells=%d",
        result["analysis_id"],
        result["baseline"]["distance_nm"],
        len(result["scenarios"]),
        len(result["grid"]["cells"]),
    )
    return result


@router.get("/methodology", summary="Maths, assumptions and limitations")
async def methodology() -> dict:
    return text.methodology()
