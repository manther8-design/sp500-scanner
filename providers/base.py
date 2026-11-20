from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Literal, Protocol, runtime_checkable

Timeframe = Literal[
    "1m",
    "3m",
    "5m",
    "15m",
    "30m",
    "1h",
    "4h",
    "1d",
    "1wk",
    "1mo",
]


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class DataMeta:
    source: str
    as_of: datetime | None
    ingested_at: datetime
    is_delayed: bool
    completeness: float
    quality_flag: str = "ok"
    unavailable_fields: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "source": self.source,
            "as_of": self.as_of.isoformat() if self.as_of else None,
            "ingested_at": self.ingested_at.isoformat(),
            "is_delayed": self.is_delayed,
            "completeness": self.completeness,
            "quality_flag": self.quality_flag,
            "unavailable_fields": self.unavailable_fields,
        }


@dataclass
class SymbolInfo:
    symbol: str
    name: str | None = None
    exchange: str | None = None
    sector: str | None = None
    industry: str | None = None
    market_cap: float | None = None
    currency: str | None = None


@dataclass
class Quote:
    symbol: str
    price: float | None
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
    meta: DataMeta | None = None


@dataclass
class OHLCVBar:
    bar_time: datetime
    open: float | None
    high: float | None
    low: float | None
    close: float | None
    adjusted_close: float | None = None
    volume: float | None = None
    vwap: float | None = None
    trade_count: int | None = None


@dataclass
class OHLCVFrame:
    symbol: str
    timeframe: str
    bars: list[OHLCVBar]
    meta: DataMeta


@dataclass
class Fundamentals:
    symbol: str
    revenue_growth: float | None = None
    eps: float | None = None
    pe: float | None = None
    forward_pe: float | None = None
    peg: float | None = None
    ps: float | None = None
    pb: float | None = None
    roe: float | None = None
    roa: float | None = None
    debt_to_equity: float | None = None
    free_cash_flow: float | None = None
    meta: DataMeta | None = None


@runtime_checkable
class MarketDataProvider(Protocol):
    name: str

    async def search_symbols(self, query: str) -> list[SymbolInfo]: ...

    async def get_quote(self, symbol: str) -> Quote | None: ...

    async def get_ohlcv(
        self,
        symbol: str,
        timeframe: str,
        start: datetime | None = None,
        end: datetime | None = None,
    ) -> OHLCVFrame: ...

    async def get_fundamentals(self, symbol: str) -> Fundamentals | None: ...

    async def health_check(self) -> dict: ...


def compute_completeness(values: dict[str, object], required: list[str]) -> tuple[float, list[str]]:
    """Missing values stay None — never coerced to zero."""
    missing: list[str] = []
    present = 0
    for key in required:
        val = values.get(key)
        if val is None:
            missing.append(key)
        else:
            present += 1
    total = len(required) or 1
    return present / total, missing


def market_cap_class(market_cap: float | None) -> str | None:
    if market_cap is None:
        return None
    if market_cap >= 200_000_000_000:
        return "mega"
    if market_cap >= 10_000_000_000:
        return "large"
    if market_cap >= 2_000_000_000:
        return "mid"
    if market_cap >= 300_000_000:
        return "small"
    return "micro"


def get_provider(name: str = "yfinance") -> MarketDataProvider:
    if name == "yfinance":
        from providers.yfinance_provider import YahooFinanceProvider

        return YahooFinanceProvider()
    raise ValueError(f"Unknown data provider: {name}")
