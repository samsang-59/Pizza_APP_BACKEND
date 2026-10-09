"""FastAPI application: CORS, request logging, structured error envelope.

Two modes:
  * API only (default): GET / returns JSON service information.
  * Combined (SERVE_FRONTEND=true): the built React app in FRONTEND_DIST is
    served at /, so the whole product runs from one server and one URL. The
    service information is always available at GET /api/v1/info.
"""

from __future__ import annotations

import logging
import time
import uuid
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.routes import router
from app.core import constants as C
from app.core.config import Settings, get_settings
from app.core.exceptions import SkyTraceError

settings = get_settings()
logging.basicConfig(
    level=settings.log_level,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("skytrace")

DESCRIPTION = (
    "Prototype backend that sketches an ILLUSTRATIVE search area after loss of contact with an aircraft, from the "
    "last known position, ground speed, ground track and elapsed time. Demonstration only: it does not locate "
    "real aircraft or compute operational search-and-rescue statistics."
)


async def log_requests(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID") or uuid.uuid4().hex
    request.state.request_id = request_id
    start = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        duration_ms = (time.perf_counter() - start) * 1000
        logger.exception(
            "request_id=%s method=%s path=%s status=500 duration_ms=%.1f unhandled",
            request_id, request.method, request.url.path, duration_ms,
        )
        response = _error(500, "INTERNAL_ERROR", "An internal error occurred.", [])
    duration_ms = (time.perf_counter() - start) * 1000
    response.headers["X-Request-ID"] = request_id[:64]
    logger.info(
        "request_id=%s method=%s path=%s status=%d duration_ms=%.1f",
        request_id, request.method, request.url.path, response.status_code, duration_ms,
    )
    return response


def _error(status: int, code: str, message: str, details: list[dict[str, Any]]) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content={"status": "error", "error": {"code": code, "message": message, "details": details}},
    )


def _clean_validation_errors(errors) -> list[dict[str, Any]]:
    details = []
    for err in errors:
        loc = [str(p) for p in err.get("loc", ())]
        msg = str(err.get("msg", "Invalid value"))
        if msg.startswith("Value error, "):
            msg = msg[len("Value error, "):]
        detail = {"field": ".".join(loc), "loc": loc, "message": msg, "type": err.get("type", "value_error")}
        ctx = err.get("ctx")
        if ctx:
            safe = {k: v for k, v in ctx.items() if isinstance(v, (int, float, str, bool)) and k != "error"}
            if safe:
                detail["constraints"] = safe
        details.append(detail)
    return details


async def validation_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    details = _clean_validation_errors(exc.errors())
    logger.info("validation error path=%s fields=%s", request.url.path, [d["field"] for d in details])
    return _error(422, "VALIDATION_ERROR", "Request validation failed; see details for each invalid field.", details)


async def skytrace_handler(request: Request, exc: SkyTraceError) -> JSONResponse:
    logger.warning("handled %s path=%s message=%s", exc.code, request.url.path, exc.message)
    return _error(exc.status_code, exc.code, exc.message, exc.details)


async def http_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    return _error(exc.status_code, "HTTP_ERROR", str(exc.detail), [])


async def unhandled_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("unhandled error path=%s", request.url.path)
    return _error(500, "INTERNAL_ERROR", "An internal error occurred.", [])


def _service_info(settings: Settings) -> dict:
    return {
        "name": C.APP_NAME,
        "version": settings.app_version,
        "status": "ok",
        "description": DESCRIPTION,
        "environment": settings.app_env,
        "docs": "/docs",
        "frontend_served": settings.serve_frontend,
    }


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    application = FastAPI(
        title=C.APP_NAME,
        version=settings.app_version,
        description=DESCRIPTION,
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # No cookies or auth are used, so credentials are never allowed; this also
    # keeps a "*" origin safe if someone configures it. In combined mode the UI
    # is same-origin and CORS is not needed at all.
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type", "X-Request-ID"],
        expose_headers=["X-Request-ID"],
    )
    application.middleware("http")(log_requests)
    application.add_exception_handler(RequestValidationError, validation_handler)
    application.add_exception_handler(SkyTraceError, skytrace_handler)
    application.add_exception_handler(StarletteHTTPException, http_handler)
    application.add_exception_handler(Exception, unhandled_handler)

    @application.get("/health", tags=["meta"], summary="Liveness check")
    async def health() -> dict:
        return {"status": "ok"}

    @application.get("/api/v1/info", tags=["meta"], summary="Service information")
    async def info() -> dict:
        return _service_info(settings)

    application.include_router(router)

    index = settings.frontend_dist / "index.html"
    if settings.serve_frontend and index.is_file():
        # Mounted last so /health, /api/*, /docs and /redoc keep priority.
        application.mount("/", StaticFiles(directory=settings.frontend_dist, html=True), name="frontend")
        logger.info("serving frontend from %s", settings.frontend_dist)
    else:
        if settings.serve_frontend:
            logger.warning(
                "SERVE_FRONTEND is set but %s was not found; build the frontend first "
                "(cd frontend && npm run build). Serving the API only.",
                index,
            )

        @application.get("/", tags=["meta"], summary="Service information")
        async def root() -> dict:
            return _service_info(settings)

    return application


app = create_app()
