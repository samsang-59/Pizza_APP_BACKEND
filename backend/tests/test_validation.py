import pytest

from tests.conftest import make_payload

URL = "/api/v1/analyze"


def _assert_validation_error(r, field_fragment=None):
    assert r.status_code == 422, r.text
    body = r.json()
    assert body["status"] == "error"
    assert body["error"]["code"] == "VALIDATION_ERROR"
    assert body["error"]["message"]
    details = body["error"]["details"]
    assert isinstance(details, list) and details
    for d in details:
        assert {"field", "loc", "message", "type"} <= d.keys()
    if field_fragment:
        assert any(field_fragment in d["field"] for d in details), details
    assert "Traceback" not in r.text
    return details


@pytest.mark.parametrize(
    "overrides,field",
    [
        ({"last_known_position": {"latitude": 91.0}}, "latitude"),
        ({"last_known_position": {"latitude": -95.0}}, "latitude"),
        ({"last_known_position": {"longitude": 180.5}}, "longitude"),
        ({"last_known_position": {"longitude": -200.0}}, "longitude"),
        ({"heading_degrees": 360.0}, "heading_degrees"),
        ({"heading_degrees": -1.0}, "heading_degrees"),
        ({"heading_degrees": True}, "heading_degrees"),
        ({"heading_degrees": "90"}, "heading_degrees"),
        ({"ground_speed_knots": -5.0}, "ground_speed_knots"),
        ({"ground_speed_knots": 701.0}, "ground_speed_knots"),
        ({"elapsed_minutes": -1.0}, "elapsed_minutes"),
        ({"elapsed_minutes": 1441.0}, "elapsed_minutes"),
        ({"wind": {"speed_knots": -1.0}}, "wind.speed_knots"),
        ({"wind": {"speed_knots": 250.0}}, "wind.speed_knots"),
        ({"wind": {"direction_from_degrees": 360.0}}, "wind.direction_from_degrees"),
        ({"wind": {"direction_from_degrees": -10.0}}, "wind.direction_from_degrees"),
        ({"fuel_remaining_percent": -0.1}, "fuel_remaining_percent"),
        ({"fuel_remaining_percent": 100.1}, "fuel_remaining_percent"),
        ({"grid_size": 2}, "grid_size"),
        ({"grid_size": 16}, "grid_size"),
        ({"grid_size": 5.5}, "grid_size"),
        ({"position_uncertainty_nm": 101.0}, "position_uncertainty_nm"),
        ({"heading_uncertainty_degrees": 46.0}, "heading_uncertainty_degrees"),
        ({"search_region_buffer_nm": -1.0}, "search_region_buffer_nm"),
        ({"aircraft_type": "boeing_747"}, "aircraft_type"),
        ({"unexpected_field": 1}, "unexpected_field"),
    ],
)
def test_out_of_range_rejected(client, overrides, field):
    _assert_validation_error(client.post(URL, json=make_payload(**overrides)), field)


@pytest.mark.parametrize("literal", ["NaN", "Infinity", "-Infinity"])
def test_nan_and_infinity_rejected(client, literal):
    import json

    raw = json.dumps(make_payload(heading_degrees=0.0)).replace('"heading_degrees": 0.0', f'"heading_degrees": {literal}')
    assert literal in raw
    r = client.post(URL, content=raw, headers={"Content-Type": "application/json"})
    details = _assert_validation_error(r, "heading_degrees")
    assert any(d["type"] == "finite_number" for d in details)


@pytest.mark.parametrize("lat", [89.5, -89.01, 90.0])
def test_polar_latitude_rejected_with_clear_message(client, lat):
    r = client.post(URL, json=make_payload(last_known_position={"latitude": lat}))
    details = _assert_validation_error(r, "latitude")
    assert any("polar" in d["message"] for d in details)


def test_latitude_89_accepted_when_region_clear_of_pole(client):
    r = client.post(
        URL,
        json=make_payload(last_known_position={"latitude": -89.0}, heading_degrees=0.0, elapsed_minutes=20.0, ground_speed_knots=120.0),
    )
    assert r.status_code == 200, r.text


def test_distance_over_cap_rejected(client):
    r = client.post(URL, json=make_payload(ground_speed_knots=700.0, elapsed_minutes=600.0))
    details = _assert_validation_error(r)
    assert any("5000" in d["message"] for d in details)


def test_distance_at_cap_accepted(client):
    r = client.post(URL, json=make_payload(ground_speed_knots=500.0, elapsed_minutes=600.0))
    assert r.status_code == 200, r.text


def test_missing_field_and_malformed_json(client):
    payload = make_payload()
    del payload["heading_degrees"]
    _assert_validation_error(client.post(URL, json=payload), "heading_degrees")
    r = client.post(URL, content="{not json", headers={"Content-Type": "application/json"})
    _assert_validation_error(r)


def test_region_reaching_pole_is_structured_geometry_error(client):
    r = client.post(
        URL,
        json=make_payload(last_known_position={"latitude": 85.0}, heading_degrees=0.0, ground_speed_knots=400.0, elapsed_minutes=60.0),
    )
    assert r.status_code == 422
    assert r.json()["status"] == "error"
    assert r.json()["error"]["code"] == "GEOMETRY_ERROR"


def test_internal_error_is_structured_without_stack_trace(client, monkeypatch):
    import app.api.routes as routes

    def boom(_req):
        raise RuntimeError("secret internal detail")

    monkeypatch.setattr(routes, "run_analysis", boom)
    r = client.post(URL, json=make_payload())
    assert r.status_code == 500
    body = r.json()
    assert body == {"status": "error", "error": {"code": "INTERNAL_ERROR", "message": "An internal error occurred.", "details": []}}
    assert "secret" not in r.text and "Traceback" not in r.text
