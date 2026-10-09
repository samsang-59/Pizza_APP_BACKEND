# SkyTrace AI — Backend (prototype)

> **Safety disclaimer.** SkyTrace AI is a hackathon **prototype** for demonstration and education.
> It does **not** locate any real aircraft, does **not** compute operational search-and-rescue
> statistics and must **not** be used for real search planning. Every region, scenario and score
> it returns is an *illustrative*, *hypothetical* sensitivity sketch based on simplified
> assumptions. Real incidents belong to the responsible Rescue Coordination Centre and its
> approved tools.

## Problem and objective

Hackathon Problem 4 (submitted by Aishik):

> *"When contact with an aircraft is lost, the odds of rescuing anyone fall with every hour the
> search area stays vague. Build a tool that takes the last known position and what else is
> known — heading, speed, fuel, winds — and computes and plots the area worth searching, so the
> people flying the search spend their time over water that might hold something."*

This backend takes the last known position, ground track, ground speed, elapsed time, wind,
fuel and a few uncertainty knobs. It returns a transparent, deterministic, **illustrative**
search-area sketch as GeoJSON plus a demo grid, for a React + TypeScript + Leaflet frontend to
draw. The emphasis is on honest geometry and clearly stated limits, not on pretending to know
where an aircraft is.

## Architecture

```
backend/
  app/
    main.py                     FastAPI app: CORS, request logging, error envelope, / and /health
    api/routes.py               /api/v1/* routes (thin)
    schemas/requests.py         Pydantic v2 request model (strict ranges, no NaN/inf, no coercion)
    schemas/responses.py        Response contract (mirrored in docs/frontend_types.ts)
    services/
      coordinate_service.py     Local AEQD projection, lon/lat helpers, antimeridian-safe GeoJSON
      flight_model.py           Straight-line dead reckoning (baseline)
      scenario_service.py       Deterministic heading-sensitivity + hypothetical wind scenarios
      search_region_service.py  Buffered convex hull of the swept sector -> GeoJSON Feature
      grid_service.py           grid_size x grid_size demo grid + illustrative scores
      explanation_service.py    Fuel/wind context, assumptions, warnings, methodology text
      analysis_service.py       Orchestrator + demo scenario + analysis_id
    core/
      config.py                 Env settings (.env supported)
      constants.py              Every limit, default, sampling step and sigma factor
      exceptions.py             ProjectionError / GeometryError -> structured errors
  tests/                        pytest suite (unit + API)
  scripts/export_openapi.py     Writes openapi.json
  docs/frontend_types.ts        TypeScript interfaces + Leaflet rendering notes
```

Request flow: `POST /api/v1/analyze` → Pydantic validation → `LocalProjection` (AEQD centred on
the last known position) → scenarios → search region → grid → explanation text → JSON.

## Tech choices

| Library | Why |
|---|---|
| FastAPI + Uvicorn | Async routes, automatic OpenAPI (`/docs`, `/redoc`), Pydantic integration |
| Pydantic v2 | Declarative ranges, `allow_inf_nan=False`, field-level 422 messages |
| PyProj | Ellipsoidal AEQD projection and `Geod` geodesics (WGS84) |
| Shapely 2.x | Convex hull, buffer, validity checks, antimeridian splitting |
| python-dotenv | Optional `.env` for config |
| pytest + httpx | Tests via FastAPI `TestClient` |

There is no database, auth, task queue or external or paid API. Everything runs offline. NumPy
isn't needed.

## Setup

Requires **Python 3.11+**. Run all commands from the `backend/` directory.

