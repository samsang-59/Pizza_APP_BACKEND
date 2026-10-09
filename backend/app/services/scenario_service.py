"""Deterministic heading-sensitivity and hypothetical wind scenarios.

All scenarios share the same speed and elapsed time as the baseline. Only the
baseline and the +/-u heading scenarios are used to build the search region
(see REGION_SCENARIO_IDS); the outer +/-2u and the hypothetical wind drift
scenarios are reported for context and are NOT inside the region by design.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

from app.core import constants as C
from app.schemas.requests import AnalysisRequest
from app.services.coordinate_service import GEOD, LocalProjection, m_to_nm, normalize_heading
from app.services.flight_model import Endpoint, baseline_distance_nm, endpoint_from_xy, project_endpoint

# Scenarios whose endpoints feed the convex hull of the illustrative region.
REGION_SCENARIO_IDS = ("baseline", "heading_minus", "heading_plus")


@dataclass
class ScenarioResult:
    scenario_id: str
    scenario_name: str
    scenario_type: str
    endpoint: Endpoint
    distance_nm: float
    heading_degrees_used: float
    description: str
    assumptions: list[str]
    offset_from_baseline_nm: float = 0.0
    included_in_region: bool = False


@dataclass
class ScenarioSet:
    distance_nm: float
    heading: float
    scenarios: list[ScenarioResult]
    warnings: list[str] = field(default_factory=list)

    @property
    def baseline(self) -> ScenarioResult:
        return self.scenarios[0]

    @property
    def region_scenarios(self) -> list[ScenarioResult]:
        return [s for s in self.scenarios if s.included_in_region]


_COMMON = "Same ground speed and elapsed time as the baseline; straight-line constant track."


def build_scenarios(req: AnalysisRequest, proj: LocalProjection) -> ScenarioSet:
    h = normalize_heading(req.heading_degrees)
    u = req.heading_uncertainty_degrees
    d = baseline_distance_nm(req.ground_speed_knots, req.elapsed_minutes)
    warnings: list[str] = []

    scenarios = [
        ScenarioResult(
            scenario_id="baseline",
            scenario_name="Baseline (straight-line ground track)",
            scenario_type="baseline_ground_track",
            endpoint=project_endpoint(proj, d, h),
            distance_nm=d,
            heading_degrees_used=h,
            description=(
                "Straight-line dead-reckoning reference: ground speed x elapsed time along the supplied "
                "heading, interpreted as the ground track. Illustrative only."
            ),
            assumptions=[
                "Heading is treated as the ground track (direction of motion over the ground).",
                "Ground speed already includes wind; no wind correction is applied.",
                "No turns, climbs, descents or speed changes after the last known position.",
            ],
        )
    ]

    if d == 0:
        warnings.append(
            "Baseline distance is 0 nm (zero speed or zero elapsed time); heading sensitivity scenarios "
            "would coincide with the last known position and were omitted."
        )
    elif u == 0:
        warnings.append(
            "Heading uncertainty is 0 degrees; heading sensitivity scenarios would duplicate the baseline "
            "and were omitted. The region is then a buffered track line."
        )
    else:
        outer = 2.0 * u
        if outer > C.MAX_OUTER_SENSITIVITY_OFFSET_DEG:
            warnings.append(
                f"Outer sensitivity offset 2 x {u:g} degrees exceeds the {C.MAX_OUTER_SENSITIVITY_OFFSET_DEG:g} "
                f"degree cap; outer scenarios use +/-{C.MAX_OUTER_SENSITIVITY_OFFSET_DEG:g} degrees."
            )
            outer = C.MAX_OUTER_SENSITIVITY_OFFSET_DEG
        for sid, sign, offset, stype, label in (
            ("heading_minus", -1, u, "heading_sensitivity", "Heading sensitivity (h - u)"),
            ("heading_plus", +1, u, "heading_sensitivity", "Heading sensitivity (h + u)"),
            ("heading_minus_2x", -1, outer, "heading_sensitivity_outer", "Outer heading sensitivity (h - 2u, capped)"),
            ("heading_plus_2x", +1, outer, "heading_sensitivity_outer", "Outer heading sensitivity (h + 2u, capped)"),
        ):
            hh = normalize_heading(h + sign * offset)
            if sid.endswith("_2x") and outer <= u:
                continue
            scenarios.append(
                ScenarioResult(
                    scenario_id=sid,
                    scenario_name=label,
                    scenario_type=stype,
                    endpoint=project_endpoint(proj, d, hh),
                    distance_nm=d,
                    heading_degrees_used=hh,
                    description=(
                        f"Sensitivity check: the same distance flown along {hh:.1f} degrees "
                        f"({'-' if sign < 0 else '+'}{offset:g} degrees from the supplied heading). Hypothetical."
                    ),
                    assumptions=[_COMMON, "Heading offset is a fixed sensitivity value, not a measured error."],
                )
            )

    # Hypothetical wind drift: only if the supplied speed were AIRSPEED along the heading.
    drift_nm = req.wind.speed_knots * req.elapsed_minutes / 60.0
    if drift_nm > 0:
        toward = normalize_heading(req.wind.direction_from_degrees + 180.0)
        bx, by = scenarios[0].endpoint.x, scenarios[0].endpoint.y
        wx, wy = proj.displacement_xy(drift_nm, toward)
        x, y = bx + wx, by + wy
        scenarios.append(
            ScenarioResult(
                scenario_id="hypothetical_wind_drift",
                scenario_name="Hypothetical wind drift (speed treated as airspeed)",
                scenario_type="wind_sensitivity_hypothetical",
                endpoint=endpoint_from_xy(proj, x, y),
                distance_nm=m_to_nm(math.hypot(x, y)),
                heading_degrees_used=h,
                description=(
                    "HYPOTHETICAL: IF the supplied speed were airspeed along the supplied heading, the endpoint "
                    f"would be the baseline vector plus a wind drift of {drift_nm:.1f} nm toward {toward:.0f} degrees. "
                    "The input is defined as ground speed, so this is a sensitivity illustration only and is not "
                    "part of the baseline or the search region."
                ),
                assumptions=[
                    "Supplied speed reinterpreted as true airspeed (contradicts the stated ground-speed input).",
                    "Wind constant in speed and direction for the whole elapsed time and at all altitudes.",
                    "Simple vector addition; no wind-correction angle or aircraft performance modelled.",
                ],
            )
        )
    else:
        warnings.append("Wind drift over the elapsed time is 0 nm; no hypothetical wind drift scenario was produced.")

    base = scenarios[0].endpoint
    for s in scenarios:
        s.included_in_region = s.scenario_id in REGION_SCENARIO_IDS
        if s.endpoint.x == base.x and s.endpoint.y == base.y:
            s.offset_from_baseline_nm = 0.0
        else:
            _, _, dist_m = GEOD.inv(base.lon, base.lat, s.endpoint.lon, s.endpoint.lat)
            s.offset_from_baseline_nm = m_to_nm(dist_m)

    return ScenarioSet(distance_nm=d, heading=h, scenarios=scenarios, warnings=warnings)
