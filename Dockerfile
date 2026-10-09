# SkyTrace AI — single container: FastAPI backend serving the built React frontend.
#   docker build -t skytrace-ai .
#   docker run --rm -p 8000:8000 skytrace-ai      ->  http://localhost:8000
# (The Express "pizza" app in src/ is unrelated and not included.)

# ---- 1. build the frontend --------------------------------------------------
FROM node:22-alpine AS ui
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
# "/" = call the API on the same origin that serves the page
ENV VITE_API_BASE_URL=/
RUN npm run build

# ---- 2. runtime: Python backend + static UI ---------------------------------
FROM python:3.12-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /app/backend
COPY backend/requirements.txt ./
RUN pip install -r requirements.txt
COPY backend/app ./app
COPY --from=ui /app/frontend/dist /app/frontend/dist

RUN useradd --create-home --uid 10001 skytrace
USER skytrace

ENV SERVE_FRONTEND=true \
    FRONTEND_DIST=/app/frontend/dist \
    APP_ENV=production \
    LOG_LEVEL=INFO \
    PORT=8000
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import os,sys,urllib.request; sys.exit(0 if urllib.request.urlopen(f'http://127.0.0.1:{os.environ.get(\"PORT\",\"8000\")}/health', timeout=4).status == 200 else 1)"
# PORT is honoured so hosting platforms (Render, Railway, Fly.io, ...) can set it.
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers"]
