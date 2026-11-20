from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any

import pandas as pd
import yfinance as yf

from providers.base import (
    DataMeta,
    Fundamentals,
    OHLCVBar,
    OHLCVFrame,
    Quote,
    SymbolInfo,
    compute_completeness,
    utcnow,
)

YF_INTERVAL_MAP = {
    "1m": "1m",
    "5m": "5m",
    "15m": "15m",
    "30m": "30m",
    "1h": "1h",
    "1d": "1d",
    "1wk": "1wk",
    "1mo": "1mo",
}

QUOTE_FIELDS = [
    "price",
    "open",
    "high",
    "low",
    "previous_close",
    "volume",
    "avg_volume",
    "vwap",
    "bid",
    "ask",
]

BAR_FIELDS = ["open", "high", "low", "close", "volume", "adjusted_close", "vwap"]


def _to_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        if pd.isna(value):
            return None
    except (TypeError, ValueError):
        pass
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _ts_to_utc(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)
    try:
        ts = pd.Timestamp(value)
        if ts.tzinfo is None:
            ts = ts.tz_localize("UTC")
        else:
            ts = ts.tz_convert("UTC")
        return ts.to_pydatetime()
    except Exception:
        return None


class YahooFinanceProvider:
    name = "yfinance"

    async def search_symbols(self, query: str) -> list[SymbolInfo]:
        return await asyncio.to_thread(self._search_symbols_sync, query)

    def _search_symbols_sync(self, query: str) -> list[SymbolInfo]:
        q = query.strip()
        if not q:
            return []

        results: list[SymbolInfo] = []
        seen: set[str] = set()

        # Direct ticker lookup first
        ticker = yf.Ticker(q.upper())
        info = {}
        try:
            info = ticker.info or {}
        except Exception:
            info = {}

        symbol = (info.get("symbol") or q.upper()).upper()
        if info.get("regularMarketPrice") is not None or info.get("shortName") or info.get("longName"):
            results.append(
                SymbolInfo(
                    symbol=symbol,
                    name=info.get("longName") or info.get("shortName"),
                    exchange=info.get("exchange"),
                    sector=info.get("sector"),
                    industry=info.get("industry"),
                    market_cap=_to_float(info.get("marketCap")),
                    currency=info.get("currency"),
                )
            )
            seen.add(symbol)

        # Fallback: treat query as symbol prefix via download probe is unreliable;
        # return direct match only. Name search without paid API stays limited.
        if not results and len(q) <= 8:
            results.append(SymbolInfo(symbol=q.upper(), name=None))

        return results

    async def get_quote(self, symbol: str) -> Quote | None:
        return await asyncio.to_thread(self._get_quote_sync, symbol.upper())

    def _get_quote_sync(self, symbol: str) -> Quote | None:
        ticker = yf.Ticker(symbol)
        info: dict[str, Any] = {}
        try:
            info = ticker.info or {}
        except Exception:
            info = {}

        fast: dict[str, Any] = {}
        try:
            fast = ticker.fast_info or {}
        except Exception:
            fast = {}

        price = _to_float(
            info.get("regularMarketPrice")
            or fast.get("lastPrice")
            or info.get("currentPrice")
        )
        previous_close = _to_float(
            info.get("regularMarketPreviousClose")
            or fast.get("previousClose")
            or info.get("previousClose")
        )
        open_ = _to_float(info.get("regularMarketOpen") or fast.get("open") or info.get("open"))
        high = _to_float(
            info.get("regularMarketDayHigh") or fast.get("dayHigh") or info.get("dayHigh")
        )
        low = _to_float(
            info.get("regularMarketDayLow") or fast.get("dayLow") or info.get("dayLow")
        )
        volume = _to_float(
            info.get("regularMarketVolume") or fast.get("lastVolume") or info.get("volume")
        )
        avg_volume = _to_float(
            info.get("averageVolume") or info.get("averageDailyVolume10Day") or fast.get("threeMonthAverageVolume")
        )
        bid = _to_float(info.get("bid"))
        ask = _to_float(info.get("ask"))
        # Yahoo does not expose reliable session VWAP via free endpoints → keep None
        vwap = _to_float(info.get("averagePrice"))

        spread = None
        if bid is not None and ask is not None:
            spread = ask - bid

        change = None
        change_percent = None
        if price is not None and previous_close is not None and previous_close != 0:
            change = price - previous_close
            change_percent = (change / previous_close) * 100.0

        as_of = _ts_to_utc(info.get("regularMarketTime"))
        if as_of is None:
            as_of = utcnow()

        values = {
            "price": price,
            "open": open_,
            "high": high,
            "low": low,
            "previous_close": previous_close,
            "volume": volume,
            "avg_volume": avg_volume,
            "vwap": vwap,
            "bid": bid,
            "ask": ask,
        }
        completeness, missing = compute_completeness(values, QUOTE_FIELDS)
        quality = "ok" if completeness >= 0.6 else "partial" if completeness > 0 else "empty"

        if price is None and previous_close is None:
            # Still return a shell with meta so callers can show incompleteness
            if not info and not fast:
                return None

        meta = DataMeta(
            source=self.name,
            as_of=as_of,
            ingested_at=utcnow(),
            is_delayed=True,
            completeness=completeness,
            quality_flag=quality,
            unavailable_fields=missing,
        )

        return Quote(
            symbol=symbol,
            price=price,
            open=open_,
            high=high,
            low=low,
            previous_close=previous_close,
            change=change,
            change_percent=change_percent,
            volume=volume,
            avg_volume=avg_volume,
            vwap=vwap,
            bid=bid,
            ask=ask,
            spread=spread,
            name=info.get("longName") or info.get("shortName"),
            sector=info.get("sector"),
            industry=info.get("industry"),
            market_cap=_to_float(info.get("marketCap")),
            currency=info.get("currency") or fast.get("currency"),
            exchange=info.get("exchange"),
            meta=meta,
        )

    async def get_ohlcv(
        self,
        symbol: str,
        timeframe: str = "1d",
        start: datetime | None = None,
        end: datetime | None = None,
    ) -> OHLCVFrame:
        return await asyncio.to_thread(
            self._get_ohlcv_sync, symbol.upper(), timeframe, start, end
        )

    def _get_ohlcv_sync(
        self,
        symbol: str,
        timeframe: str,
        start: datetime | None,
        end: datetime | None,
    ) -> OHLCVFrame:
        interval = YF_INTERVAL_MAP.get(timeframe)
        if interval is None:
            # Unsupported timeframes (3m, 4h, tick) are not fabricated
            meta = DataMeta(
                source=self.name,
                as_of=None,
                ingested_at=utcnow(),
                is_delayed=True,
                completeness=0.0,
                quality_flag="unsupported_timeframe",
                unavailable_fields=BAR_FIELDS + ["timeframe"],
            )
            return OHLCVFrame(symbol=symbol, timeframe=timeframe, bars=[], meta=meta)

        kwargs: dict[str, Any] = {"interval": interval, "auto_adjust": False, "progress": False}
        if start is not None:
            kwargs["start"] = start
        if end is not None:
            kwargs["end"] = end
        if start is None and end is None:
            kwargs["period"] = "3mo" if interval in {"1d", "1wk", "1mo"} else "5d"

        try:
            df = yf.download(symbol, **kwargs)
        except Exception:
            df = pd.DataFrame()

        bars: list[OHLCVBar] = []
        if df is not None and not df.empty:
            if isinstance(df.columns, pd.MultiIndex):
                df.columns = df.columns.get_level_values(0)
            for idx, row in df.iterrows():
                bar_time = _ts_to_utc(idx)
                if bar_time is None:
                    continue
                open_ = _to_float(row.get("Open"))
                high = _to_float(row.get("High"))
                low = _to_float(row.get("Low"))
                close = _to_float(row.get("Close"))
                adj = _to_float(row.get("Adj Close"))
                volume = _to_float(row.get("Volume"))
                # VWAP / trade_count unavailable on yfinance daily download → None
                bars.append(
                    OHLCVBar(
                        bar_time=bar_time,
                        open=open_,
                        high=high,
                        low=low,
                        close=close,
                        adjusted_close=adj,
                        volume=volume,
                        vwap=None,
                        trade_count=None,
                    )
                )

        sample_values = {
            "open": bars[-1].open if bars else None,
            "high": bars[-1].high if bars else None,
            "low": bars[-1].low if bars else None,
            "close": bars[-1].close if bars else None,
            "volume": bars[-1].volume if bars else None,
            "adjusted_close": bars[-1].adjusted_close if bars else None,
            "vwap": None,
        }
        completeness, missing = compute_completeness(sample_values, BAR_FIELDS)
        if not bars:
            completeness = 0.0
            missing = BAR_FIELDS.copy()

        meta = DataMeta(
            source=self.name,
            as_of=bars[-1].bar_time if bars else None,
            ingested_at=utcnow(),
            is_delayed=True,
            completeness=completeness,
            quality_flag="ok" if bars else "empty",
            unavailable_fields=missing,
        )
        return OHLCVFrame(symbol=symbol, timeframe=timeframe, bars=bars, meta=meta)

    async def get_fundamentals(self, symbol: str) -> Fundamentals | None:
        return await asyncio.to_thread(self._get_fundamentals_sync, symbol.upper())

    def _get_fundamentals_sync(self, symbol: str) -> Fundamentals | None:
        ticker = yf.Ticker(symbol)
        try:
            info = ticker.info or {}
        except Exception:
            return None

        fields = {
            "revenue_growth": _to_float(info.get("revenueGrowth")),
            "eps": _to_float(info.get("trailingEps")),
            "pe": _to_float(info.get("trailingPE")),
            "forward_pe": _to_float(info.get("forwardPE")),
            "peg": _to_float(info.get("pegRatio")),
            "ps": _to_float(info.get("priceToSalesTrailing12Months")),
            "pb": _to_float(info.get("priceToBook")),
            "roe": _to_float(info.get("returnOnEquity")),
            "roa": _to_float(info.get("returnOnAssets")),
            "debt_to_equity": _to_float(info.get("debtToEquity")),
            "free_cash_flow": _to_float(info.get("freeCashflow")),
        }
        completeness, missing = compute_completeness(fields, list(fields.keys()))
        meta = DataMeta(
            source=self.name,
            as_of=utcnow(),
            ingested_at=utcnow(),
            is_delayed=True,
            completeness=completeness,
            quality_flag="ok" if completeness > 0 else "empty",
            unavailable_fields=missing,
        )
        return Fundamentals(symbol=symbol, meta=meta, **fields)

    async def health_check(self) -> dict:
        try:
            quote = await self.get_quote("AAPL")
            ok = quote is not None and quote.price is not None
            return {
                "provider": self.name,
                "status": "ok" if ok else "degraded",
                "is_delayed": True,
                "checked_at": utcnow().isoformat(),
                "sample_symbol": "AAPL",
                "sample_price": quote.price if quote else None,
                "completeness": quote.meta.completeness if quote and quote.meta else 0.0,
            }
        except Exception as exc:
            return {
                "provider": self.name,
                "status": "error",
                "is_delayed": True,
                "checked_at": utcnow().isoformat(),
                "error": str(exc),
            }