macOS / Linux:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # optional
```

Windows (PowerShell):

```powershell
cd backend
py -3 -m venv .venv
.venv\Scripts\Activate.ps1     # cmd.exe: .venv\Scripts\activate.bat
pip install -r requirements.txt
copy .env.example .env         # optional
```

### Environment configuration

| Variable | Default | Notes |
|---|---|---|
| `APP_ENV` | `development` | Shown on `GET /` |
| `APP_VERSION` | `0.1.0` | API version string |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated; whitespace stripped, empties and duplicates ignored |
| `LOG_LEVEL` | `INFO` | `DEBUG`/`INFO`/`WARNING`/`ERROR`/`CRITICAL` (invalid → `INFO`) |

CORS never allows credentials, because the API uses no cookies or auth. A `*` origin is
therefore never combined with credentials.

## Run the server

```bash
uvicorn app.main:app --reload --port 8000
```

- API root: http://localhost:8000/
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
- OpenAPI JSON: http://localhost:8000/openapi.json

### curl example

```bash
# fetch the demo payload and post it back
curl -s http://localhost:8000/api/v1/demo-scenario > demo.json
curl -s -X POST http://localhost:8000/api/v1/analyze \
  -H "Content-Type: application/json" -d @demo.json

# or inline
curl -s -X POST http://localhost:8000/api/v1/analyze -H "Content-Type: application/json" -d '{
  "last_known_position": {"latitude": 13.8, "longitude": 86.5},
  "heading_degrees": 160, "ground_speed_knots": 220, "elapsed_minutes": 50,
  "wind": {"speed_knots": 18, "direction_from_degrees": 240},
  "aircraft_type": "generic_turboprop", "fuel_remaining_percent": 40
}'
```

## Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/` | name, version, status, description |
| GET | `/health` | `{"status": "ok"}` |
| GET | `/api/v1/aircraft-profiles` | 3 generic demo categories. They are **not** aircraft-specific performance profiles and do not affect any calculation. |
| GET | `/api/v1/demo-scenario` | Complete valid request (central Bay of Bengal, over water) |
| POST | `/api/v1/analyze` | Full illustrative analysis |
| GET | `/api/v1/methodology` | Maths, assumptions, limitations (same content as below) |

### Request (`POST /api/v1/analyze`)

| Field | Type / range | Units / meaning |
|---|---|---|
| `last_known_position.latitude` | `[-89, 89]` (`[-90,90]` syntactically; \|lat\| > 89 rejected) | degrees WGS84 |
| `last_known_position.longitude` | `[-180, 180]` | degrees WGS84 |
| `heading_degrees` | `[0, 360)` | degrees true, clockwise from north; **treated as ground track** |
| `ground_speed_knots` | `0..700` | knots, ground speed (not airspeed) |
| `elapsed_minutes` | `0..1440` | minutes |
| `wind.speed_knots` | `0..200` | knots |
| `wind.direction_from_degrees` | `[0, 360)` | degrees true the wind blows **from** |
| `aircraft_type` | `generic_light_aircraft` \| `generic_turboprop` \| `generic_jet` | descriptive only |
| `fuel_remaining_percent` | `0..100` | percent, context only |
| `position_uncertainty_nm` | `0..100`, default 5 | nm |
| `heading_uncertainty_degrees` | `0..45`, default 10 | degrees (u) |
| `grid_size` | integer `3..15`, default 5 | cells per side |
| `search_region_buffer_nm` | `0..200`, default 10 | nm |

Cross-field rule: `ground_speed_knots × elapsed_minutes / 60 ≤ 5000 nm`.
Values are never clamped. NaN/Infinity, booleans, numeric strings, unknown fields and
out-of-range values all return **422**.

### Error format (all errors)

```json
{
  "status": "error",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed; see details for each invalid field.",
    "details": [
      {"field": "body.heading_degrees", "loc": ["body", "heading_degrees"],
       "message": "Input should be less than 360", "type": "less_than", "constraints": {"lt": 360.0}}
    ]
  }
}
```

| Code | HTTP | When |
|---|---|---|
| `VALIDATION_ERROR` | 422 | Invalid body (field-level details) |
| `GEOMETRY_ERROR` | 422 | Region or grid would reach within 10 nm of a pole, or a polygon could not be represented |
| `PROJECTION_ERROR` | 422 | A transform produced a non-finite or out-of-range value |
| `HTTP_ERROR` | 404/405/… | Unknown route or method |
| `INTERNAL_ERROR` | 500 | Unexpected failure. Logged server-side with the stack trace; the client gets no trace. |

