"""Orchestrates one analysis: projection -> scenarios -> region -> grid -> text."""

from __future__ import annotations

import json
import uuid

from app.core import constants as C
from app.schemas.requests import AnalysisRequest
from app.services import explanation_service as text
from app.services.coordinate_service import LocalProjection
from app.services.grid_service import build_grid
from app.services.scenario_service import build_scenarios
from app.services.search_region_service import build_search_region

# Over-water demo: central Bay of Bengal, tracking south-south-east.
DEMO_SCENARIO = {
    "last_known_position": {"latitude": 13.8, "longitude": 86.5},
    "heading_degrees": 160.0,
    "ground_speed_knots": 220.0,
    "elapsed_minutes": 50.0,
    "wind": {"speed_knots": 18.0, "direction_from_degrees": 240.0},
    "aircraft_type": "generic_turboprop",
    "fuel_remaining_percent": 40.0,
    "position_uncertainty_nm": 5.0,
    "heading_uncertainty_degrees": 10.0,
    "grid_size": 7,
    "search_region_buffer_nm": 10.0,
}

_UNITS = {
    "last_known_position": "decimal degrees (WGS84)",
    "heading_degrees": "degrees true, clockwise from north (treated as ground track)",
    "ground_speed_knots": "knots (ground speed)",
    "elapsed_minutes": "minutes",
    "wind": "knots / degrees true (direction FROM)",
    "aircraft_type": "generic demo category",
    "fuel_remaining_percent": "percent",
    "position_uncertainty_nm": "nautical miles",
    "heading_uncertainty_degrees": "degrees",
    "grid_size": "cells per side",
    "search_region_buffer_nm": "nautical miles",
}


def analysis_id(req: AnalysisRequest) -> str:
    canonical = json.dumps(req.model_dump(mode="json"), sort_keys=True, separators=(",", ":"))
    return str(uuid.uuid5(C.ANALYSIS_ID_NAMESPACE, canonical))


def _ll(lat: float, lon: float) -> dict:
    return {"latitude": round(lat, C.COORD_DECIMALS), "longitude": round(lon, C.COORD_DECIMALS)}


def run_analysis(req: AnalysisRequest) -> dict:
    lkp = req.last_known_position
    proj = LocalProjection(lkp.latitude, lkp.longitude)
    scen = build_scenarios(req, proj)
    region = build_search_region(req, proj, scen)
    grid = build_grid(proj, region, scen, req.grid_size)
    props = region.feature["properties"]

    dumped = req.model_dump(mode="json")
    input_summary = {k: {"value": dumped[k], "units": _UNITS[k]} for k in _UNITS}

    scenarios = [
        {
            "scenario_id": s.scenario_id,
            "scenario_name": s.scenario_name,
            "scenario_type": s.scenario_type,
            "endpoint": _ll(s.endpoint.lat, s.endpoint.lon),
            "distance_nm": round(s.distance_nm, C.NM_DECIMALS),
            "heading_degrees_used": round(s.heading_degrees_used, C.DEG_DECIMALS),
            "offset_from_baseline_nm": round(s.offset_from_baseline_nm, C.NM_DECIMALS),
            "included_in_region": s.included_in_region,
            "description": s.description,
            "assumptions": s.assumptions,
        }
        for s in scen.scenarios
    ]

    b = scen.baseline
    return {
        "schema_version": C.SCHEMA_VERSION,
        "analysis_id": analysis_id(req),
        "status": "success",
        "input_summary": input_summary,
        "baseline": {
            "distance_nm": round(scen.distance_nm, C.NM_DECIMALS),
            "endpoint": _ll(b.endpoint.lat, b.endpoint.lon),
            "heading_degrees": round(scen.heading, C.DEG_DECIMALS),
            "interpretation": "ground track",
        },
        "scenarios": scenarios,
        "search_region": region.feature,
        "grid": grid,
        "fuel_context": text.fuel_context(req),
        "wind_context": text.wind_context(req, scen),
        "explanation": text.explanation(req, scen, props["buffer_nm_applied"], props["area_sq_nm"]),
        "assumptions": text.assumptions(),
        "warnings": text.base_warnings(req, scen) + scen.warnings + region.warnings,
        "disclaimer": text.DISCLAIMER,
    }
