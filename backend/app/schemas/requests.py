"""Request schemas. Every out-of-range value is rejected (HTTP 422), never clamped."""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.core import constants as C

_STRICT = ConfigDict(allow_inf_nan=False, extra="forbid")


class AircraftType(str, Enum):
    generic_light_aircraft = "generic_light_aircraft"
    generic_turboprop = "generic_turboprop"
    generic_jet = "generic_jet"


class Position(BaseModel):
    model_config = _STRICT

    latitude: float = Field(
        ...,
        ge=-90,
        le=90,
        description=(
            "Latitude in decimal degrees (WGS84), positive north. "
            f"|latitude| > {C.MAX_ABS_LATITUDE_DEG:g} is rejected (polar regions unsupported)."
        ),
    )
    longitude: float = Field(
        ..., ge=-180, le=180, description="Longitude in decimal degrees (WGS84), positive east."
    )

    @field_validator("latitude")
    @classmethod
    def _not_polar(cls, value: float) -> float:
        if abs(value) > C.MAX_ABS_LATITUDE_DEG:
            raise ValueError(
                f"|latitude| must be <= {C.MAX_ABS_LATITUDE_DEG:g} degrees; polar positions are "
                "not supported by the local projection in this version"
            )
        return value


class Wind(BaseModel):
    model_config = _STRICT

    speed_knots: float = Field(..., ge=0, le=C.MAX_WIND_SPEED_KNOTS, description="Wind speed in knots.")
    direction_from_degrees: float = Field(
        ...,
        ge=0,
        lt=360,
        description="Direction the wind blows FROM, degrees clockwise from true north, in [0, 360).",
    )


class AnalysisRequest(BaseModel):
    model_config = ConfigDict(
        allow_inf_nan=False,
        extra="forbid",
        json_schema_extra={"description": "Inputs for an illustrative, non-operational search-area sketch."},
    )

    last_known_position: Position = Field(..., description="Last known position (WGS84 degrees).")
    heading_degrees: float = Field(
        ...,
        ge=0,
        lt=360,
        description=(
            "Degrees clockwise from TRUE north in [0, 360) (0 = N, 90 = E). Because it is combined "
            "with ground speed, the baseline treats it as the GROUND TRACK. With wind present, "
            "true heading and ground track generally differ."
        ),
    )
    ground_speed_knots: float = Field(
        ..., ge=0, le=C.MAX_GROUND_SPEED_KNOTS, description="Ground speed in knots (NOT airspeed)."
    )
    elapsed_minutes: float = Field(
        ..., ge=0, le=C.MAX_ELAPSED_MINUTES, description="Minutes elapsed since the last known position."
    )
    wind: Wind = Field(..., description="Reported wind. Context only; never added to the baseline.")
    aircraft_type: AircraftType = Field(
        ..., description="Generic demo category. Descriptive only; does not affect calculations."
    )
    fuel_remaining_percent: float = Field(
        ..., ge=0, le=100, description="Reported fuel remaining in percent. Context only; does not affect geometry."
    )
    position_uncertainty_nm: float = Field(
        C.DEFAULT_POSITION_UNCERTAINTY_NM,
        ge=0,
        le=C.MAX_POSITION_UNCERTAINTY_NM,
        description="Uncertainty of the last known position, nautical miles.",
    )
    heading_uncertainty_degrees: float = Field(
        C.DEFAULT_HEADING_UNCERTAINTY_DEG,
        ge=0,
        le=C.MAX_HEADING_UNCERTAINTY_DEG,
        description="Half-width u of the heading sensitivity sweep, degrees (scenarios at h-u and h+u).",
    )
    grid_size: int = Field(
        C.DEFAULT_GRID_SIZE,
        ge=C.MIN_GRID_SIZE,
        le=C.MAX_GRID_SIZE,
        strict=True,
        description="Number of grid rows and columns (grid_size x grid_size cells).",
    )
    search_region_buffer_nm: float = Field(
        C.DEFAULT_REGION_BUFFER_NM,
        ge=0,
        le=C.MAX_REGION_BUFFER_NM,
        description="Buffer around the swept sector, nautical miles. Applied buffer = max(this, position_uncertainty_nm).",
    )

    @model_validator(mode="after")
    def _distance_cap(self) -> "AnalysisRequest":
        distance_nm = self.ground_speed_knots * self.elapsed_minutes / 60.0
        if distance_nm > C.MAX_BASELINE_DISTANCE_NM:
            raise ValueError(
                f"baseline distance ground_speed_knots x elapsed_minutes / 60 = {distance_nm:.1f} nm "
                f"exceeds the supported maximum of {C.MAX_BASELINE_DISTANCE_NM:g} nm"
            )
        return self
