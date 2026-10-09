"""Combined mode: the backend serves the built React app from one origin."""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings, parse_bool
from app.main import create_app
from tests.conftest import make_payload


@pytest.fixture()
def dist(tmp_path: Path) -> Path:
    d = tmp_path / "dist"
    (d / "assets").mkdir(parents=True)
    (d / "index.html").write_text("<!doctype html><title>SkyTrace AI</title><div id=root></div>", encoding="utf-8")
    (d / "assets" / "app.js").write_text("console.log('ok')", encoding="utf-8")
    return d


def _client(**kwargs) -> TestClient:
    return TestClient(create_app(Settings(**kwargs)))


def test_combined_mode_serves_ui_and_keeps_api(dist):
    c = _client(serve_frontend=True, frontend_dist=dist)
    root = c.get("/")
    assert root.status_code == 200
    assert "text/html" in root.headers["content-type"]
    assert "SkyTrace AI" in root.text
    asset = c.get("/assets/app.js")
    assert asset.status_code == 200 and "javascript" in asset.headers["content-type"]
    # API, health, docs keep priority over the static mount.
    assert c.get("/health").json() == {"status": "ok"}
    assert c.get("/api/v1/info").json()["frontend_served"] is True
    assert c.get("/docs").status_code == 200
    r = c.post("/api/v1/analyze", json=make_payload())
    assert r.status_code == 200 and r.json()["status"] == "success"
    # Errors keep the structured envelope.
    bad = c.post("/api/v1/analyze", json=make_payload(heading_degrees=400))
    assert bad.status_code == 422 and bad.json()["error"]["code"] == "VALIDATION_ERROR"
    missing = c.get("/no-such-file.js")
    assert missing.status_code == 404 and missing.json()["status"] == "error"


def test_api_only_mode_root_is_json(dist):
    c = _client(serve_frontend=False, frontend_dist=dist)
    body = c.get("/").json()
    assert body["name"] == "SkyTrace AI" and body["frontend_served"] is False
    assert c.get("/api/v1/info").json()["name"] == "SkyTrace AI"


def test_missing_build_falls_back_to_api_only(tmp_path):
    c = _client(serve_frontend=True, frontend_dist=tmp_path / "does-not-exist")
    assert c.get("/").json()["name"] == "SkyTrace AI"
    assert c.get("/health").status_code == 200


@pytest.mark.parametrize("raw,expected", [("1", True), ("true", True), (" Yes ", True), ("0", False), ("", False), (None, False)])
def test_parse_bool(raw, expected):
    assert parse_bool(raw) is expected
