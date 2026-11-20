"""Entrypoint for process managers (Procfile / uvicorn)."""

from apps.api.app.main import app

__all__ = ["app"]
