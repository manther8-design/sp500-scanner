from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from db.models import (
    DataCollectionLog,
    DataSource,
    MarketBar,
    QuoteSnapshot,
    ScanRun,
    Stock,
    Watchlist,
    WatchlistItem,
)
from db.models.base import utcnow
from providers.base import MarketDataProvider, market_cap_class


class DataCollector:
    def __init__(self, db: Session, provider: MarketDataProvider):
        self.db = db
        self.provider = provider

    def ensure_data_source(self) -> DataSource:
        source = self.db.scalar(
            select(DataSource).where(DataSource.code == self.provider.name)
        )
        if source is None:
            source = DataSource(
                code=self.provider.name,
                name=f"{self.provider.name} provider",
                is_active=True,
                supports_realtime=False,
                status="unknown",
            )
            self.db.add(source)
            self.db.commit()
            self.db.refresh(source)
        return source

    def get_or_create_stock(self, symbol: str, quote_meta: dict | None = None) -> Stock:
        symbol = symbol.upper().strip()
        stock = self.db.scalar(select(Stock).where(Stock.symbol == symbol))
        if stock is None:
            stock = Stock(symbol=symbol)
            self.db.add(stock)
            self.db.flush()

        if quote_meta:
            for key in ("name", "exchange", "sector", "industry", "currency", "market_cap"):
                val = quote_meta.get(key)
                if val is not None:
                    setattr(stock, key, val)
            if quote_meta.get("market_cap") is not None:
                stock.market_cap_class = market_cap_class(quote_meta["market_cap"])
        return stock

    async def upsert_quote(self, symbol: str) -> tuple[Stock, QuoteSnapshot | None, float]:
        quote = await self.provider.get_quote(symbol)
        log = DataCollectionLog(
            source=self.provider.name,
            operation="quote",
            symbol=symbol.upper(),
            status="pending",
            started_at=utcnow(),
        )
        self.db.add(log)

        if quote is None:
            log.status = "failed"
            log.message = "No quote returned"
            log.finished_at = utcnow()
            self.db.commit()
            return self.get_or_create_stock(symbol), None, 0.0

        stock = self.get_or_create_stock(
            symbol,
            {
                "name": quote.name,
                "exchange": quote.exchange,
                "sector": quote.sector,
                "industry": quote.industry,
                "currency": quote.currency,
                "market_cap": quote.market_cap,
            },
        )

        completeness = quote.meta.completeness if quote.meta else None
        snap = QuoteSnapshot(
            stock_id=stock.id,
            source=quote.meta.source if quote.meta else self.provider.name,
            price=quote.price,
            open=quote.open,
            high=quote.high,
            low=quote.low,
            previous_close=quote.previous_close,
            change=quote.change,
            change_percent=quote.change_percent,
            volume=quote.volume,
            avg_volume=quote.avg_volume,
            vwap=quote.vwap,
            bid=quote.bid,
            ask=quote.ask,
            spread=quote.spread,
            as_of=quote.meta.as_of if quote.meta else None,
            ingested_at=quote.meta.ingested_at if quote.meta else utcnow(),
            is_delayed=quote.meta.is_delayed if quote.meta else True,
            data_completeness=completeness,
            quality_flag=quote.meta.quality_flag if quote.meta else None,
        )
        self.db.add(snap)
        stock.last_quote_at = snap.as_of or snap.ingested_at

        log.status = "ok"
        log.records_count = 1
        log.completeness = completeness
        log.finished_at = utcnow()
        log.message = None
        if quote.meta and quote.meta.unavailable_fields:
            log.message = f"unavailable: {','.join(quote.meta.unavailable_fields)}"

        source = self.ensure_data_source()
        source.last_success_at = utcnow()
        source.status = "ok"
        source.last_error = None

        self.db.commit()
        self.db.refresh(snap)
        return stock, snap, completeness or 0.0

    async def upsert_bars(self, symbol: str, timeframe: str = "1d") -> int:
        frame = await self.provider.get_ohlcv(symbol, timeframe=timeframe)
        stock = self.get_or_create_stock(symbol)
        log = DataCollectionLog(
            source=self.provider.name,
            operation=f"ohlcv:{timeframe}",
            symbol=symbol.upper(),
            status="pending",
            started_at=utcnow(),
        )
        self.db.add(log)

        count = 0
        for bar in frame.bars:
            existing = self.db.scalar(
                select(MarketBar).where(
                    MarketBar.stock_id == stock.id,
                    MarketBar.timeframe == timeframe,
                    MarketBar.bar_time == bar.bar_time,
                    MarketBar.source == frame.meta.source,
                )
            )
            if existing:
                existing.open = bar.open
                existing.high = bar.high
                existing.low = bar.low
                existing.close = bar.close
                existing.adjusted_close = bar.adjusted_close
                existing.volume = bar.volume
                existing.vwap = bar.vwap
                existing.trade_count = bar.trade_count
                existing.ingested_at = frame.meta.ingested_at
                existing.is_delayed = frame.meta.is_delayed
                existing.data_completeness = frame.meta.completeness
                existing.quality_flag = frame.meta.quality_flag
            else:
                self.db.add(
                    MarketBar(
                        stock_id=stock.id,
                        timeframe=timeframe,
                        bar_time=bar.bar_time,
                        open=bar.open,
                        high=bar.high,
                        low=bar.low,
                        close=bar.close,
                        adjusted_close=bar.adjusted_close,
                        volume=bar.volume,
                        vwap=bar.vwap,
                        trade_count=bar.trade_count,
                        source=frame.meta.source,
                        ingested_at=frame.meta.ingested_at,
                        is_delayed=frame.meta.is_delayed,
                        data_completeness=frame.meta.completeness,
                        quality_flag=frame.meta.quality_flag,
                    )
                )
            count += 1

        log.status = "ok" if count else "empty"
        log.records_count = count
        log.completeness = frame.meta.completeness
        log.finished_at = utcnow()
        if frame.meta.unavailable_fields:
            log.message = f"unavailable: {','.join(frame.meta.unavailable_fields)}"
        self.db.commit()
        return count

    async def run_scan(
        self,
        *,
        trigger: str = "manual",
        watchlist_id: int | None = None,
        symbols: list[str] | None = None,
        fetch_history: bool = True,
        timeframe: str = "1d",
        job_id: int | None = None,
        existing_run_id: int | None = None,
    ) -> ScanRun:
        if existing_run_id is not None:
            run = self.db.get(ScanRun, existing_run_id)
            if run is None:
                raise ValueError(f"ScanRun {existing_run_id} not found")
            run.status = "running"
            run.job_id = job_id
            run.watchlist_id = watchlist_id
            run.trigger = trigger
            self.db.commit()
            self.db.refresh(run)
        else:
            run = ScanRun(
                job_id=job_id,
                trigger=trigger,
                status="running",
                watchlist_id=watchlist_id,
                started_at=utcnow(),
            )
            self.db.add(run)
            self.db.commit()
            self.db.refresh(run)

        target_symbols: list[str] = []
        if symbols:
            target_symbols = [s.upper().strip() for s in symbols if s.strip()]
        elif watchlist_id is not None:
            items = self.db.scalars(
                select(WatchlistItem).where(WatchlistItem.watchlist_id == watchlist_id)
            ).all()
            for item in items:
                stock = self.db.get(Stock, item.stock_id)
                if stock:
                    target_symbols.append(stock.symbol)
        else:
            default_wl = self.db.scalar(
                select(Watchlist).where(Watchlist.is_default.is_(True))
            )
            if default_wl:
                run.watchlist_id = default_wl.id
                for item in default_wl.items:
                    target_symbols.append(item.stock.symbol)
            else:
                # Fall back to all stocks currently tracked
                target_symbols = list(
                    self.db.scalars(select(Stock.symbol).where(Stock.is_active.is_(True))).all()
                )

        run.symbols_total = len(target_symbols)
        ok = 0
        failed = 0
        completeness_vals: list[float] = []

        for symbol in target_symbols:
            try:
                _, snap, comp = await self.upsert_quote(symbol)
                if snap is None:
                    failed += 1
                else:
                    ok += 1
                    completeness_vals.append(comp)
                if fetch_history:
                    await self.upsert_bars(symbol, timeframe=timeframe)
            except Exception as exc:
                failed += 1
                self.db.add(
                    DataCollectionLog(
                        source=self.provider.name,
                        operation="scan_symbol",
                        symbol=symbol,
                        status="failed",
                        message=str(exc),
                        started_at=utcnow(),
                        finished_at=utcnow(),
                    )
                )
                self.db.commit()

        run.symbols_ok = ok
        run.symbols_failed = failed
        run.avg_completeness = (
            sum(completeness_vals) / len(completeness_vals) if completeness_vals else None
        )
        run.status = "completed"
        run.finished_at = utcnow()
        run.message = f"ok={ok} failed={failed}"
        self.db.commit()
        self.db.refresh(run)
        return run
