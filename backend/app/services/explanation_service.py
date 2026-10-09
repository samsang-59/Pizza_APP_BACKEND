"""Human-readable, carefully hedged text: fuel/wind context, assumptions,
warnings, explanation and the methodology document.

Wording rule: outputs are "illustrative", "hypothetical", "sensitivity" or
"demonstration" values. Never describe them as likely locations or as
validated statistics.
"""

from __future__ import annotations

from app.core import constants as C
from app.schemas.requests import AnalysisRequest
from app.services.coordinate_service import normalize_heading
from app.services.scenario_service import ScenarioSet

DISCLAIMER = (
    "SkyTrace AI is a hackathon PROTOTYPE for demonstration and education. It does not locate any real aircraft, "
    "does not compute operational search-and-rescue statistics, and must not be used for real search planning. "
    "All regions, scenarios and scores are illustrative sensitivity sketches based on simplified assumptions. "
    "Real incidents must be handled by the responsible Rescue Coordination Centre using approved tools."
)

WIND_LIMITATIONS = [
    "Ground speed already includes the effect of wind, so wind is not applied to the baseline.",
    "Separating wind from aircraft motion would require true airspeed and true heading, not ground speed.",
    "Aircraft performance data (speeds, climb/descent, glide) is not modelled.",
    "Altitude is unknown; wind varies strongly with altitude.",
    "Winds are treated as constant; real winds vary in time and space.",
    "Navigation mode (heading hold vs. track hold / autopilot) is unknown.",
    "No track history (radar, ADS-B or other surveillance) is used.",
]

AIRCRAFT_PROFILES = [
    {
        "aircraft_type": "generic_light_aircraft",
        "display_name": "Generic light aircraft",
        "description": "Demo category for small piston single/twin aircraft. Descriptive label only.",
    },
    {
        "aircraft_type": "generic_turboprop",
        "display_name": "Generic turboprop",
        "description": "Demo category for turboprop aircraft. Descriptive label only.",
    },
    {
        "aircraft_type": "generic_jet",
        "display_name": "Generic jet",
        "description": "Demo category for jet aircraft. Descriptive label only.",
    },
]
AIRCRAFT_PROFILES_NOTE = (
    "These are generic demonstration categories, NOT aircraft-specific performance profiles. In this version the "
    "aircraft type is descriptive only and does not affect any calculation."
)


def wind_context(req: AnalysisRequest, scen: ScenarioSet) -> dict:
    w = req.wind
    toward = normalize_heading(w.direction_from_degrees + 180.0)
    included = any(s.scenario_id == "hypothetical_wind_drift" for s in scen.scenarios)
    if w.speed_knots == 0:
        desc = "Calm wind reported (0 kt)."
    else:
        desc = (
            f"Wind {w.speed_knots:g} kt blowing FROM {w.direction_from_degrees:g} degrees, i.e. TOWARD "
            f"{toward:g} degrees (true). Reported for context only; it is not added to the baseline because "
            "ground speed already reflects it."
        )
    return {
        "speed_knots": w.speed_knots,
        "direction_from_degrees": w.direction_from_degrees,
        "direction_toward_degrees": round(toward, C.DEG_DECIMALS),
        "description": desc,
        "applied_to_baseline": False,
        "hypothetical_scenario_included": included,
        "limitations": list(WIND_LIMITATIONS),
    }


def fuel_context(req: AnalysisRequest) -> dict:
    return {
        "remaining_percent": req.fuel_remaining_percent,
        "aircraft_type": req.aircraft_type.value,
        "endurance_minutes": None,
        "affects_geometry": False,
        "explanation": (
            f"Reported fuel remaining: {req.fuel_remaining_percent:g}%. A percentage alone is insufficient to "
            "estimate endurance or range: that would need usable fuel capacity, fuel flow at the actual power "
            "setting and altitude, required reserves and aircraft-specific performance data. None of these are "
            "supplied, and SkyTrace AI does not invent them, so endurance is null and fuel does not change the "
            "geometry. The aircraft type is a descriptive label only."
        ),
    }


def assumptions() -> list[str]:
    return [
        "The heading is interpreted as the ground track (direction of motion over the ground), because it is "
        "combined with ground speed. With wind present, true heading and ground track differ.",
        "Straight-line motion at constant ground speed from the last known position for the whole elapsed time.",
        "Ground speed already includes wind; wind is reported as context and never added to the baseline.",
        "Heading sensitivity scenarios use fixed offsets of +/-u (and capped +/-2u) degrees; they are not "
        "measured errors.",
        "Distances use the WGS84 ellipsoid; 1 nm = 1852 m exactly.",
        "Geometry is built in a local azimuthal equidistant projection centred on the last known position.",
        "Fuel and aircraft type are descriptive context and do not alter any geometry.",
    ]


