"""Environment-driven settings (loaded once, from process env and optional .env)."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

DEFAULT_CORS_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173"
_VALID_LOG_LEVELS = {"CRITICAL", "ERROR", "WARNING", "INFO", "DEBUG"}
# backend/app/core/config.py -> repo root is three parents up from app/
DEFAULT_FRONTEND_DIST = Path(__file__).resolve().parents[3] / "frontend" / "dist"


def parse_bool(raw: str | None, default: bool = False) -> bool:
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def parse_cors_origins(raw: str | None) -> list[str]:
    """Split a comma-separated origin list, stripping whitespace and empties."""
    if raw is None:
        raw = DEFAULT_CORS_ORIGINS
    origins: list[str] = []
    for part in raw.split(","):
        origin = part.strip().rstrip("/")
        if origin and origin not in origins:
            origins.append(origin)
    return origins


@dataclass(frozen=True)
class Settings:
    app_env: str = "development"
    app_version: str = "0.1.0"
    cors_origins: list[str] = field(default_factory=lambda: parse_cors_origins(None))
    log_level: str = "INFO"
    # Combined mode: serve the built React app (frontend/dist) from this server.
    serve_frontend: bool = False
    frontend_dist: Path = DEFAULT_FRONTEND_DIST


@lru_cache
def get_settings() -> Settings:
    load_dotenv(override=False)
    log_level = os.getenv("LOG_LEVEL", "INFO").strip().upper()
    if log_level not in _VALID_LOG_LEVELS:
        log_level = "INFO"
    return Settings(
        app_env=os.getenv("APP_ENV", "development").strip() or "development",
        app_version=os.getenv("APP_VERSION", "0.1.0").strip() or "0.1.0",
        cors_origins=parse_cors_origins(os.getenv("CORS_ORIGINS")),
        log_level=log_level,
        serve_frontend=parse_bool(os.getenv("SERVE_FRONTEND")),
        frontend_dist=Path(os.getenv("FRONTEND_DIST", "").strip() or DEFAULT_FRONTEND_DIST).resolve(),
    )