### Example response (abridged, demo scenario)

```json
{
  "schema_version": "1.0.0",
  "analysis_id": "73436e5d-045d-58e8-bd4c-461260960f75",
  "status": "success",
  "input_summary": {"ground_speed_knots": {"value": 220.0, "units": "knots (ground speed)"}, "...": "..."},
  "baseline": {"distance_nm": 183.333, "endpoint": {"latitude": 10.913717, "longitude": 87.561833},
               "heading_degrees": 160.0, "interpretation": "ground track"},
  "scenarios": [
    {"scenario_id": "heading_minus", "scenario_type": "heading_sensitivity", "heading_degrees_used": 150.0,
     "endpoint": {"latitude": 11.13735, "longitude": 88.053571}, "distance_nm": 183.333,
     "offset_from_baseline_nm": 31.942, "included_in_region": true, "description": "...", "assumptions": ["..."]}
  ],
  "search_region": {
    "type": "Feature",
    "geometry": {"type": "Polygon", "coordinates": [[[87.066721, 10.611912], [87.075135, 10.613303], "..."]]},
    "properties": {"label": "Illustrative search region", "area_sq_nm": 10478.9,
                   "bounds": {"min_lat": 10.609429, "min_lon": 86.32877, "max_lat": 13.967184, "max_lon": 88.223037},
                   "crosses_antimeridian": false, "buffer_nm_applied": 10.0,
                   "included_scenarios": ["baseline", "heading_minus", "heading_plus"],
                   "method": "...", "disclaimer": "..."}
  },
  "grid": {"rows": 7, "columns": 7, "score_type": "illustrative_relative_demo_score", "sigma_nm": 50.134,
           "cell_size_nm": {"width_nm": 15.952, "height_nm": 28.648},
           "cells": [{"cell_id": "r0c0", "row": 0, "column": 0, "centre_latitude": 13.72741,
                      "centre_longitude": 86.465394, "intersects_region": true,
                      "illustrative_relative_demo_score": 0.9984, "geometry": {"type": "Polygon", "coordinates": ["..."]}}]},
  "fuel_context": {"remaining_percent": 40.0, "aircraft_type": "generic_turboprop", "endurance_minutes": null,
                   "affects_geometry": false, "explanation": "..."},
  "wind_context": {"speed_knots": 18.0, "direction_from_degrees": 240.0, "direction_toward_degrees": 60.0,
                   "applied_to_baseline": false, "hypothetical_scenario_included": true, "limitations": ["..."]},
  "explanation": "Starting from the last known position (13.8000, 86.5000), a straight-line dead-reckoning reference ...",
  "assumptions": ["..."],
  "warnings": ["No land/water mask is applied: the illustrative region and grid may include land.", "..."],
  "disclaimer": "SkyTrace AI is a hackathon PROTOTYPE ..."
}
```

Full TypeScript types: [`docs/frontend_types.ts`](docs/frontend_types.ts). Full schema:
`python scripts/export_openapi.py` writes `openapi.json`.

## Running tests

```bash
cd backend
pytest            # or: python -m pytest -v
```

The suite covers validation (every field, NaN/Infinity, polar latitude, distance cap), the
distance formula, the `pyproj.Geod.fwd` cross-check, heading 0/90 behaviour, the zero-elapsed
case, GeoJSON ordering and validity, the antimeridian and high-latitude cases, grid shape and
scores, determinism, fuel/wind handling, wording guards and NaN-free JSON.

## Coordinate conventions

- **GeoJSON is `[longitude, latitude]`** (RFC 7946). `search_region.geometry` and every
  `grid.cells[].geometry` use this order.
- **Leaflet `LatLng` is `[latitude, longitude]`.** Use `L.geoJSON(feature)` for GeoJSON and it
  handles the swap. Never pass GeoJSON coordinate arrays straight to `L.polygon`.
