from datetime import datetime

from pydantic import BaseModel, Field

from db.schemas.common import ORMModel


class ScanCreate(BaseModel):
    watchlist_id: int | None = None
    symbols: list[str] | None = None
    fetch_history: bool = True
    timeframe: str = "1d"


class ScanIntervalUpdate(BaseModel):
    interval_minutes: int = Field(ge=5, le=1440)
    is_enabled: bool | None = None


class ScanRunOut(ORMModel):
    id: int
    job_id: int | None = None
    trigger: str
    status: str
    watchlist_id: int | None = None
    symbols_total: int
    symbols_ok: int
    symbols_failed: int
    avg_completeness: float | None = None
    message: str | None = None
    started_at: datetime
    finished_at: datetime | None = None
