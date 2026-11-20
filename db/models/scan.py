from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from db.models.base import Base, TimestampMixin, utcnow


class ScanJob(Base, TimestampMixin):
    __tablename__ = "scan_jobs"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    watchlist_id: Mapped[int | None] = mapped_column(ForeignKey("watchlists.id", ondelete="SET NULL"), nullable=True)
    interval_minutes: Mapped[int] = mapped_column(Integer, default=60, nullable=False)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    next_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ScanRun(Base, TimestampMixin):
    __tablename__ = "scan_runs"

    id: Mapped[int] = mapped_column(primary_key=True)
    job_id: Mapped[int | None] = mapped_column(ForeignKey("scan_jobs.id", ondelete="SET NULL"), nullable=True)
    trigger: Mapped[str] = mapped_column(String(32), nullable=False)  # manual | scheduled
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    watchlist_id: Mapped[int | None] = mapped_column(ForeignKey("watchlists.id", ondelete="SET NULL"), nullable=True)
    symbols_total: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    symbols_ok: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    symbols_failed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    avg_completeness: Mapped[float | None] = mapped_column(Float, nullable=True)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
