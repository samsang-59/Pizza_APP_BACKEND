# SkyTrace AI — Frontend (prototype)

> **Safety disclaimer.** SkyTrace AI is a hackathon **prototype for demonstration**. It does not
> locate real aircraft and does not produce operational search-and-rescue statistics. Everything it
> draws is an *illustrative*, *hypothetical* sensitivity sketch computed by the local backend. **Not
> for operational search-and-rescue decisions.**

*Every coordinate matters.* This React app lets you enter the last known aircraft information. It
sends that to the SkyTrace FastAPI backend and visualises the result:
- the illustrative search region
- heading-sensitivity scenarios
- a demonstration grid
- the backend's plain-language explanation, assumptions and warnings

## Stack

React 18 · Vite 5 · TypeScript (strict) · Tailwind CSS 3.4 (PostCSS) · Framer Motion · Leaflet 1.9 +
react-leaflet 4 · Axios · Lucide React · React Hook Form + Zod · Vitest + Testing Library + jsdom ·
ESLint 9.

All dependency versions are pinned exactly in `package.json`, and `package-lock.json` is committed.
Fonts (Inter, JetBrains Mono) are bundled via `@fontsource`, so there are no external font requests.

## Setup

Requires Node.js 18+ (tested with Node 22) and the backend from `../backend`.

```bash
cd frontend
npm install
cp .env.example .env        # optional
```

### Environment

| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:8000` | Base URL of the FastAPI backend (no trailing slash). `/` = same origin, used when the backend serves the built app |

There are no API keys or secrets anywhere in the frontend, and the browser makes no external AI
calls. The only third-party request is for OpenStreetMap tiles.

## Running the complete app (one server)

From the repository root, `./start-skytrace.sh` (Windows: `.\start-skytrace.ps1`) builds this app
with `VITE_API_BASE_URL=/` and the FastAPI backend serves it at http://localhost:8000. A Docker
image is also provided. See [`../SKYTRACE.md`](../SKYTRACE.md).

## Running backend + frontend (two terminals)

Terminal 1 — backend:

```bash
cd backend
source .venv/bin/activate          # Windows: .venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 8000
```

Terminal 2 — frontend:

```bash
cd frontend
npm install && npm run dev
```

URLs:
- Frontend: http://localhost:5173
- Backend: http://localhost:8000
- API docs: http://localhost:8000/docs

Vite uses `strictPort: true` on port 5173, because the backend's default CORS list allows
`http://localhost:5173` and `http://127.0.0.1:5173`.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server on http://localhost:5173 |
| `npm run build` | `tsc --noEmit` + production build to `dist/` |
| `npm run preview` | Serve the production build on port 4173 |
| `npm run lint` | ESLint (zero warnings allowed) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test -- --run` | Vitest, single run |

## Structure

```
src/
  api/            client.ts (Axios), endpoints.ts, types.ts (from backend/docs/frontend_types.ts), errors.ts (AppError)
  components/
    layout/       AppShell, TopNavigation, BackendStatus, Footer, AboutModal, Dashboard
    form/         MissionParametersForm, AdvancedParameters, NumberField, FieldTooltip
    map/          InteractiveSearchMap, MapLayerControls, MapLegend, ScenarioMarkers, SearchRegionLayer,
                  GridLayer, MapEmptyState, markerIcons
    results/      AnalysisOverview, TelemetryCard, ScenarioExplorer, ScenarioCard, SearchGridHeatmap,
                  InterpretationPanel, AssumptionsPanel, WarningsPanel, MethodologyPanel
    ui/           Button, Card, InfoTip, Modal, LoadingSkeleton, EmptyState, ErrorBanner, Toast/ToastProvider
  hooks/          useBackendHealth, useAnalysis, useDemoScenario, useApiResource, useReducedMotionSafe
  state/          SelectionContext (hovered/selected scenario + cell)
  lib/            geo.ts, format.ts, scoreColor.ts, schema.ts (Zod + payload mapping), analysis.ts
  fixtures/       *.sample.json — REAL backend responses, used by unit tests only
  test/           component tests + setup
