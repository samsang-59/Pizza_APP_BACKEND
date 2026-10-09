"""Domain exceptions mapped to the structured error envelope in app.main."""

from __future__ import annotations

from typing import Any


class SkyTraceError(Exception):
    code = "INTERNAL_ERROR"
    status_code = 500

    def __init__(self, message: str, details: list[dict[str, Any]] | None = None):
        super().__init__(message)
        self.message = message
        self.details = details or []


class ProjectionError(SkyTraceError):
    """A coordinate transform produced a non-finite or unusable value."""

    code = "PROJECTION_ERROR"
    status_code = 422


class GeometryError(SkyTraceError):
    """The requested geometry cannot be represented (e.g. reaches a pole)."""

    code = "GEOMETRY_ERROR"
    status_code = 422
