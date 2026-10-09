"""Straight-line dead-reckoning baseline.

distance_nm = ground_speed_knots * elapsed_minutes / 60
east = d * sin(h), north = d * cos(h)   (h = ground track, clockwise from true north)

Ground speed already contains the effect of wind, so wind is NEVER added here.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.services.coordinate_service import LocalProjection


@dataclass(frozen=True)
class Endpoint:
    x: float  # metres east of the last known position (AEQD)
    y: float  # metres north of the last known position (AEQD)
    lon: float
    lat: float


def baseline_distance_nm(ground_speed_knots: float, elapsed_minutes: float) -> float:
    return ground_speed_knots * elapsed_minutes / 60.0


def project_endpoint(proj: LocalProjection, distance_nm: float, heading_deg: float) -> Endpoint:
    """Endpoint after travelling distance_nm along heading_deg from the projection centre."""
    if distance_nm == 0:
        return Endpoint(0.0, 0.0, proj.lon0, proj.lat0)
    x, y = proj.displacement_xy(distance_nm, heading_deg)
    lon, lat = proj.to_lonlat(x, y)
    return Endpoint(x, y, lon, lat)


def endpoint_from_xy(proj: LocalProjection, x: float, y: float) -> Endpoint:
    if x == 0 and y == 0:
        return Endpoint(0.0, 0.0, proj.lon0, proj.lat0)
    lon, lat = proj.to_lonlat(x, y)
    return Endpoint(x, y, lon, lat)
