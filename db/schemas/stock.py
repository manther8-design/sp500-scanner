from datetime import datetime

from pydantic import BaseModel

from db.schemas.common import DataMetaOut, ORMModel


class StockOut(ORMModel):
    id: int
    symbol: str
    name: str | None = None
    exchange: str | None = None
    sector: str | None = None
    industry: str | None = None
    market_cap: float | None = None
    market_cap_class: str | None = None
    currency: str | None = None
    is_active: bool
    is_delisted: bool
    last_quote_at: datetime | None = None


class SymbolSearchOut(BaseModel):
    symbol: str
    name: str | None = None
    exchange: str | None = None
    sector: str | None = None
    industry: str | None = None
    market_cap: float | None = None
    currency: str | None = None


class QuoteOut(BaseModel):
    symbol: str
    price: float | None = None
    open: float | None = None
    high: float | None = None
    low: float | None = None
    previous_close: float | None = None
    change: float | None = None
    change_percent: float | None = None
    volume: float | None = None
    avg_volume: float | None = None
    vwap: float | None = None
    bid: float | None = None
    ask: float | None = None
    spread: float | None = None
    name: str | None = None
    sector: str | None = None
    industry: str | None = None
    market_cap: float | None = None
    currency: str | None = None
    exchange: str | None = None
    meta: DataMetaOut | None = None
