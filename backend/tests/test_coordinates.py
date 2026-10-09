import math

import pytest
from shapely.geometry import Point, Polygon, shape

from app.core.exceptions import GeometryError
from app.services.coordinate_service import (
    LocalProjection,
    m_to_nm,
    nm_to_m,
    normalize_heading,
    normalize_longitude,
)


def test_nm_conversion_exact():
    assert nm_to_m(1) == 1852.0
    assert m_to_nm(1852.0) == 1.0


@pytest.mark.parametrize(
    "lon,expected",
    [(0, 0), (180, 180), (-180, -180), (181, -179), (-181, 179), (540, 180), (359.5, -0.5)],
)
def test_normalize_longitude(lon, expected):
    assert normalize_longitude(lon) == pytest.approx(expected)


@pytest.mark.parametrize("deg,expected", [(0, 0), (360, 0), (-10, 350), (725, 5), (-0.0, 0)])
def test_normalize_heading(deg, expected):
    out = normalize_heading(deg)
    assert out == pytest.approx(expected)
    assert 0 <= out < 360


def test_projection_roundtrip_centre_is_origin():
    proj = LocalProjection(15.0, 88.0)
    x, y = proj.to_xy(88.0, 15.0)
    assert abs(x) < 1e-6 and abs(y) < 1e-6
    lon, lat = proj.to_lonlat(100_000, -50_000)
    x2, y2 = proj.to_xy(lon, lat)
    assert x2 == pytest.approx(100_000, abs=1e-3)
    assert y2 == pytest.approx(-50_000, abs=1e-3)


def test_polygon_across_antimeridian_splits_into_valid_multipolygon():
    proj = LocalProjection(-20.0, 179.8)
    poly = Point(0, 0).buffer(nm_to_m(60), 16)
    geom, info = proj.polygon_to_geojson(poly, 5000)
    assert info["crosses_antimeridian"] is True
    assert geom["type"] == "MultiPolygon"
    assert shape(geom).is_valid
    # RFC 7946 bbox convention: west > east when crossing the antimeridian.
    assert info["bounds"]["min_lon"] > info["bounds"]["max_lon"]
    for polygon in geom["coordinates"]:
        ring = polygon[0]
        assert ring[0] == ring[-1]
        assert Polygon(ring).exterior.is_ccw
        for lon, lat in ring:
            assert -180 <= lon <= 180 and -90 <= lat <= 90
            assert math.isfinite(lon) and math.isfinite(lat)


def test_polygon_not_crossing_is_single_ccw_polygon():
    proj = LocalProjection(15.0, 88.0)
    geom, info = proj.polygon_to_geojson(Point(0, 0).buffer(50_000, 16), 2000)
    assert geom["type"] == "Polygon"
    assert info["crosses_antimeridian"] is False
    ring = geom["coordinates"][0]
    assert ring[0] == ring[-1] and Polygon(ring).exterior.is_ccw


def test_geometry_reaching_pole_rejected():
    proj = LocalProjection(88.0, 0.0)
    with pytest.raises(GeometryError):
        proj.assert_pole_clear(Point(0, 0).buffer(nm_to_m(200)), "search region")
