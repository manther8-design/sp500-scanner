from datetime import timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from apps.api.app.api.deps import get_collector
from apps.api.app.core.config import get_settings
from apps.api.app.core.database import SessionLocal, get_db
from db.models import ScanJob, ScanRun, UserSettings
from db.models.base import utcnow
from db.schemas.scan import ScanCreate, ScanIntervalUpdate, ScanRunOut
from providers.base import get_provider
from services.data_collector import DataCollector

router = APIRouter(prefix="/scans")


async def _execute_scan(run_id: int, payload: ScanCreate) -> None:
    db = SessionLocal()
    try:
        settings = get_settings()
        provider = get_provider(settings.data_provider)
        collector = DataCollector(db=db, provider=provider)
        await collector.run_scan(
            trigger="manual",
            watchlist_id=payload.watchlist_id,
            symbols=payload.symbols,
            fetch_history=payload.fetch_history,
            timeframe=payload.timeframe,
            existing_run_id=run_id,
        )
        job = db.scalar(select(ScanJob).where(ScanJob.name == "default"))
        if job:
            job.last_run_at = utcnow()
            job.next_run_at = utcnow() + timedelta(minutes=job.interval_minutes)
            db.commit()
    except Exception as exc:
        run = db.get(ScanRun, run_id)
        if run:
            run.status = "failed"
            run.message = str(exc)
            run.finished_at = utcnow()
            db.commit()
    finally:
        db.close()


@router.post("", response_model=ScanRunOut, status_code=202)
async def start_scan(
    payload: ScanCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> ScanRunOut:
    run = ScanRun(
        trigger="manual",
        status="queued",
        watchlist_id=payload.watchlist_id,
        started_at=utcnow(),
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    background_tasks.add_task(_execute_scan, run.id, payload)
    return ScanRunOut.model_validate(run)


@router.get("", response_model=list[ScanRunOut])
def list_scans(limit: int = 20, db: Session = Depends(get_db)) -> list[ScanRunOut]:
    rows = db.scalars(select(ScanRun).order_by(ScanRun.id.desc()).limit(limit)).all()
    return [ScanRunOut.model_validate(r) for r in rows]


@router.get("/jobs/default")
def get_default_job(db: Session = Depends(get_db)) -> dict:
    job = db.scalar(select(ScanJob).where(ScanJob.name == "default"))
    if job is None:
        raise HTTPException(status_code=404, detail="Default scan job not found")
    return {
        "id": job.id,
        "name": job.name,
        "watchlist_id": job.watchlist_id,
        "interval_minutes": job.interval_minutes,
        "is_enabled": job.is_enabled,
        "last_run_at": job.last_run_at,
        "next_run_at": job.next_run_at,
    }


@router.patch("/jobs/default")
def update_default_job(payload: ScanIntervalUpdate, db: Session = Depends(get_db)) -> dict:
    job = db.scalar(select(ScanJob).where(ScanJob.name == "default"))
    if job is None:
        raise HTTPException(status_code=404, detail="Default scan job not found")
    job.interval_minutes = payload.interval_minutes
    if payload.is_enabled is not None:
        job.is_enabled = payload.is_enabled
    setting = db.scalar(
        select(UserSettings).where(UserSettings.key == "scan_interval_minutes")
    )
    if setting:
        setting.value = str(payload.interval_minutes)
        setting.value_int = payload.interval_minutes
    job.next_run_at = utcnow() + timedelta(minutes=job.interval_minutes)
    db.commit()
    return {
        "id": job.id,
        "interval_minutes": job.interval_minutes,
        "is_enabled": job.is_enabled,
        "next_run_at": job.next_run_at,
    }


@router.post("/run-now", response_model=ScanRunOut)
async def run_now(
    payload: ScanCreate | None = None,
    collector: DataCollector = Depends(get_collector),
    db: Session = Depends(get_db),
) -> ScanRunOut:
    """Synchronous scan for small lists / tests."""
    body = payload or ScanCreate()
    run = await collector.run_scan(
        trigger="manual",
        watchlist_id=body.watchlist_id,
        symbols=body.symbols,
        fetch_history=body.fetch_history,
        timeframe=body.timeframe,
    )
    job = db.scalar(select(ScanJob).where(ScanJob.name == "default"))
    if job:
        job.last_run_at = utcnow()
        job.next_run_at = utcnow() + timedelta(minutes=job.interval_minutes)
        db.commit()
    return ScanRunOut.model_validate(run)


@router.get("/{scan_id}", response_model=ScanRunOut)
def get_scan(scan_id: int, db: Session = Depends(get_db)) -> ScanRunOut:
    run = db.get(ScanRun, scan_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Scan not found")
    return ScanRunOut.model_validate(run)