def base_warnings(req: AnalysisRequest, scen: ScenarioSet) -> list[str]:
    out = [
        "No land/water mask is applied: the illustrative region and grid may include land.",
        "Heading is treated as ground track together with ground speed; if the inputs are actually true heading "
        "or airspeed, the baseline is not representative.",
        "Fuel percentage alone cannot determine endurance or range; no fuel-limited boundary is applied.",
        "The search region is illustrative only: not a probability contour, not a validated confidence region "
        "and not an operational boundary.",
        "Grid scores are demonstration values for visualization only and are not probabilities.",
    ]
    if scen.distance_nm > C.AEQD_DISTORTION_WARNING_NM:
        out.append(
            f"Baseline distance {scen.distance_nm:.0f} nm exceeds {C.AEQD_DISTORTION_WARNING_NM:g} nm; buffer "
            "widths, grid cell sizes and areas far from the last known position are increasingly approximate "
            "(projection distortion)."
        )
    return out


def explanation(req: AnalysisRequest, scen: ScenarioSet, buffer_nm: float, area_sq_nm: float) -> str:
    lkp = req.last_known_position
    u = req.heading_uncertainty_degrees
    b = scen.baseline.endpoint
    parts = [
        f"Starting from the last known position ({lkp.latitude:.4f}, {lkp.longitude:.4f}), a straight-line "
        f"dead-reckoning reference covers {scen.distance_nm:.1f} nm ({req.ground_speed_knots:g} kt ground speed "
        f"for {req.elapsed_minutes:g} min) along a ground track of {scen.heading:g} degrees true, reaching an "
        f"illustrative baseline endpoint near ({b.lat:.4f}, {b.lon:.4f}).",
    ]
    if scen.distance_nm > 0 and u > 0:
        parts.append(
            f"To show sensitivity to heading, the same distance is swept from {normalize_heading(scen.heading - u):g} "
            f"to {normalize_heading(scen.heading + u):g} degrees (+/-{u:g} degrees)."
        )
    parts.append(
        f"The illustrative search region is the convex hull of that swept sector and the start point, buffered "
        f"by {buffer_nm:g} nm, covering roughly {area_sq_nm:,.0f} square nautical miles."
    )
    parts.append(
        "Wind is shown for context but not added, because ground speed already reflects it; fuel percentage is "
        "reported but cannot bound the area without aircraft-specific data. Grid values are demonstration "
        "scores for visualization only. This is a hypothetical sketch, not an operational search plan."
    )
    return " ".join(parts)


def methodology() -> dict:
    return {
        "title": "SkyTrace AI methodology (prototype, illustrative only)",
        "summary": (
            "SkyTrace AI turns a last known position, ground speed, ground track and elapsed time into a "
            "straight-line baseline, a few deterministic heading-sensitivity scenarios, a buffered swept-sector "
            "region and a demo grid. It is a demonstration of geometry, not a search-planning model."
        ),
        "steps": [
            {
                "name": "Local projection",
                "detail": (
                    "A per-request Azimuthal Equidistant (AEQD) projection on the WGS84 ellipsoid, centred on the "
                    "last known position, units metres. Distance and azimuth from the centre are exact; shapes and "
                    "areas far from the centre are approximate."
                ),
            },
            {
                "name": "Baseline",
                "detail": (
                    "distance_nm = ground_speed_knots x elapsed_minutes / 60; east = d sin(h), north = d cos(h) "
                    "(1 nm = 1852 m), inverse-projected to lon/lat. Cross-checked against pyproj Geod.fwd."
                ),
            },
            {
                "name": "Scenarios",
                "detail": (
                    "Same distance along h-u and h+u, plus outer h-2u and h+2u (capped at "
                    f"{C.MAX_OUTER_SENSITIVITY_OFFSET_DEG:g} degrees), plus one optional hypothetical wind drift "
                    "scenario that treats the speed as airspeed and adds wind speed x time toward "
                    "(direction_from + 180). Offsets from the baseline use geodesic distances."
                ),
            },
            {
                "name": "Illustrative search region",
                "detail": (
                    "Convex hull of the start, baseline and +/-u endpoints and arc points every "
                    f"~{C.ARC_SAMPLING_STEP_DEG:g} degrees, buffered by max(position_uncertainty_nm, "
                    "search_region_buffer_nm). Converted to GeoJSON [lon, lat], split at the antimeridian into a "
                    "MultiPolygon if needed, exterior rings counter-clockwise."
                ),
            },
            {
                "name": "Demo grid",
                "detail": (
                    "grid_size x grid_size cells over the region's projected bounding box. Score = Gaussian of the "
                    "distance from cell centre to the baseline track segment (sigma = "
                    f"{C.SCORE_SIGMA_FRACTION:g} x larger region extent), 0 outside the region, min-max "
                    "normalised. Demonstration values only."
                ),
            },
        ],
        "assumptions": assumptions(),
        "wind_limitations": list(WIND_LIMITATIONS),
        "fuel_limitations": (
            "Fuel percentage is reported only; endurance, range, reserves and consumption are not computed "
            "because usable capacity, fuel flow and aircraft performance data are not available."
        ),
        "limitations": [
            "No land/water mask, terrain, ocean drift, debris drift or survival modelling.",
            "No turns, holding, descent profiles, glide range or ditching behaviour.",
            "No surveillance data, track history or communication timelines.",
            f"Polar positions (|latitude| > {C.MAX_ABS_LATITUDE_DEG:g}) and regions reaching a pole are rejected.",
            f"Baseline distance is capped at {C.MAX_BASELINE_DISTANCE_NM:g} nm.",
            "Areas are approximate (AEQD is not equal-area).",
        ],
        "disclaimer": DISCLAIMER,
    }
