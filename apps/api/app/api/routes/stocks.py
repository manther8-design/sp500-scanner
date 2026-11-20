from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from apps.api.app.api.deps import get_collector, get_market_provider
from apps.api.app.core.database import get_db
from db.models import MarketBar, QuoteSnapshot, Stock
from db.schemas.stock import QuoteOut, StockOut, SymbolSearchOut
from db.schemas.common import DataMetaOut
from providers.base import MarketDataProvider
from services.data_collector import DataCollector

router = APIRouter(prefix="/stocks")


@router.get("/search", response_model=list[SymbolSearchOut])
async def search_stocks(
    q: str = Query(min_length=1),
    db: Session = Depends(get_db),
    provider: MarketDataProvider = Depends(get_market_provider),
) -> list[SymbolSearchOut]:
    local = db.scalars(
        select(Stock).where(
            or_(
                Stock.symbol.ilike(f"%{q}%"),
                Stock.name.ilike(f"%{q}%"),
            )
        ).limit(20)
    ).all()
    results = [
        SymbolSearchOut(
            symbol=s.symbol,
            name=s.name,
            exchange=s.exchange,
            sector=s.sector,
            industry=s.industry,
            market_cap=s.market_cap,
            currency=s.currency,
        )
        for s in local
    ]
    seen = {r.symbol for r in results}
    remote = await provider.search_symbols(q)
    for item in remote:
        if item.symbol not in seen:
            results.append(
                SymbolSearchOut(
                    symbol=item.symbol,
                    name=item.name,
                    exchange=item.exchange,
                    sector=item.sector,
                    industry=item.industry,
                    market_cap=item.market_cap,
                    currency=item.currency,
                )
            )
    return results[:25]


@router.get("/{symbol}", response_model=StockOut)
def get_stock(symbol: str, db: Session = Depends(get_db)) -> StockOut:
    stock = db.scalar(select(Stock).where(Stock.symbol == symbol.upper()))
    if stock is None:
        raise HTTPException(status_code=404, detail="Stock not found")
    return StockOut.model_validate(stock)


@router.get("/{symbol}/quote", response_model=QuoteOut)
async def get_quote(
    symbol: str,
    refresh: bool = Query(default=True),
    db: Session = Depends(get_db),
    collector: DataCollector = Depends(get_collector),
    provider: MarketDataProvider = Depends(get_market_provider),
) -> QuoteOut:
    symbol = symbol.upper()
    if refresh:
        stock, snap, _ = await collector.upsert_quote(symbol)
        if snap is None:
            # Fall through to live provider response without persisting zeros
            live = await provider.get_quote(symbol)
            if live is None:
                raise HTTPException(status_code=404, detail="Quote unavailable")
            return QuoteOut(
                symbol=live.symbol,
                price=live.price,
                open=live.open,
                high=live.high,
                low=live.low,
                previous_close=live.previous_close,
                change=live.change,
                change_percent=live.change_percent,
                volume=live.volume,
                avg_volume=live.avg_volume,
                vwap=live.vwap,
                bid=live.bid,
                ask=live.ask,
                spread=live.spread,
                name=live.name,
                sector=live.sector,
                industry=live.industry,
                market_cap=live.market_cap,
                currency=live.currency,
                exchange=live.exchange,
                meta=DataMetaOut(**live.meta.to_dict()) if live.meta else None,
            )
        return QuoteOut(
            symbol=stock.symbol,
            price=snap.price,
            open=snap.open,
            high=snap.high,
            low=snap.low,
            previous_close=snap.previous_close,
            change=snap.change,
            change_percent=snap.change_percent,
            volume=snap.volume,
            avg_volume=snap.avg_volume,
            vwap=snap.vwap,
            bid=snap.bid,
            ask=snap.ask,
            spread=snap.spread,
            name=stock.name,
            sector=stock.sector,
            industry=stock.industry,
            market_cap=stock.market_cap,
            currency=stock.currency,
            exchange=stock.exchange,
            meta=DataMetaOut(
                source=snap.source,
                as_of=snap.as_of,
                ingested_at=snap.ingested_at,
                is_delayed=snap.is_delayed,
                completeness=snap.data_completeness,
                quality_flag=snap.quality_flag,
                unavailable_fields=[],
            ),
        )

    stock = db.scalar(select(Stock).where(Stock.symbol == symbol))
    if stock is None:
        raise HTTPException(status_code=404, detail="Stock not found")
    snap = db.scalar(
        select(QuoteSnapshot)
        .where(QuoteSnapshot.stock_id == stock.id)
        .order_by(QuoteSnapshot.ingested_at.desc())
        .limit(1)
    )
    if snap is None:
        raise HTTPException(status_code=404, detail="No stored quote")
    return QuoteOut(
        symbol=stock.symbol,
        price=snap.price,
        open=snap.open,
        high=snap.high,
        low=snap.low,
        previous_close=snap.previous_close,
        change=snap.change,
        change_percent=snap.change_percent,
        volume=snap.volume,
        avg_volume=snap.avg_volume,
        vwap=snap.vwap,
        bid=snap.bid,
        ask=snap.ask,
        spread=snap.spread,
        name=stock.name,
        sector=stock.sector,
        industry=stock.industry,
        market_cap=stock.market_cap,
        currency=stock.currency,
        exchange=stock.exchange,
        meta=DataMetaOut(
            source=snap.source,
            as_of=snap.as_of,
            ingested_at=snap.ingested_at,
            is_delayed=snap.is_delayed,
            completeness=snap.data_completeness,
            quality_flag=snap.quality_flag,
        ),
    )


@router.get("/{symbol}/bars")
def get_bars(
    symbol: str,
    timeframe: str = "1d",
    limit: int = Query(default=90, ge=1, le=5000),
    db: Session = Depends(get_db),
) -> dict:
    stock = db.scalar(select(Stock).where(Stock.symbol == symbol.upper()))
    if stock is None:
        raise HTTPException(status_code=404, detail="Stock not found")
    bars = db.scalars(
        select(MarketBar)
        .where(MarketBar.stock_id == stock.id, MarketBar.timeframe == timeframe)
        .order_by(MarketBar.bar_time.desc())
        .limit(limit)
    ).all()
    bars = list(reversed(bars))
    return {
        "symbol": stock.symbol,
        "timeframe": timeframe,
        "count": len(bars),
        "bars": [
            {
                "bar_time": b.bar_time.isoformat() if b.bar_time else None,
                "open": b.open,
                "high": b.high,
                "low": b.low,
                "close": b.close,
                "adjusted_close": b.adjusted_close,
                "volume": b.volume,
                "vwap": b.vwap,
                "source": b.source,
                "ingested_at": b.ingested_at.isoformat() if b.ingested_at else None,
                "is_delayed": b.is_delayed,
                "completeness": b.data_completeness,
                "quality_flag": b.quality_flag,
            }
            for b in bars
        ],
    }
