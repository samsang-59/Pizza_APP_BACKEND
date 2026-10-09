"""Illustrative search region: buffered convex hull of a swept heading sector.

Built in the local AEQD projection (metres), then converted to GeoJSON:
  1. points = last known position + endpoints of REGION_SCENARIO_IDS
     + arc points every ~ARC_SAMPLING_STEP_DEG across [h-u, h+u] at the baseline distance
  2. convex hull of those points
  3. buffer by max(position_uncertainty_nm, search_region_buffer_nm)
     (the larger input wins; they are NOT added, because both describe slack
      around the same swept sector and summing would double-count)
  4. if the buffer is 0 and the hull is a point/line, a small minimum buffer is
     applied (with a warning) so the output is always a valid polygon.

This is NOT a probability contour, NOT a validated confidence region and NOT an
operational search boundary.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

from shapely.geometry import MultiPoint, Polygon

from app.core import constants as C
from app.core.exceptions import GeometryError
from app.schemas.requests import AnalysisRequest
from app.services.coordinate_service import LocalProjection, nm_to_m
from app.services.scenario_service import ScenarioSet

REGION_DISCLAIMER = (
    "Illustrative, non-operational region for demonstration only. It is NOT a probability contour, "
    "NOT a validated confidence region and NOT an operational search boundary. No land/water mask is "
    "applied, so the region may include land."
)
REGION_METHOD = (
    "Convex hull (in a local azimuthal equidistant projection centred on the last known position) of the "
    "last known position, the baseline and +/-u heading-sensitivity endpoints, and arc points sampled every "
    f"~{C.ARC_SAMPLING_STEP_DEG:g} degrees across [h-u, h+u] at the baseline distance; then buffered by "
    "max(position_uncertainty_nm, search_region_buffer_nm)."
)
BUFFER_RULE = "buffer_nm_applied = max(position_uncertainty_nm, search_region_buffer_nm); the two are not summed."


@dataclass
class SearchRegion:
    projected: Polygon
    feature: dict
    warnings: list[str] = field(default_factory=list)


def arc_headings(h: float, u: float) -> list[float]:
    """Evenly spaced headings from h-u to h+u inclusive, spacing <= ARC_SAMPLING_STEP_DEG."""
    if u == 0:
        return [h]
    n = max(1, math.ceil((2 * u) / C.ARC_SAMPLING_STEP_DEG))
    return [h - u + 2 * u * i / n for i in range(n + 1)]


def build_search_region(req: AnalysisRequest, proj: LocalProjection, scen: ScenarioSet) -> SearchRegion:
    warnings: list[str] = []
    d = scen.distance_nm
    u = req.heading_uncertainty_degrees

    points: list[tuple[float, float]] = [(0.0, 0.0)]
    points += [(s.endpoint.x, s.endpoint.y) for s in scen.region_scenarios]
    if d > 0:
        points += [proj.displacement_xy(d, a) for a in arc_headings(scen.heading, u)]
    hull = MultiPoint(points).convex_hull

    buffer_nm = max(req.position_uncertainty_nm, req.search_region_buffer_nm)
    degenerate = not isinstance(hull, Polygon) or hull.area <= 0
    if buffer_nm == 0 and degenerate:
        buffer_nm = C.MIN_DEGENERATE_BUFFER_NM
        warnings.append(
            f"Requested buffer is 0 nm and the swept geometry is a point or line; a minimum buffer of "
            f"{C.MIN_DEGENERATE_BUFFER_NM:g} nm was applied so the region is a valid polygon."
        )

    region = hull.buffer(nm_to_m(buffer_nm), quad_segs=C.BUFFER_QUAD_SEGMENTS) if buffer_nm > 0 else hull
    # Buffer output is valid by construction; we validate rather than silently repair.
    if not isinstance(region, Polygon) or region.is_empty or not region.is_valid:
        raise GeometryError("Search region geometry is invalid", [{"stage": "buffer"}])
    if any(not math.isfinite(v) for v in region.bounds):
        raise GeometryError("Search region has non-finite coordinates")

    proj.assert_pole_clear(region, "search region")

    segment_m = max(C.MIN_DENSIFY_SEGMENT_M, region.length / C.TARGET_RING_VERTICES)
    geometry, info = proj.polygon_to_geojson(region, segment_m)

    if info["crosses_antimeridian"]:
        warnings.append(
            "The search region crosses the antimeridian (180 degrees longitude); its geometry is split into a "
            "GeoJSON MultiPolygon and its bounds use min_lon > max_lon."
        )

    feature = {
        "type": "Feature",
        "geometry": geometry,
        "properties": {
            "label": "Illustrative search region",
            "area_sq_nm": round(region.area / (C.METRES_PER_NM**2), C.AREA_DECIMALS),
            "area_note": "Approximate: computed in the local AEQD projection, which is not equal-area.",
            "bounds": info["bounds"],
            "crosses_antimeridian": info["crosses_antimeridian"],
            "buffer_nm_applied": round(buffer_nm, C.NM_DECIMALS),
            "buffer_rule": BUFFER_RULE,
            "included_scenarios": [s.scenario_id for s in scen.region_scenarios],
            "method": REGION_METHOD,
            "orientation": "Exterior rings counter-clockwise (RFC 7946 right-hand rule); coordinates [longitude, latitude].",
            "disclaimer": REGION_DISCLAIMER,
        },
    }
    return SearchRegion(projected=region, feature=feature, warnings=warnings)
