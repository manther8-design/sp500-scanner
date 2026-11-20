from datetime import datetime

from pydantic import BaseModel

from db.schemas.watchlist import WatchlistItemOut


class ProviderStatus(BaseModel):
    provider: str
    status: str
    is_delayed: bool = True
    checked_at: datetime | str | None = None
    sample_price: float | None = None
    completeness: float | None = None
    error: str | None = None


class DashboardSummary(BaseModel):
    watchlist_count: int
    stock_count: int
    last_scan_at: datetime | None = None
    last_scan_status: str | None = None
    provider: ProviderStatus
    top_gainers: list[WatchlistItemOut] = []
    top_losers: list[WatchlistItemOut] = []
    high_volume: list[WatchlistItemOut] = []
    recent_alerts: list[dict] = []
