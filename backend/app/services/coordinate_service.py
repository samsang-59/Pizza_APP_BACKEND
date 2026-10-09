"""Local Azimuthal Equidistant (AEQD) projection and lon/lat <-> metres helpers.

Why AEQD: on an AEQD projection centred on the last known position, the
distance *and* azimuth from the centre to any point are exact (PROJ computes
the ellipsoidal AEQD with geodesics), so "travel d along heading h" is exactly
the point (d*sin h, d*cos h) in metres. Away from the centre, distances between
two arbitrary points and areas are only approximate; distortion grows with
distance from the centre, which is one reason the baseline distance is capped.

Projected geometry is converted back to GeoJSON with:
  * densification (so long projected edges stay faithful),
  * sequential longitude unwrapping (continuous ring across +/-180),
  * splitting at the antimeridian into a MultiPolygon (RFC 7946 section 3.1.9),
  * counter-clockwise exterior rings (RFC 7946 right-hand rule),
  * finite / in-range / valid checks on every output coordinate.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import shapely
from pyproj import CRS, Geod, Transformer
from shapely import affinity
from shapely.geometry import MultiPolygon, Point, Polygon, box
from shapely.geometry.polygon import orient

from app.core import constants as C
from app.core.exceptions import GeometryError, ProjectionError

GEOD = Geod(ellps=C.ELLIPSOID)


def nm_to_m(nm: float) -> float:
    return nm * C.METRES_PER_NM


def m_to_nm(m: float) -> float:
    return m / C.METRES_PER_NM


def normalize_longitude(lon: float) -> float:
    """Map any longitude to [-180, 180]; 180 is kept as 180 (not -180)."""
    if -180.0 <= lon <= 180.0:
        return lon
    wrapped = ((lon + 180.0) % 360.0) - 180.0
    return 180.0 if wrapped == -180.0 and lon > 0 else wrapped


def normalize_heading(deg: float) -> float:
    """Map any angle to [0, 360)."""
    value = deg % 360.0
    return 0.0 if value >= 360.0 else value


def _require_finite(values, what: str) -> None:
    for v in values:
        if not math.isfinite(v):
            raise ProjectionError(
                f"Coordinate transform produced a non-finite value ({what})",
                [{"stage": what}],
            )


@dataclass
class LocalProjection:
    """AEQD CRS centred on (lat0, lon0), units metres, WGS84 ellipsoid."""

    lat0: float
    lon0: float

    def __post_init__(self) -> None:
        crs = CRS.from_proj4(
            f"+proj=aeqd +lat_0={self.lat0} +lon_0={self.lon0} +x_0=0 +y_0=0 "
            f"+ellps={C.ELLIPSOID} +units=m +no_defs"
        )
        geographic = CRS.from_epsg(4326)
        self._fwd = Transformer.from_crs(geographic, crs, always_xy=True)
        self._inv = Transformer.from_crs(crs, geographic, always_xy=True)

    # -- points -----------------------------------------------------------
    def to_xy(self, lon: float, lat: float) -> tuple[float, float]:
        x, y = self._fwd.transform(lon, lat)
        _require_finite((x, y), "forward projection")
        return float(x), float(y)

    def to_lonlat(self, x: float, y: float) -> tuple[float, float]:
        lon, lat = self._inv.transform(x, y)
        _require_finite((lon, lat), "inverse projection")
        if not -90.0 <= lat <= 90.0:
            raise ProjectionError("Inverse projection produced an out-of-range latitude")
        return normalize_longitude(float(lon)), float(lat)

    def to_lonlat_many(self, xs, ys) -> tuple[list[float], list[float]]:
        lons, lats = self._inv.transform(list(xs), list(ys))
        lons, lats = list(map(float, lons)), list(map(float, lats))
        _require_finite(lons + lats, "inverse projection")
        if any(not -90.0 <= la <= 90.0 for la in lats):
            raise ProjectionError("Inverse projection produced an out-of-range latitude")
        return lons, lats

    # -- displacement --------------------------------------------------------
    @staticmethod
    def displacement_xy(distance_nm: float, heading_deg: float) -> tuple[float, float]:
        """East/north offset in metres for travelling distance_nm along heading_deg."""
        d_m = nm_to_m(distance_nm)
        h = math.radians(heading_deg)
        return d_m * math.sin(h), d_m * math.cos(h)

    # -- poles -----------------------------------------------------------------
    def assert_pole_clear(self, geom, what: str) -> None:
        """Reject geometry that reaches (within POLE_EXCLUSION_NM of) a pole."""
        limit = nm_to_m(C.POLE_EXCLUSION_NM)
        for pole_lat in (90.0, -90.0):
            # Distance from the centre to the pole along the meridian is exact in AEQD,
            # so a point that far from the centre is the pole's projected location.
            _, _, dist = GEOD.inv(self.lon0, self.lat0, self.lon0, pole_lat)
            if dist > 19_000_000:  # pole on the far side of the globe; cannot be reached
                continue
            px, py = self.to_xy(self.lon0, pole_lat)
            if geom.distance(Point(px, py)) <= limit:
                hemi = "North" if pole_lat > 0 else "South"
                raise GeometryError(
                    f"The {what} reaches within {C.POLE_EXCLUSION_NM:g} nm of the {hemi} Pole; "
                    "polar regions are not supported in this version",
                    [{"geometry": what, "pole": hemi.lower()}],
                )

    # -- polygons --------------------------------------------------------------
    def polygon_to_geojson(self, poly: Polygon, max_segment_m: float) -> tuple[dict, dict]:
        """Convert a projected polygon (no holes expected) to a GeoJSON geometry.

        Returns (geometry_dict, info) where info has unwrapped bounds and an
        antimeridian flag.
        """
        if poly.is_empty or not poly.is_valid:
            raise GeometryError("Projected polygon is empty or invalid")
        dense = shapely.segmentize(poly, max_segment_length=max(max_segment_m, 1.0))
        xs, ys = dense.exterior.coords.xy
        lons, lats = self.to_lonlat_many(xs, ys)

        # Sequential unwrap so consecutive vertices never jump by > 180 degrees.
        unwrapped = [lons[0]]
        for lon in lons[1:]:
            prev = unwrapped[-1]
            delta = ((lon - prev + 180.0) % 360.0) - 180.0
            unwrapped.append(prev + delta)
        # Shift so the ring sits near the projection centre's longitude.
        mean_lon = sum(unwrapped) / len(unwrapped)
        shift = 360.0 * round((mean_lon - self.lon0) / 360.0)
        unwrapped = [u - shift for u in unwrapped]
        if abs(unwrapped[-1] - unwrapped[0]) > 1e-6:
            raise GeometryError("Ring does not close after longitude unwrapping (does it enclose a pole?)")
        unwrapped[-1] = unwrapped[0]

        ll_poly = Polygon(list(zip(unwrapped, lats)))
        if not ll_poly.is_valid:
            ll_poly = shapely.make_valid(ll_poly)
            ll_poly = _largest_polygon(ll_poly)

        min_lon, min_lat, max_lon, max_lat = ll_poly.bounds
        crosses = min_lon < -180.0 or max_lon > 180.0

        pieces: list[Polygon] = []
        for offset in (-360.0, 0.0, 360.0):
            window = box(-180.0 - offset, -90.0, 180.0 - offset, 90.0)
            part = ll_poly.intersection(window)
            for p in _polygons_of(part):
                pieces.append(affinity.translate(p, xoff=offset))

        pieces = [orient(_round_polygon(p), 1.0) for p in pieces if p.area > 0]
        if not pieces:
            raise GeometryError("Polygon vanished during antimeridian handling")
        for p in pieces:
            _validate_lonlat_polygon(p)

        if len(pieces) == 1:
            geometry = {"type": "Polygon", "coordinates": _poly_coords(pieces[0])}
        else:
            mp = MultiPolygon(pieces)
            if not mp.is_valid:
                raise GeometryError("Antimeridian split produced an invalid MultiPolygon")
            geometry = {"type": "MultiPolygon", "coordinates": [_poly_coords(p) for p in pieces]}

        west = normalize_longitude(min_lon)
        east = normalize_longitude(max_lon)
        info = {
            "crosses_antimeridian": crosses,
            "bounds": {
                "min_lat": round(min_lat, C.COORD_DECIMALS),
                "min_lon": round(west, C.COORD_DECIMALS),
                "max_lat": round(max_lat, C.COORD_DECIMALS),
                "max_lon": round(east, C.COORD_DECIMALS),
            },
        }
        return geometry, info


# --- helpers -------------------------------------------------------------------

def _polygons_of(geom) -> list[Polygon]:
    if geom.is_empty:
        return []
    if isinstance(geom, Polygon):
        return [geom]
    if hasattr(geom, "geoms"):
        out: list[Polygon] = []
        for g in geom.geoms:
            out.extend(_polygons_of(g))
        return out
    return []


def _largest_polygon(geom) -> Polygon:
    polys = _polygons_of(geom)
    if not polys:
        raise GeometryError("Polygon could not be repaired")
    return max(polys, key=lambda p: p.area)


def _round_polygon(p: Polygon) -> Polygon:
    def rnd(coords):
        return [(round(x, C.COORD_DECIMALS), round(y, C.COORD_DECIMALS)) for x, y in coords]

    rounded = Polygon(rnd(p.exterior.coords), [rnd(r.coords) for r in p.interiors])
    if not rounded.is_valid:
        rounded = _largest_polygon(shapely.make_valid(rounded))
    return rounded


def _validate_lonlat_polygon(p: Polygon) -> None:
    coords = list(p.exterior.coords)
    if len(coords) < 4 or coords[0] != coords[-1]:
        raise GeometryError("Output ring is not closed")
    for lon, lat in coords:
        if not (math.isfinite(lon) and math.isfinite(lat)):
            raise GeometryError("Output polygon contains non-finite coordinates")
        if not (-180.0 <= lon <= 180.0 and -90.0 <= lat <= 90.0):
            raise GeometryError("Output polygon contains out-of-range coordinates")
    if not p.is_valid:
        raise GeometryError("Output polygon is not valid")


def _poly_coords(p: Polygon) -> list:
    rings = [p.exterior] + list(p.interiors)
    return [[[x, y] for x, y in ring.coords] for ring in rings]
