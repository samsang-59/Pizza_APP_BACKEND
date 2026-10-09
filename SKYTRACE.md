# SkyTrace AI — run the complete app

> **Prototype for demonstration. Not for operational search-and-rescue decisions.**
> SkyTrace AI does not locate real aircraft. It draws an *illustrative* search region and
> *hypothetical* heading-sensitivity scenarios from the last known position, ground speed,
> heading and elapsed time.

SkyTrace AI has two parts, which run together as **one app on one URL**:

| Part | Folder | What it is |
|---|---|---|
| Backend | [`backend/`](backend/README.md) | FastAPI + PyProj + Shapely: geometry, scenarios, region, demo grid |
| Frontend | [`frontend/`](frontend/README.md) | React + TypeScript + Leaflet dashboard |

In combined mode the backend serves the built frontend. The browser loads the page and calls the
API on the same origin, so no CORS setup is needed.

```
browser ──► http://localhost:8000/           React app (frontend/dist, served by FastAPI)
        ──► http://localhost:8000/api/v1/*   analysis API
        ──► http://localhost:8000/health     liveness
        ──► http://localhost:8000/docs       interactive API docs
```

(The Express/MongoDB "pizza" code in `src/` is a separate, unrelated project.)

## Easiest — download the app (no installs)

**Download page:** https://github.com/samsang-59/Pizza_APP_BACKEND/releases/latest

| System | File |
|---|---|
| Windows 10/11 (64-bit) | `SkyTraceAI-windows-x64.zip` |
| macOS (Apple Silicon M1–M4) | `SkyTraceAI-macos-apple-silicon.zip` |
| Linux (x64) | `SkyTraceAI-linux-x64.tar.gz` |

To run it:
1. Unzip the file.
2. Double-click **SkyTraceAI**. Your browser opens the dashboard (usually http://127.0.0.1:8000).
3. Keep the small console window open while you use the app, and close it to quit.

The app is not code-signed, so your system may warn you the first time:
- **Windows:** choose *More info → Run anyway*.
- **macOS:** right-click the file → *Open*.

`README-FIRST.txt` in the download has the details.

These files are built and smoke-tested by
[`.github/workflows/skytrace-desktop-release.yml`](.github/workflows/skytrace-desktop-release.yml)
whenever a tag like `skytrace-v0.1.0` is pushed. To build one yourself, build the frontend with
`VITE_API_BASE_URL=/`, then run `pyinstaller desktop/skytrace.spec`.

## Open it as a website

**GitHub Codespaces (free tier, nothing to install):**
https://codespaces.new/samsang-59/Pizza_APP_BACKEND?ref=claude/skytrace-ai-backend-610xfu

Click *Create codespace* and wait a few minutes for the first setup. SkyTrace then starts by
itself and opens in a new browser tab. The address is private to your GitHub account unless you
make port 8000 public in the *Ports* tab.

**Permanent public website (Render, free plan):** once this branch is merged into `master`, open
https://render.com/deploy?repo=https://github.com/samsang-59/Pizza_APP_BACKEND and approve.
Render builds the `Dockerfile` using `render.yaml` and gives you a link like
`https://skytrace-ai-xxxx.onrender.com`. Free services sleep when idle, so the first visit after a
pause takes about a minute.

## Option 1 — one command (recommended)

Requires **Python 3.11+** and **Node.js 18+**.

macOS / Linux:

```bash
./start-skytrace.sh
```

Windows (PowerShell):

```powershell
.\start-skytrace.ps1
# if scripts are blocked: Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

Then open **http://localhost:8000**, click **LOAD DEMO SCENARIO**, then **ANALYZE SEARCH AREA**.

On the first run the script:
1. creates `backend/.venv` and installs the Python packages;
2. installs the npm packages;
3. builds the UI;
4. starts one server.

Later runs skip the installs.

| Flag | Effect |
|---|---|
| *(none)* | Build UI + serve everything on port 8000 |
| `--dev` / `-Dev` | Hot-reload mode: backend on :8000 + Vite dev server on :5173 (open http://localhost:5173) |
| `--reinstall` / `-Reinstall` | Force re-installing dependencies |
| `PORT=9000 ./start-skytrace.sh` / `-Port 9000` | Use another port |

## Option 2 — Docker (one container)

```bash
docker build -t skytrace-ai .
docker run --rm -p 8000:8000 skytrace-ai
```

Open **http://localhost:8000**. The image:
- builds the frontend in a Node stage, then copies it into a slim Python image;
- runs as a non-root user;
- has a `/health` healthcheck;
- honours `$PORT`, so it can be deployed as-is on Render, Railway, Fly.io or similar.

## Option 3 — manual (two terminals, for development)

```bash
# Terminal 1
cd backend && python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Terminal 2
cd frontend && npm install && npm run dev      # http://localhost:5173
```

Manual combined mode (what the script does):

```bash
cd frontend && VITE_API_BASE_URL=/ npm run build
cd ../backend && SERVE_FRONTEND=true uvicorn app.main:app --port 8000
```

## Configuration

| Variable | Where | Default | Meaning |
|---|---|---|---|
| `SERVE_FRONTEND` | backend | `false` | `true` = serve the built UI at `/` (combined mode) |
| `FRONTEND_DIST` | backend | `../frontend/dist` | Folder with the built UI |
| `CORS_ORIGINS` | backend | `http://localhost:5173,http://127.0.0.1:5173` | Only needed when the UI runs on another origin |
| `VITE_API_BASE_URL` | frontend build | `http://localhost:8000` | `/` = same origin (combined mode) |
| `PORT` | script / Docker | `8000` | Server port |

## Checking it works

- http://localhost:8000/health → `{"status":"ok"}`
- http://localhost:8000/api/v1/info → service info, including `"frontend_served": true`
- In the app, the top-right pill shows **API CONNECTED**.

Tests: `cd backend && pytest` and `cd frontend && npm run test -- --run`.
