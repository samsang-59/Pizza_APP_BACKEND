import pytest

from app.services.coordinate_service import GEOD, LocalProjection
from app.services.flight_model import baseline_distance_nm, project_endpoint


@pytest.mark.parametrize("speed,minutes,expected", [(120, 30, 60), (0, 600, 0), (450, 0, 0), (480, 90, 720)])
def test_distance_formula(speed, minutes, expected):
    assert baseline_distance_nm(speed, minutes) == pytest.approx(expected)


def test_zero_distance_endpoint_is_start():
    proj = LocalProjection(12.3, 45.6)
    e = project_endpoint(proj, 0.0, 123.0)
    assert (e.lat, e.lon) == (12.3, 45.6)


def test_heading_zero_moves_north():
    proj = LocalProjection(10.0, 80.0)
    e = project_endpoint(proj, 60.0, 0.0)
    assert e.lat > 10.0
    assert e.lon == pytest.approx(80.0, abs=1e-9)
    assert e.lat == pytest.approx(11.0, abs=0.01)  # 60 nm ~ 1 degree of latitude


def test_heading_ninety_moves_east():
    proj = LocalProjection(10.0, 80.0)
    e = project_endpoint(proj, 60.0, 90.0)
    assert e.lon > 80.0
    assert abs(e.lat - 10.0) < 0.05  # a geodesic heading east drifts slightly equatorward


@pytest.mark.parametrize(
    "lat,lon,heading,dist_nm",
    [(15, 88, 37, 400), (-12.5, 65.2, 300, 1200), (72, -20, 135, 900), (0, 0, 225, 5000), (-45, 179.9, 90, 250)],
)
def test_matches_pyproj_geod_forward(lat, lon, heading, dist_nm):
    proj = LocalProjection(lat, lon)
    e = project_endpoint(proj, dist_nm, heading)
    ref_lon, ref_lat, _ = GEOD.fwd(lon, lat, heading, dist_nm * 1852.0)
    _, _, err_m = GEOD.inv(e.lon, e.lat, ref_lon, ref_lat)
    assert err_m < 50.0
    assert -180 <= e.lon <= 180 and -90 <= e.lat <= 90