```

## Coordinate conventions (important)

- **GeoJSON is `[longitude, latitude]`** (RFC 7946). The backend's `search_region.geometry` and
  `grid.cells[].geometry` use this order.
- **Leaflet is `[latitude, longitude]`.**
- **All conversion happens in `src/lib/geo.ts`.** Components never swap coordinates inline:
  - `lngLatToLatLng`, `latLonToLatLng`: points
  - `geometryToLatLngs`: Polygon/MultiPolygon → Leaflet rings
  - `bboxToLeafletBounds`: backend bounds → Leaflet bounds
  - `cellToBounds`: approximate cell rectangle
- The search region is drawn with react-leaflet `<GeoJSON>`, which handles `[lng, lat]` itself. It
  is keyed by `analysis_id`, so it re-renders on every new result.
- **Antimeridian.** The backend splits regions that cross ±180° into a `MultiPolygon` with
  longitudes in `[-180, 180]`. It reports bounds with `min_lon > max_lon` (RFC 7946 §5.2). For
  display, `unwrapLng` / `unwrapGeometry` shift every longitude to within 180° of the last known
  position, so the two halves (and the markers) sit side by side instead of on opposite edges of
  the map. Leaflet accepts longitudes beyond ±180, and `worldCopyJump` is on.
- Point fields such as `endpoint` and `centre_latitude` / `centre_longitude` are named explicitly,
  so their order is never ambiguous.

## Grid orientation

These conventions were verified against real responses: latitude falls as `row` increases.
- `row 0` is the **northernmost** row and is drawn at the top.
- `column 0` is the **westernmost** column and is drawn on the left.

The heatmap places each cell by its own `row` / `column` fields; it never relies on array order.

On the map, grid cells use the backend's own per-cell polygon (exact in its local projection).
`cellToBounds` (centre ± half of `cell_size_nm`, with `lat = nm / 60` and `lon = nm / (60·cos lat)`)
is an **approximate** fallback, used only if a cell has no geometry. A unit test checks that it
matches the backend polygon to about 0.1°.

Scores are `illustrative_relative_demo_score` values in [0, 1]. They are shown on a restrained
single-hue ramp with a legend, and the banner **"ILLUSTRATIVE RELATIVE DEMO SCORES — NOT
PROBABILITIES"** is always visible with the grid. Cells are never sorted or ranked.

## Design decisions

- **The backend is the source of truth.** The types in `src/api/types.ts` come from
  `backend/docs/frontend_types.ts` and were checked against captured real responses. Differences
  from the build brief are listed under "Backend differences".
- **Form values are strings, and Zod parses them into numbers.** This keeps exactly what the user
  typed, including after a failed request. The payload builder:
  - emits numbers only (`grid_size` must be an integer);
  - **omits** unset optional fields, so backend defaults apply (shown as placeholders);
  - never sends unknown fields, because the backend rejects them (`extra="forbid"`).
- **Validation limits mirror `backend/app/core/constants.py`.** That includes |lat| ≤ 89° and the
  5000 nm cross-field rule. The backend exposes no limits endpoint, so the values are duplicated in
  `lib/schema.ts` and the backend's 422 remains authoritative. 422 `details` are mapped back to
  fields via `loc`; anything unmappable (e.g. the body-level 5000 nm rule) goes into the
  ErrorBanner. FastAPI's default `{detail: [...]}` shape is also handled.
- **Request safety:**
  - every analyze request uses an `AbortController` and a monotonically increasing request
    counter, so a stale response can never overwrite a newer one;
  - an identical payload already in flight is ignored;
  - submit is disabled while loading.
- **If a new request fails, the previous result stays visible**, clearly labelled "Showing
  previous result — latest request failed".
- **There is no local fallback data.** Load Demo calls `GET /api/v1/demo-scenario`; if it fails,
  an error with Retry is shown. The fixtures are imported only by tests (verified: they are not in
  the production bundle).
- **Markers are SVG `L.divIcon`s**, which avoids Leaflet's broken default PNG icons under Vite.
  - Each type has a distinct shape: diamond = start, filled circle = baseline, triangle = ± u,
    hollow triangle = ± 2u.
  - The hypothetical wind case is a dashed amber "ghost" marker with an "H" and a
    **HYPOTHETICAL** tag.
  - Markers are keyboard-focusable: Enter opens the popup and selects the scenario.
- **The grid map layer is off by default** to reduce clutter. It turns on automatically when a
  cell is selected in the heatmap. Fit-to-bounds pads for the floating controls and the legend.
- **No animation implies a moving aircraft.** There are no travelling dots and no pulsing "live"
  markers; the only pulse is the "checking" dot in the API status pill.
- **Reduced motion is respected.** Framer Motion uses `MotionConfig reducedMotion="user"`, CSS
  transitions are disabled under `prefers-reduced-motion`, and Leaflet pans and fits without
  animation.
- **The base map is OSM tiles darkened with a CSS filter**, which avoids a paid or keyed dark tile
  provider. If tiles fail to load, a small notice says so and the overlays still render.
- **Grid cells on the map use the backend's exact cell polygons** rather than centre ± size
  rectangles (see Grid orientation).
- **Backend text is shown verbatim**, including warnings such as "not a probability contour, not a
  validated confidence region". These negations come from the backend. The static UI copy follows
  the wording rules, and a test (`src/test/copy.test.ts`) scans every source file for banned
  phrases.
- **The interpretation panel is honest about its source.** It is titled "AI-assisted
  interpretation", but its subtitle states the text is deterministic, generated by the backend,
  and that no external AI model is called.
- **Accessibility:**
  - semantic landmarks and a skip link;
  - labelled inputs with `aria-invalid` / `aria-describedby`;
  - tooltips that open on hover, focus and tap, close with Escape, and are linked via
    `aria-describedby`;
  - a focus trap in the About dialog and the mobile menu;
  - `aria-live` for loading, results and toasts;
  - after a successful analysis, focus moves to the "Analysis overview" heading
    (`preventScroll`);
  - the map has a text description, and the Scenario Explorer is its text alternative;
  - every scenario type has a text badge, so colour is never the only signal.

## Backend differences found

- `grid.cell_size_nm` is an object `{width_nm, height_nm}`, not a single number. Each grid cell
  also has an exact GeoJSON `geometry`.
- The error envelope uses two more codes besides the ones in the brief: `GEOMETRY_ERROR` (e.g. a
  region that would reach a pole) and `HTTP_ERROR` (404/405). `GEOMETRY_ERROR` `details` are
  metadata objects without a message, so the UI shows only the error message for them.
- The 5000 nm cross-field rule comes back with `loc: ["body"]`, so it isn't attached to one field.
  The frontend's own Zod rule shows it inline on "Elapsed time" before submission.
- Backend responses include `included_in_region` per scenario, `crosses_antimeridian` and
  `buffer_nm_applied`. The UI displays the first two.

No backend code was changed.

## Known limitations

- OpenStreetMap tiles need internet access. Without it the map stays usable but has no base
  layer.
- Validation limits are duplicated from the backend constants. If the backend limits change,
  update `lib/schema.ts`. The backend still enforces its own limits.
- For antimeridian regions, the 180° seam between the two MultiPolygon halves is drawn as a thin
  outline.
- The baseline vector on the map is a straight line in lat/lng between two backend points. It is a
  visual cue, not a geodesic or a flight path.
- Grid cells on a 15 × 15 grid are smaller than 44 px on phones. The grid scrolls horizontally
  inside its own container.
- There is no land/water mask (this is a backend limitation), so regions may include land. This
  is stated on the map and in the warnings.

## Tests

```bash
npm run test -- --run
```

The suites cover:
- `geo.ts`, including antimeridian cases and the real sample geometry;
- formatters;
- form → payload mapping and Zod rules (|lat| > 89, 5000 nm);
- error normalisation, using the real 422 fixtures plus network, timeout and FastAPI-default
  shapes;
- request ordering and abort / dedupe / stale handling;
- selection sync (list → context, marker → card with `scrollIntoView({block: 'nearest'})`);
- form field errors and the submit-disabled-while-loading state;
- the grid banner and orientation;
- banned wording in static copy.
