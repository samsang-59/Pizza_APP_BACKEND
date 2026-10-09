import copy

import pytest
from fastapi.testclient import TestClient

BASE_PAYLOAD = {
    "last_known_position": {"latitude": 14.5, "longitude": 88.2},
    "heading_degrees": 45.0,
    "ground_speed_knots": 240.0,
    "elapsed_minutes": 45.0,
    "wind": {"speed_knots": 20.0, "direction_from_degrees": 270.0},
    "aircraft_type": "generic_turboprop",
    "fuel_remaining_percent": 35.0,
    "position_uncertainty_nm": 5.0,
    "heading_uncertainty_degrees": 10.0,
    "grid_size": 5,
    "search_region_buffer_nm": 10.0,
}


def make_payload(**overrides):
    payload = copy.deepcopy(BASE_PAYLOAD)
    for key, value in overrides.items():
        if isinstance(value, dict) and isinstance(payload.get(key), dict):
            payload[key].update(value)
        else:
            payload[key] = value
    return payload


@pytest.fixture(scope="session")
def client():
    from app.main import app

    with TestClient(app) as c:
        yield c
