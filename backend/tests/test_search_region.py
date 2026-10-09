import math

import pytest
from shapely.geometry import Point, shape

from app.core.exceptions import GeometryError
from app.schemas.requests import AnalysisRequest
from app.services.coordinate_service import LocalProjection
from app.services.scenario_service import build_scenarios
from app.services.search_region_service import arc_headings, build_search_region
from tests.conftest import make_payload


def _region(**overrides):
    req = AnalysisRequest.model_validate(make_payload(**overrides))
    proj = LocalProjection(req.last_known_position.latitude, req.last_known_position.longitude)
    scen = build_scenarios(req, proj)
    return req, scen, build_search_region(req, proj, scen)


def _rings(geometry):
    polys = [geometry["coordinates"]] if geometry["type"] == "Polygon" else geometry["coordinates"]
    return [ring for poly in polys for ring in poly]


def _assert_valid_feature(feature):
    geom = feature["geometry"]
    assert geom["type"] in ("Polygon", "MultiPolygon")
    assert shape(geom).is_valid
    for ring in _rings(geom):
        assert len(ring) >= 4 and ring[0] == ring[-1]
        for lon, lat in ring:
            assert math.isfinite(lon) and math.isfinite(lat)
            assert -180 <= lon <= 180 and -90 <= lat <= 90


def test_arc_headings_cover_range_with_step():
    hs = arc_headings(45, 10)
    assert hs[0] == pytest.approx(35) and hs[-1] == pytest.approx(55)
    assert all(b - a <= 5.0 + 1e-9 for a, b in zip(hs, hs[1:]))
    assert arc_headings(45, 0) == [45]


def test_default_region_valid_and_contains_key_points():
    req, scen, region = _region()
    _assert_valid_feature(region.feature)
    poly = shape(region.feature["geometry"])
    lkp = req.last_known_position
    assert poly.contains(Point(lkp.longitude, lkp.latitude))
    for s in scen.region_scenarios:
        assert poly.contains(Point(s.endpoint.lon, s.endpoint.lat))
    props = region.feature["properties"]
    assert props["label"] == "Illustrative search region"
    assert props["buffer_nm_applied"] == 10.0
    assert props["included_scenarios"] == ["baseline", "heading_minus", "heading_plus"]
    assert props["area_sq_nm"] > 0
    b = props["bounds"]
    assert b["min_lat"] < b["max_lat"] and b["min_lon"] < b["max_lon"]


def test_geojson_order_is_lon_lat():
    # Start at lat 14.5, lon 88.2; first coordinate of each vertex must be near the longitude.
    _, _, region = _region()
    ring = _rings(region.feature["geometry"])[0]
    assert all(80 < lon < 100 and 5 < lat < 25 for lon, lat in ring)


def test_buffer_rule_uses_max():
    _, _, region = _region(position_uncertainty_nm=30.0, search_region_buffer_nm=10.0)
    assert region.feature["properties"]["buffer_nm_applied"] == 30.0


def test_zero_distance_still_valid_polygon():
    _, _, region = _region(elapsed_minutes=0.0)
    _assert_valid_feature(region.feature)
    # circle of radius 10 nm: area ~ pi * 100
    assert region.feature["properties"]["area_sq_nm"] == pytest.approx(math.pi * 100, rel=0.01)


def test_degenerate_zero_buffer_gets_minimum_and_warning():
    _, _, region = _region(
        heading_uncertainty_degrees=0.0, position_uncertainty_nm=0.0, search_region_buffer_nm=0.0
    )
    _assert_valid_feature(region.feature)
    assert region.feature["properties"]["buffer_nm_applied"] == 0.5
    assert any("minimum buffer" in w for w in region.warnings)


def test_zero_buffer_nondegenerate_sector_is_unbuffered():
    _, _, region = _region(position_uncertainty_nm=0.0, search_region_buffer_nm=0.0)
    _assert_valid_feature(region.feature)
    assert region.feature["properties"]["buffer_nm_applied"] == 0.0


@pytest.mark.parametrize("lon,heading", [(179.5, 90.0), (-179.5, 270.0), (179.9, 270.0)])
def test_antimeridian_regions_valid(lon, heading):
    _, scen, region = _region(last_known_position={"latitude": -10.0, "longitude": lon}, heading_degrees=heading)
    _assert_valid_feature(region.feature)
    props = region.feature["properties"]
    assert props["crosses_antimeridian"] is True
    assert region.feature["geometry"]["type"] == "MultiPolygon"
    assert props["bounds"]["min_lon"] > props["bounds"]["max_lon"]
    assert -180 <= scen.baseline.endpoint.lon <= 180


@pytest.mark.parametrize("lat", [70.0, 75.0, 80.0])
def test_high_latitude_region_valid(lat):
    _, scen, region = _region(last_known_position={"latitude": lat, "longitude": 15.0}, heading_degrees=60.0)
    _assert_valid_feature(region.feature)
    assert scen.baseline.endpoint.lat > lat


def test_region_reaching_pole_rejected():
    with pytest.raises(GeometryError):
        _region(
            last_known_position={"latitude": 85.0, "longitude": 0.0},
            heading_degrees=0.0,
            ground_speed_knots=400.0,
            elapsed_minutes=60.0,
        )
