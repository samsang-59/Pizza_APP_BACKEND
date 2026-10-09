"""grid_size x grid_size demo grid over the region's projected bounding box.

Order: rows run north -> south (row 0 is northernmost), columns run
west -> east (column 0 is westernmost), in the local AEQD projection. cells[]
is row-major: index = row * columns + column.

Score (illustrative_relative_demo_score), deterministic:
  raw = exp(-0.5 * (dist / sigma)^2) for cells intersecting the region, else 0
        dist  = distance from the cell centre to the baseline track segment
        sigma = SCORE_SIGMA_FRACTION x max(bbox width, bbox height), >= MIN_SCORE_SIGMA_M
  score = (raw - min) / (max - min); if all raw values are equal, cells get 1.0
          when that value is > 0 and 0.0 otherwise (no division by zero).
"""

from __future__ import annotations

import math

import shapely
from shapely.geometry import LineString, Point, box

from app.core import constants as C
from app.services.coordinate_service import LocalProjection, m_to_nm
from app.services.scenario_service import ScenarioSet
from app.services.search_region_service import SearchRegion

SCORE_DESCRIPTION = (
    "Relative visualization values in [0, 1] for demonstration only. They are NOT probabilities and carry no "
    "real-world meaning; a higher value does NOT mean a target is more likely to be in that cell. Computed as a "
    "Gaussian fall-off of the distance from each cell centre to the straight baseline track segment (sigma = "
    f"{C.SCORE_SIGMA_FRACTION:g} x the region's larger projected extent), set to 0 outside the region, then "
    "min-max normalised across all cells."
)
ORDERING = (
    "Row-major. row 0 = northernmost, increasing southward; column 0 = westernmost, increasing eastward "
    "(in the local projection). cell_id = 'r{row}c{column}'."
)


def build_grid(proj: LocalProjection, region: SearchRegion, scen: ScenarioSet, grid_size: int) -> dict:
    minx, miny, maxx, maxy = region.projected.bounds
    width, height = maxx - minx, maxy - miny
    proj.assert_pole_clear(box(minx, miny, maxx, maxy), "search grid")
    cw, ch = width / grid_size, height / grid_size

    base = scen.baseline.endpoint
    track = Point(0.0, 0.0) if (base.x == 0 and base.y == 0) else LineString([(0.0, 0.0), (base.x, base.y)])
    sigma = max(C.MIN_SCORE_SIGMA_M, C.SCORE_SIGMA_FRACTION * max(width, height))

    shapely.prepare(region.projected)
    raw_cells = []
    for row in range(grid_size):
        top = maxy - row * ch
        for col in range(grid_size):
            left = minx + col * cw
            cell = box(left, top - ch, left + cw, top)
            cx, cy = left + cw / 2.0, top - ch / 2.0
            intersects = bool(region.projected.intersects(cell))
            dist = track.distance(Point(cx, cy))
            raw = math.exp(-0.5 * (dist / sigma) ** 2) if intersects else 0.0
            raw_cells.append((row, col, cell, cx, cy, intersects, raw))

    raws = [c[6] for c in raw_cells]
    lo, hi = min(raws), max(raws)
    span = hi - lo

    cells = []
    for row, col, cell, cx, cy, intersects, raw in raw_cells:
        if span > 1e-12:
            score = (raw - lo) / span
        else:
            score = 1.0 if raw > 0 else 0.0
        if not math.isfinite(score):  # defensive; cannot happen with the guard above
            score = 0.0
        lon, lat = proj.to_lonlat(cx, cy)
        geometry, _ = proj.polygon_to_geojson(cell, max(cw, ch) / C.CELL_EDGE_SUBDIVISIONS)
        cells.append(
            {
                "cell_id": f"r{row}c{col}",
                "row": row,
                "column": col,
                "centre_latitude": round(lat, C.COORD_DECIMALS),
                "centre_longitude": round(lon, C.COORD_DECIMALS),
                "intersects_region": intersects,
                "illustrative_relative_demo_score": round(min(1.0, max(0.0, score)), C.SCORE_DECIMALS),
                "geometry": geometry,
            }
        )

    return {
        "rows": grid_size,
        "columns": grid_size,
        "ordering": ORDERING,
        "score_type": "illustrative_relative_demo_score",
        "score_description": SCORE_DESCRIPTION,
        "sigma_nm": round(m_to_nm(sigma), C.NM_DECIMALS),
        "cell_size_nm": {
            "width_nm": round(m_to_nm(cw), C.NM_DECIMALS),
            "height_nm": round(m_to_nm(ch), C.NM_DECIMALS),
        },
        "cells": cells,
    }
