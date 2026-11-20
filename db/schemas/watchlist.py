from datetime import datetime

from pydantic import BaseModel, Field

from db.schemas.common import ORMModel
from db.schemas.stock import StockOut


class WatchlistCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    description: str | None = None
    is_default: bool = False


class WatchlistUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=128)
    description: str | None = None
    is_default: bool | None = None


class WatchlistItemCreate(BaseModel):
    symbol: str = Field(min_length=1, max_length=32)
    is_pinned: bool = False
    sort_order: int = 0
    notes: str | None = None


class WatchlistItemUpdate(BaseModel):
    is_pinned: bool | None = None
    sort_order: int | None = None
    status_label: str | None = None
    notes: str | None = None


class QuoteBrief(BaseModel):
    price: float | None = None
    change: float | None = None
    change_percent: float | None = None
    volume: float | None = None
    avg_volume: float | None = None
    high: float | None = None
    low: float | None = None
    as_of: datetime | None = None
    is_delayed: bool | None = None
    completeness: float | None = None
    quality_flag: str | None = None


class WatchlistItemOut(ORMModel):
    id: int
    watchlist_id: int
    stock_id: int
    is_pinned: bool
    sort_order: int
    status_label: str | None = None
    notes: str | None = None
    stock: StockOut | None = None
    quote: QuoteBrief | None = None


class WatchlistOut(ORMModel):
    id: int
    name: str
    description: str | None = None
    is_default: bool
    created_at: datetime | None = None
    updated_at: datetime | None = None
    item_count: int = 0
    items: list[WatchlistItemOut] = []