- Point outputs (`baseline.endpoint`, `scenarios[].endpoint`, cell centres) use explicit
  `latitude`/`longitude` field names, so there is no ordering ambiguity.
- Headings and wind directions are degrees clockwise from **true** north. Wind is the
  direction it blows **from**.
- Output longitudes are in `[-180, 180]`. A region crossing ±180° comes back as a
  `MultiPolygon` split at the antimeridian, with `bounds.min_lon > bounds.max_lon`
  (RFC 7946 §5.2 convention).
- Exterior rings are counter-clockwise (RFC 7946 right-hand rule) and closed.
- Coordinates are rounded to 6 decimals (about 0.1 m), nm values to 3 decimals and grid scores
  to 4 decimals.

## Geo methodology

1. **Local projection.** Each request builds an Azimuthal Equidistant (AEQD) CRS on the WGS84
   ellipsoid, centred on the last known position, in metres. In AEQD the distance and azimuth
   *from the centre* are exact (PROJ uses ellipsoidal geodesics), so "travel *d* along *h*" is
   exactly the projected point `(d·sin h, d·cos h)`. Shapes, buffer widths and areas far from
   the centre are approximate, and the distortion grows with distance from the centre. That is
   one reason for the 5000 nm cap, and a warning is added beyond 1000 nm.
2. **Baseline.** `distance_nm = ground_speed_knots × elapsed_minutes / 60` (1 nm = 1852 m
   exactly). The east and north offsets are `d·sin h` and `d·cos h`, inverse-projected to
   lon/lat. Tests check the result against `pyproj.Geod(ellps="WGS84").fwd`: the difference is
   effectively 0 m, and the test asserts < 50 m.
3. **Scenarios** (deterministic): `baseline`, `heading_minus` (h−u), `heading_plus` (h+u),
   `heading_minus_2x` / `heading_plus_2x` (±2u, capped at ±60°) and
   `hypothetical_wind_drift`. All use the same speed and elapsed time. Each scenario's offset
   from the baseline is a geodesic distance (`Geod.inv`). Headings are normalised to `[0, 360)`.
   - If u = 0, the ± scenarios are omitted with a warning.
   - If the distance is 0, only the baseline is returned, with a warning.
4. **Search region.** Points = last known position + endpoints of `baseline`, `heading_minus`
   and `heading_plus` + arc points every ≤5° across `[h−u, h+u]` at the baseline distance. The
   region is the convex hull of those points, buffered by
   `max(position_uncertainty_nm, search_region_buffer_nm)`. The result is validated, densified,
   inverse-projected, unwrapped in longitude, split at the antimeridian, oriented CCW and
   re-validated.
5. **Grid.** `grid_size × grid_size` cells over the region's projected bounding box. Rows run
   north→south and columns west→east, and `cells[]` is row-major. Each cell's
   `illustrative_relative_demo_score` is computed as follows:
   - Take `exp(−½(dist/σ)²)`, where `dist` is the distance from the cell centre to the
     baseline track segment.
   - σ = 0.25 × the region's larger projected extent (minimum 100 m).
   - Cells that don't intersect the region get 0.
   - All scores are then min-max normalised. If every value is equal, cells get 1 if that value
     is > 0 and 0 otherwise, so there is never a division by zero.

   These scores are demo visualisation values, **not probabilities**.

## Wind and fuel limitations

**Wind.** Ground speed already includes the wind's effect, so wind is **never** added to the
baseline or to the region. `wind_context` reports speed, the from and toward directions,
`applied_to_baseline: false` and the limitations. Separating wind from aircraft motion would
need:

- true airspeed and heading
- aircraft performance
- altitude
- time-varying winds
- navigation mode
- track history

One separate `hypothetical_wind_drift` scenario shows what the endpoint would be **if** the
supplied speed were airspeed along the heading: baseline vector + (wind speed × time) toward
`direction_from + 180`. It is labelled `wind_sensitivity_hypothetical` and is **not** part of
the region (`included_scenarios` lists exactly which scenarios are).

