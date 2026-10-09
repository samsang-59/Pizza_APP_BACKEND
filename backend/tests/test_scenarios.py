import pytest

from app.schemas.requests import AnalysisRequest
from app.services.coordinate_service import LocalProjection
from app.services.scenario_service import build_scenarios
from tests.conftest import make_payload


def _build(**overrides):
    req = AnalysisRequest.model_validate(make_payload(**overrides))
    proj = LocalProjection(req.last_known_position.latitude, req.last_known_position.longitude)
    return build_scenarios(req, proj)


def test_default_scenarios_present_and_deterministic():
    a, b = _build(), _build()
    ids = [s.scenario_id for s in a.scenarios]
    assert ids == ["baseline", "heading_minus", "heading_plus", "heading_minus_2x", "heading_plus_2x", "hypothetical_wind_drift"]
    assert [(s.endpoint.lat, s.endpoint.lon) for s in a.scenarios] == [(s.endpoint.lat, s.endpoint.lon) for s in b.scenarios]


def test_heading_scenarios_use_offsets_and_same_distance():
    s = {x.scenario_id: x for x in _build(heading_degrees=5.0, heading_uncertainty_degrees=10.0).scenarios}
    assert s["heading_minus"].heading_degrees_used == pytest.approx(355.0)
    assert s["heading_plus"].heading_degrees_used == pytest.approx(15.0)
    assert s["heading_minus_2x"].heading_degrees_used == pytest.approx(345.0)
    for sid in ("heading_minus", "heading_plus", "heading_minus_2x", "heading_plus_2x"):
        assert s[sid].distance_nm == pytest.approx(s["baseline"].distance_nm)
        assert 0 <= s[sid].heading_degrees_used < 360
        assert s[sid].offset_from_baseline_nm > 0


def test_offset_geodesic_matches_chord():
    # Endpoints at the same distance d, separated by angle u: chord ~ 2 d sin(u/2).
    import math

    s = {x.scenario_id: x for x in _build(heading_uncertainty_degrees=10.0).scenarios}
    d = s["baseline"].distance_nm
    assert s["heading_plus"].offset_from_baseline_nm == pytest.approx(2 * d * math.sin(math.radians(5)), rel=0.01)


def test_outer_offset_is_capped():
    res = _build(heading_uncertainty_degrees=40.0, heading_degrees=100.0)
    s = {x.scenario_id: x for x in res.scenarios}
    assert s["heading_plus_2x"].heading_degrees_used == pytest.approx(160.0)
    assert any("cap" in w for w in res.warnings)


def test_zero_uncertainty_skips_duplicates_and_warns():
    res = _build(heading_uncertainty_degrees=0.0)
    ids = [s.scenario_id for s in res.scenarios]
    assert "heading_minus" not in ids and "heading_plus" not in ids
    assert any("uncertainty is 0" in w for w in res.warnings)


def test_zero_elapsed_gives_only_baseline_at_start():
    res = _build(elapsed_minutes=0.0)
    assert [s.scenario_id for s in res.scenarios] == ["baseline"]
    assert res.baseline.distance_nm == 0
    assert (res.baseline.endpoint.lat, res.baseline.endpoint.lon) == (14.5, 88.2)


def test_wind_never_changes_baseline():
    a = _build(wind={"speed_knots": 0.0, "direction_from_degrees": 0.0}).baseline
    b = _build(wind={"speed_knots": 150.0, "direction_from_degrees": 123.0}).baseline
    assert (a.endpoint.lat, a.endpoint.lon, a.distance_nm) == (b.endpoint.lat, b.endpoint.lon, b.distance_nm)


def test_hypothetical_wind_drift_is_labelled_and_not_in_region():
    res = _build(wind={"speed_knots": 40.0, "direction_from_degrees": 270.0}, heading_degrees=0.0)
    s = {x.scenario_id: x for x in res.scenarios}["hypothetical_wind_drift"]
    assert s.scenario_type == "wind_sensitivity_hypothetical"
    assert s.included_in_region is False
    assert "HYPOTHETICAL" in s.description
    # wind FROM 270 pushes toward east: endpoint east of baseline, offset = 40 kt * 0.75 h = 30 nm
    assert s.endpoint.lon > res.baseline.endpoint.lon
    assert s.offset_from_baseline_nm == pytest.approx(30.0, rel=0.01)


def test_region_membership():
    res = _build()
    assert {s.scenario_id for s in res.region_scenarios} == {"baseline", "heading_minus", "heading_plus"}
