def test_root(client):
    r = client.get("/")
    assert r.status_code == 200
    body = r.json()
    assert body["name"] == "SkyTrace AI"
    assert body["status"] == "ok"
    assert body["version"] and body["description"]


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}
    assert r.headers.get("X-Request-ID")


def test_docs_and_openapi_available(client):
    assert client.get("/docs").status_code == 200
    assert client.get("/redoc").status_code == 200
    spec = client.get("/openapi.json").json()
    assert "/api/v1/analyze" in spec["paths"]


def test_unknown_route_uses_error_envelope(client):
    r = client.get("/does-not-exist")
    assert r.status_code == 404
    assert r.json()["status"] == "error"
    assert r.json()["error"]["code"] == "HTTP_ERROR"


def test_cors_preflight_allows_vite_origin(client):
    r = client.options(
        "/api/v1/analyze",
        headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST"},
    )
    assert r.status_code == 200
    assert r.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_cors_origin_parsing():
    from app.core.config import parse_cors_origins

    assert parse_cors_origins(" http://a.test , ,http://b.test/,http://a.test") == ["http://a.test", "http://b.test"]
    assert parse_cors_origins("") == []
    assert parse_cors_origins(None) == ["http://localhost:5173", "http://127.0.0.1:5173"]
