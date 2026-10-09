import pytest
from shapely.geometry import shape

from app.schemas.requests import AnalysisRequest
from app.services.coordinate_service import LocalProjection
from app.services.grid_service import build_grid
from app.services.scenario_service import build_scenarios
from app.services.search_region_service import build_search_region
from tests.conftest import make_payload


def _grid(**overrides):
    req = AnalysisRequest.model_validate(make_payload(**overrides))
    proj = LocalProjection(req.last_known_position.latitude, req.last_known_position.longitude)
    scen = build_scenarios(req, proj)
    region = build_search_region(req, proj, scen)
    return build_grid(proj, region, scen, req.grid_size)


@pytest.mark.parametrize("n", [3, 5, 15])
def test_grid_dimensions_match_request(n):
    g = _grid(grid_size=n)
    assert g["rows"] == g["columns"] == n
    assert len(g["cells"]) == n * n
    assert [(c["row"], c["column"]) for c in g["cells"]] == [(r, c) for r in range(n) for c in range(n)]
    assert g["cells"][0]["cell_id"] == "r0c0"


def test_row_order_north_to_south_and_columns_west_to_east():
    g = _grid(grid_size=5)
    cells = {(c["row"], c["column"]): c for c in g["cells"]}
    assert cells[(0, 2)]["centre_latitude"] > cells[(4, 2)]["centre_latitude"]
    assert cells[(2, 0)]["centre_longitude"] < cells[(2, 4)]["centre_longitude"]


def test_scores_in_range_deterministic_and_normalised():
    a, b = _grid(), _grid()
    sa = [c["illustrative_relative_demo_score"] for c in a["cells"]]
    assert sa == [c["illustrative_relative_demo_score"] for c in b["cells"]]
    assert all(0.0 <= s <= 1.0 for s in sa)
    assert max(sa) == 1.0 and min(sa) == 0.0
    assert a["score_type"] == "illustrative_relative_demo_score"
    assert "NOT probabilities" in a["score_description"]


def test_cells_outside_region_score_zero():
    g = _grid(grid_size=9)
    outside = [c for c in g["cells"] if not c["intersects_region"]]
    assert outside, "a sector-shaped region should leave some corner cells outside"
    assert all(c["illustrative_relative_demo_score"] == 0.0 for c in outside)


def test_zero_distance_grid_valid():
    g = _grid(elapsed_minutes=0.0, grid_size=3)
    scores = [c["illustrative_relative_demo_score"] for c in g["cells"]]
    assert all(0.0 <= s <= 1.0 for s in scores)
    # Centre cell sits on the last known position: highest raw value.
    assert g["cells"][4]["illustrative_relative_demo_score"] == 1.0


def test_cell_geometry_valid_and_size_reported():
    g = _grid(grid_size=4)
    assert g["cell_size_nm"]["width_nm"] > 0 and g["cell_size_nm"]["height_nm"] > 0
    for c in g["cells"]:
        assert shape(c["geometry"]).is_valid
        assert -90 <= c["centre_latitude"] <= 90 and -180 <= c["centre_longitude"] <= 180


def test_antimeridian_grid_valid():
    g = _grid(last_known_position={"latitude": 5.0, "longitude": 179.8}, heading_degrees=90.0, grid_size=5)
    for c in g["cells"]:
        assert shape(c["geometry"]).is_valid
        assert -180 <= c["centre_longitude"] <= 180
