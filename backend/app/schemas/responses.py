"""Response schemas (the contract mirrored by docs/frontend_types.ts)."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

_OUT = ConfigDict(allow_inf_nan=False)


class LatLon(BaseModel):
    model_config = _OUT
    latitude: float
    longitude: float


class Baseline(BaseModel):
    model_config = _OUT
    distance_nm: float
    endpoint: LatLon
    heading_degrees: float
    interpretation: Literal["ground track"] = "ground track"


class Scenario(BaseModel):
    model_config = _OUT
    scenario_id: str
    scenario_name: str
    scenario_type: str
    endpoint: LatLon
    distance_nm: float
    heading_degrees_used: float
    offset_from_baseline_nm: float
    included_in_region: bool
    description: str
    assumptions: list[str]


class Bounds(BaseModel):
    model_config = _OUT
    min_lat: float
    min_lon: float = Field(..., description="Western edge. If crosses_antimeridian, min_lon > max_lon (RFC 7946 5.2).")
    max_lat: float
    max_lon: float = Field(..., description="Eastern edge.")


class RegionProperties(BaseModel):
    model_config = _OUT
    label: Literal["Illustrative search region"] = "Illustrative search region"
    area_sq_nm: float = Field(..., description="Approximate; computed in the local AEQD projection.")
    area_note: str
    bounds: Bounds
    crosses_antimeridian: bool
    buffer_nm_applied: float
    buffer_rule: str
    included_scenarios: list[str]
    method: str
    orientation: str
    disclaimer: str


class GeoJSONGeometry(BaseModel):
    type: Literal["Polygon", "MultiPolygon"]
    coordinates: list[Any] = Field(..., description="GeoJSON coordinates, [longitude, latitude] order.")


class SearchRegionFeature(BaseModel):
    type: Literal["Feature"] = "Feature"
    geometry: GeoJSONGeometry
    properties: RegionProperties


class CellSize(BaseModel):
    model_config = _OUT
    width_nm: float = Field(..., description="West-east cell size in the local projection.")
    height_nm: float = Field(..., description="North-south cell size in the local projection.")


class GridCell(BaseModel):
    model_config = _OUT
    cell_id: str
    row: int = Field(..., description="0 = northernmost row.")
    column: int = Field(..., description="0 = westernmost column.")
    centre_latitude: float
    centre_longitude: float
    intersects_region: bool
    illustrative_relative_demo_score: float = Field(..., ge=0, le=1)
    geometry: GeoJSONGeometry


class Grid(BaseModel):
    model_config = _OUT
    rows: int
    columns: int
    ordering: str
    score_type: Literal["illustrative_relative_demo_score"] = "illustrative_relative_demo_score"
    score_description: str
    sigma_nm: float
    cell_size_nm: CellSize
    cells: list[GridCell]


class FuelContext(BaseModel):
    model_config = _OUT
    remaining_percent: float
    aircraft_type: str
    endurance_minutes: None = None
    affects_geometry: Literal[False] = False
    explanation: str


class WindContext(BaseModel):
    model_config = _OUT
    speed_knots: float
    direction_from_degrees: float
    direction_toward_degrees: float
    description: str
    applied_to_baseline: Literal[False] = False
    hypothetical_scenario_included: bool
    limitations: list[str]


class InputValue(BaseModel):
    model_config = _OUT
    value: Any
    units: str


class AnalysisResponse(BaseModel):
    model_config = _OUT
    schema_version: str
    analysis_id: str
    status: Literal["success"] = "success"
    input_summary: dict[str, InputValue]
    baseline: Baseline
    scenarios: list[Scenario]
    search_region: SearchRegionFeature
    grid: Grid
    fuel_context: FuelContext
    wind_context: WindContext
    explanation: str
    assumptions: list[str] = Field(..., min_length=1)
    warnings: list[str] = Field(..., min_length=1)
    disclaimer: str


class ErrorBody(BaseModel):
    code: Literal["VALIDATION_ERROR", "PROJECTION_ERROR", "GEOMETRY_ERROR", "INTERNAL_ERROR", "HTTP_ERROR"]
    message: str
    details: list[dict[str, Any]] = []


class ErrorResponse(BaseModel):
    status: Literal["error"] = "error"
    error: ErrorBody


class AircraftProfile(BaseModel):
    aircraft_type: str
    display_name: str
    description: str


class AircraftProfilesResponse(BaseModel):
    note: str
    affects_calculations: Literal[False] = False
    profiles: list[AircraftProfile]