**Fuel.** `fuel_context.endurance_minutes` is always `null`. A percentage alone cannot give
endurance or range: that needs usable capacity, fuel flow at the actual power setting, reserves
and aircraft-specific data, and none are invented. Fuel and aircraft type never change the
geometry.

## Known limitations

- No land/water mask, so regions may include land. There is also no terrain, ocean current,
  leeway, debris-drift or survival modelling.
- Straight constant track only: no turns, holding, descent profile, glide range or ditching
  behaviour.
- No surveillance data, track history or communication timeline.
- Polar positions (|lat| > 89°) and any region or grid reaching within 10 nm of a pole are
  rejected.
- Areas are approximate, because AEQD is not equal-area. Buffer widths are exact only near the
  centre.
- Demo grid scores carry no real-world meaning.
- Analysis runs synchronously per request in a threadpool (≈10–150 ms). There is no caching or
  rate limiting.

## Design decisions

- **New self-contained `backend/` folder.** The repository previously held an unrelated
  Express/MongoDB app (`src/`, `package.json`). It was left untouched because nothing in it was
  compatible.
- **Heading = ground track.** The heading is combined with ground speed, so the baseline treats
  it as the direction of motion over the ground.
- **Strict inputs.** `extra="forbid"` rejects unknown fields so typos fail loudly. Booleans and
  numeric strings are rejected for numeric fields, and `grid_size` must be a JSON integer.
- **Polar cut-off at \|lat\| ≤ 89°** plus a 10 nm pole-exclusion check on the region and grid.
  This returns `GEOMETRY_ERROR` (422) rather than an incorrect lon/lat polygon.
- **Buffer rule = `max(position_uncertainty_nm, search_region_buffer_nm)`**, not their sum.
  Both describe slack around the same swept sector, so summing would double-count. The applied
  value is reported in `properties.buffer_nm_applied`.
- **Minimum degenerate buffer 0.5 nm.** It is used only when the buffer is 0 *and* the hull is
  a point or line, and it comes with a warning.
- **Region scenarios = baseline and ±u only.** The outer ±2u and hypothetical wind scenarios
  are sensitivity context and are excluded from the region. This keeps the region tied to the
  user's stated uncertainty.
- **Outer sensitivity cap of 60°**, with a warning when 2u exceeds it.
- **No `make_valid` on the region.** Shapely buffers are valid by construction, so the code
  validates and raises instead of silently repairing. `make_valid` is used only as a fallback
  after longitude unwrapping or rounding, keeping the largest polygon. In practice it is never
  triggered: a 400-case fuzz run produced no invalid geometry.
- **Antimeridian.** Rings are densified in metres, unwrapped longitude-continuously, clipped
  into `[-180,180]` windows and emitted as a MultiPolygon. Bounds follow RFC 7946 §5.2 (west >
  east when crossing).
- **Grid cells carry GeoJSON geometry.** Cells are rectangles in the projection, not in
  lon/lat, so each cell polygon is converted the same way as the region. This keeps cells
  correct at high latitude and across ±180.
- **Error code `HTTP_ERROR`** was added for 404/405 so that every error uses the same envelope.
- **`analysis_id` = uuid5(fixed namespace, canonical JSON of the validated request including
  defaults).** Omitting a default and sending it explicitly give the same id.
- **No CORS credentials.** The API has no cookies or auth.
- **An extra `analysis_service.py`** orchestrates the services so that `routes.py` stays thin.
- **CPU work in the threadpool** (`run_in_threadpool`) keeps the async event loop responsive.
- **A wording guard test** fails if a response contains "probability of", "most likely" or
  "predicted path".

## Safety disclaimer

This software is a demonstration prototype. It does not locate aircraft, estimate survivability
or produce operational search-and-rescue statistics, and it must not inform any real-world
search decision. Outputs are illustrative sensitivity sketches only.
