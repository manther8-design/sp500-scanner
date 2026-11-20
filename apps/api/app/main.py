from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from datetime import timedelta

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from apps.api.app.api.routes import api_router, root_router
from apps.api.app.core.config import get_settings
from apps.api.app.core.database import SessionLocal, init_db
from apps.api.app.core.seed import seed_defaults
from db.models import ScanJob
from db.models.base import utcnow
from providers.base import get_provider
from services.data_collector import DataCollector

scheduler = AsyncIOScheduler()


async def scheduled_scan() -> None:
    db = SessionLocal()
    try:
        job = db.scalar(select(ScanJob).where(ScanJob.name == "default"))
        if job is None or not job.is_enabled:
            return
        settings = get_settings()
        collector = DataCollector(db=db, provider=get_provider(settings.data_provider))
        await collector.run_scan(
            trigger="scheduled",
            watchlist_id=job.watchlist_id,
            fetch_history=True,
            timeframe="1d",
            job_id=job.id,
        )
        job.last_run_at = utcnow()
        job.next_run_at = utcnow() + timedelta(minutes=job.interval_minutes)
        db.commit()
    finally:
        db.close()


def _resync_schedule() -> None:
    settings = get_settings()
    interval = settings.scan_interval_minutes
    db = SessionLocal()
    try:
        job = db.scalar(select(ScanJob).where(ScanJob.name == "default"))
        if job:
            interval = job.interval_minutes
    finally:
        db.close()

    if scheduler.get_job("default_scan"):
        scheduler.reschedule_job("default_scan", trigger="interval", minutes=interval)
    else:
        scheduler.add_job(
            lambda: asyncio.create_task(scheduled_scan()),
            "interval",
            minutes=interval,
            id="default_scan",
            replace_existing=True,
        )


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    db = SessionLocal()
    try:
        seed_defaults(db)
    finally:
        db.close()

    _resync_schedule()
    scheduler.start()
    yield
    scheduler.shutdown(wait=False)


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Stock Analysis Platform",
        description="Phase 1 — foundation, watchlists, yfinance data engine",
        version="0.1.0",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list or ["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(api_router)
    app.include_router(root_router)

    @app.get("/health")
    async def health() -> dict:
        return {"status": "ok", "provider": settings.data_provider}

    return app


app = create_app()
