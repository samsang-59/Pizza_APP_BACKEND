import json
import math

import pytest
from shapely.geometry import Point, shape

from app.core.constants import FORBIDDEN_PHRASES
from app.services.coordinate_service import GEOD
from tests.conftest import make_payload

URL = "/api/v1/analyze"


def _analyze(client, **overrides):
    r = client.post(URL, json=make_payload(**overrides))
    assert r.status_code == 200, r.text
    return r.json()


def _walk_numbers(obj):
    if isinstance(obj, dict):
        for v in obj.values():
            yield from _walk_numbers(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from _walk_numbers(v)
    elif isinstance(obj, float):
        yield obj


def _rings(geometry):
    polys = [geometry["coordinates"]] if geometry["type"] == "Polygon" else geometry["coordinates"]
    return [ring for poly in polys for ring in poly]


def test_demo_scenario_is_valid_and_analyzes(client):
    demo = client.get("/api/v1/demo-scenario").json()
    r = client.post(URL, json=demo)
    assert r.status_code == 200, r.text
    body = r.json()
    # Over water in the Bay of Bengal.
    lkp = demo["last_known_position"]
    assert 5 < lkp["latitude"] < 22 and 80 < lkp["longitude"] < 95
    assert body["grid"]["rows"] == demo["grid_size"]


def test_aircraft_profiles(client):
    body = client.get("/api/v1/aircraft-profiles").json()
    assert {p["aircraft_type"] for p in body["profiles"]} == {"generic_light_aircraft", "generic_turboprop", "generic_jet"}
    assert body["affects_calculations"] is False
    assert "NOT aircraft-specific" in body["note"]


def test_methodology(client):
    body = client.get("/api/v1/methodology").json()
    assert body["steps"] and body["limitations"] and body["assumptions"] and body["disclaimer"]


def test_response_contract(client):
    body = _analyze(client)
    for key in (
        "schema_version", "analysis_id", "status", "input_summary", "baseline", "scenarios", "search_region",
        "grid", "fuel_context", "wind_context", "explanation", "assumptions", "warnings", "disclaimer",
    ):
        assert key in body
    assert body["status"] == "success"
    assert body["baseline"]["interpretation"] == "ground track"
    assert body["input_summary"]["ground_speed_knots"] == {"value": 240.0, "units": "knots (ground speed)"}
    assert body["search_region"]["type"] == "Feature"
    assert body["search_region"]["properties"]["label"] == "Illustrative search region"


def test_distance_formula_and_geod_crosscheck(client):
    body = _analyze(client, ground_speed_knots=300.0, elapsed_minutes=90.0, heading_degrees=212.0)
    assert body["baseline"]["distance_nm"] == pytest.approx(450.0)
    ref_lon, ref_lat, _ = GEOD.fwd(88.2, 14.5, 212.0, 450.0 * 1852.0)
    end = body["baseline"]["endpoint"]
    _, _, err = GEOD.inv(end["longitude"], end["latitude"], ref_lon, ref_lat)
    assert err < 50.0


def test_zero_elapsed(client):
    body = _analyze(client, elapsed_minutes=0.0)
    assert body["baseline"]["distance_nm"] == 0
    assert body["baseline"]["endpoint"] == {"latitude": 14.5, "longitude": 88.2}
    assert shape(body["search_region"]["geometry"]).is_valid


def test_heading_zero_north_and_ninety_east(client):
    north = _analyze(client, heading_degrees=0.0)["baseline"]["endpoint"]
    assert north["latitude"] > 14.5 and north["longitude"] == pytest.approx(88.2, abs=1e-6)
    east = _analyze(client, heading_degrees=90.0)["baseline"]["endpoint"]
    assert east["longitude"] > 88.2 and abs(east["latitude"] - 14.5) < 0.1


def test_output_coordinates_in_bounds_and_lon_lat_order(client):
    body = _analyze(client)
    for ring in _rings(body["search_region"]["geometry"]):
        assert ring[0] == ring[-1]
        for lon, lat in ring:
            assert -180 <= lon <= 180 and -90 <= lat <= 90
            # [lon, lat] ordering: lon near 88, lat near 15 for this input
            assert 80 < lon < 100 and 5 < lat < 25
    for s in body["scenarios"]:
        assert -90 <= s["endpoint"]["latitude"] <= 90 and -180 <= s["endpoint"]["longitude"] <= 180
    region = shape(body["search_region"]["geometry"])
    assert region.is_valid
    assert region.contains(Point(88.2, 14.5))


def test_antimeridian_end_to_end(client):
    for lon, heading in ((179.7, 90.0), (-179.7, 270.0)):
        body = _analyze(client, last_known_position={"latitude": -16.0, "longitude": lon}, heading_degrees=heading)
        geom = body["search_region"]["geometry"]
        assert geom["type"] == "MultiPolygon"
        assert shape(geom).is_valid
        for ring in _rings(geom):
            assert all(-180 <= x <= 180 for x, _ in ring)
        end = body["baseline"]["endpoint"]["longitude"]
        assert -180 <= end <= 180
        assert (end < 0) if lon > 0 else (end > 0)  # crossed the antimeridian
        assert any("antimeridian" in w for w in body["warnings"])


def test_high_latitude_end_to_end(client):
    body = _analyze(client, last_known_position={"latitude": 78.0, "longitude": 15.0}, heading_degrees=270.0)
    assert shape(body["search_region"]["geometry"]).is_valid
    assert body["baseline"]["endpoint"]["longitude"] < 15.0


def test_grid_size_and_scores(client):
    a = _analyze(client, grid_size=8)
    b = _analyze(client, grid_size=8)
    assert a["grid"]["rows"] == a["grid"]["columns"] == 8 and len(a["grid"]["cells"]) == 64
    sa = [c["illustrative_relative_demo_score"] for c in a["grid"]["cells"]]
    assert sa == [c["illustrative_relative_demo_score"] for c in b["grid"]["cells"]]
    assert all(0 <= s <= 1 for s in sa)


def test_analysis_id_deterministic(client):
    a, b = _analyze(client), _analyze(client)
    assert a["analysis_id"] == b["analysis_id"]
    assert a == b
    c = _analyze(client, heading_degrees=46.0)
    assert c["analysis_id"] != a["analysis_id"]
    # defaults are included in the canonical form: explicit default == omitted default
    payload = make_payload()
    del payload["grid_size"]
    assert client.post(URL, json=payload).json()["analysis_id"] == a["analysis_id"]


def test_fuel_context(client):
    fc = _analyze(client, fuel_remaining_percent=5.0)["fuel_context"]
    assert fc["endurance_minutes"] is None
    assert fc["affects_geometry"] is False
    assert "insufficient" in fc["explanation"]
    # fuel does not change geometry
    a = _analyze(client, fuel_remaining_percent=5.0)["search_region"]["geometry"]
    b = _analyze(client, fuel_remaining_percent=95.0)["search_region"]["geometry"]
    assert a == b


def test_wind_not_double_counted(client):
    calm = _analyze(client, wind={"speed_knots": 0.0, "direction_from_degrees": 0.0})
    gale = _analyze(client, wind={"speed_knots": 120.0, "direction_from_degrees": 45.0})
    assert calm["baseline"] == gale["baseline"]
    assert calm["search_region"]["geometry"] == gale["search_region"]["geometry"]
    wc = gale["wind_context"]
    assert wc["applied_to_baseline"] is False
    assert wc["direction_toward_degrees"] == 225.0
    assert wc["limitations"]
    assert "hypothetical_wind_drift" not in gale["search_region"]["properties"]["included_scenarios"]


def test_assumptions_and_warnings_nonempty(client):
    body = _analyze(client)
    assert body["assumptions"] and body["warnings"]
    joined = " ".join(body["warnings"]).lower()
    for needle in ("land/water", "ground track", "fuel", "illustrative", "not probabilities"):
        assert needle in joined


def test_no_forbidden_phrases_anywhere(client):
    texts = [
        client.post(URL, json=make_payload()).text,
        client.get("/api/v1/methodology").text,
        client.get("/api/v1/aircraft-profiles").text,
        client.get("/").text,
    ]
    for t in texts:
        lowered = t.lower()
        for phrase in FORBIDDEN_PHRASES:
            assert phrase not in lowered, phrase


@pytest.mark.parametrize(
    "overrides",
    [
        {},
        {"elapsed_minutes": 0.0},
        {"heading_uncertainty_degrees": 0.0, "position_uncertainty_nm": 0.0, "search_region_buffer_nm": 0.0},
        {"ground_speed_knots": 0.0, "wind": {"speed_knots": 0.0}},
        {"last_known_position": {"latitude": 0.0, "longitude": 180.0}, "heading_degrees": 90.0},
        {"ground_speed_knots": 500.0, "elapsed_minutes": 600.0, "grid_size": 15},
    ],
)
def test_no_nan_or_infinity_in_response(client, overrides):
    r = client.post(URL, json=make_payload(**overrides))
    assert r.status_code == 200, r.text
    assert "NaN" not in r.text and "Infinity" not in r.text
    body = json.loads(r.text, parse_constant=lambda c: pytest.fail(f"non-finite constant {c}"))
    assert all(math.isfinite(x) for x in _walk_numbers(body))
