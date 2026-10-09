#!/usr/bin/env bash
# SkyTrace AI — one-command start (macOS / Linux).
#
#   ./start-skytrace.sh            build the UI and run everything on ONE server: http://localhost:8000
#   ./start-skytrace.sh --dev      hot-reload mode: backend :8000 + Vite dev server :5173
#   ./start-skytrace.sh --reinstall  force re-installing Python and npm dependencies
#
# Env: PORT (default 8000), HOST (default 127.0.0.1), PYTHON (default python3).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
PORT="${PORT:-8000}"
HOST="${HOST:-127.0.0.1}"
PYTHON="${PYTHON:-python3}"
MODE="combined"
REINSTALL=0

for arg in "$@"; do
  case "$arg" in
    --dev) MODE="dev" ;;
    --reinstall) REINSTALL=1 ;;
    -h|--help) sed -n '2,10p' "$0"; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; exit 2 ;;
  esac
done

say() { printf '\033[36m[skytrace]\033[0m %s\n' "$*"; }
die() { printf '\033[31m[skytrace] %s\033[0m\n' "$*" >&2; exit 1; }

command -v "$PYTHON" >/dev/null || die "Python 3.11+ is required ($PYTHON not found)."
"$PYTHON" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)' || die "Python 3.11+ is required."
command -v node >/dev/null || die "Node.js 18+ is required."
node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 18 ? 0 : 1)' || die "Node.js 18+ is required."
command -v npm >/dev/null || die "npm is required."

# --- backend dependencies ---------------------------------------------------
VENV="$BACKEND/.venv"
if [[ ! -x "$VENV/bin/python" ]]; then
  say "Creating Python virtual environment…"
  "$PYTHON" -m venv "$VENV"
  REINSTALL_PY=1
else
  REINSTALL_PY=$REINSTALL
fi
if [[ "$REINSTALL_PY" == 1 ]] || ! "$VENV/bin/python" -c 'import fastapi, pyproj, shapely' 2>/dev/null; then
  say "Installing backend dependencies…"
  "$VENV/bin/pip" install --quiet --upgrade pip
  "$VENV/bin/pip" install --quiet -r "$BACKEND/requirements.txt"
fi

# --- frontend dependencies --------------------------------------------------
if [[ "$REINSTALL" == 1 || ! -d "$FRONTEND/node_modules" ]]; then
  say "Installing frontend dependencies…"
  (cd "$FRONTEND" && npm ci --no-audit --no-fund)
fi

if [[ "$MODE" == "dev" ]]; then
  say "Dev mode: backend http://localhost:$PORT  ·  frontend http://localhost:5173"
  (cd "$BACKEND" && "$VENV/bin/uvicorn" app.main:app --reload --host "$HOST" --port "$PORT") &
  BACK_PID=$!
  trap 'kill $BACK_PID 2>/dev/null || true' EXIT INT TERM
  (cd "$FRONTEND" && VITE_API_BASE_URL="http://localhost:$PORT" npm run dev)
  exit 0
fi

# --- combined: build UI, serve it from the backend ----------------------------
say "Building the frontend…"
(cd "$FRONTEND" && VITE_API_BASE_URL=/ npm run build --silent)

say "SkyTrace AI is starting on http://localhost:$PORT  (API docs: http://localhost:$PORT/docs)"
say "Press Ctrl+C to stop."
cd "$BACKEND"
SERVE_FRONTEND=true FRONTEND_DIST="$FRONTEND/dist" exec "$VENV/bin/uvicorn" app.main:app --host "$HOST" --port "$PORT"
