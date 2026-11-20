from __future__ import annotations

import csv
import io
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from apps.api.app.api.deps import get_market_provider
from apps.api.app.core.database import get_db
from db.models import QuoteSnapshot, Stock, Watchlist, WatchlistItem
from db.schemas.watchlist import (
    QuoteBrief,
    WatchlistCreate,
    WatchlistItemCreate,
    WatchlistItemOut,
    WatchlistItemUpdate,
    WatchlistOut,
    WatchlistUpdate,
)
from providers.base import MarketDataProvider, market_cap_class

router = APIRouter(prefix="/watchlists")


def _latest_quote(db: Session, stock_id: int) -> QuoteSnapshot | None:
    return db.scalar(
        select(QuoteSnapshot)
        .where(QuoteSnapshot.stock_id == stock_id)
        .order_by(QuoteSnapshot.ingested_at.desc())
        .limit(1)
    )


def _item_out(db: Session, item: WatchlistItem) -> WatchlistItemOut:
    quote = _latest_quote(db, item.stock_id)
    brief = None
    if quote:
        brief = QuoteBrief(
            price=quote.price,
            change=quote.change,
            change_percent=quote.change_percent,
            volume=quote.volume,
            avg_volume=quote.avg_volume,
            high=quote.high,
            low=quote.low,
            as_of=quote.as_of,
            is_delayed=quote.is_delayed,
            completeness=quote.data_completeness,
            quality_flag=quote.quality_flag,
        )
    return WatchlistItemOut(
        id=item.id,
        watchlist_id=item.watchlist_id,
        stock_id=item.stock_id,
        is_pinned=item.is_pinned,
        sort_order=item.sort_order,
        status_label=item.status_label,
        notes=item.notes,
        stock=item.stock,
        quote=brief,
    )


def _watchlist_out(db: Session, wl: Watchlist, include_items: bool = True) -> WatchlistOut:
    items = []
    if include_items:
        items = [_item_out(db, item) for item in wl.items]
    return WatchlistOut(
        id=wl.id,
        name=wl.name,
        description=wl.description,
        is_default=wl.is_default,
        created_at=wl.created_at,
        updated_at=wl.updated_at,
        item_count=len(wl.items),
        items=items if include_items else [],
    )


def _get_watchlist(db: Session, watchlist_id: int) -> Watchlist:
    wl = db.scalar(
        select(Watchlist)
        .where(Watchlist.id == watchlist_id)
        .options(selectinload(Watchlist.items).selectinload(WatchlistItem.stock))
    )
    if wl is None:
        raise HTTPException(status_code=404, detail="Watchlist not found")
    return wl


@router.get("", response_model=list[WatchlistOut])
def list_watchlists(db: Session = Depends(get_db)) -> list[WatchlistOut]:
    rows = db.scalars(
        select(Watchlist).options(selectinload(Watchlist.items).selectinload(WatchlistItem.stock))
    ).all()
    return [_watchlist_out(db, wl, include_items=False) for wl in rows]


@router.post("", response_model=WatchlistOut, status_code=201)
def create_watchlist(payload: WatchlistCreate, db: Session = Depends(get_db)) -> WatchlistOut:
    existing = db.scalar(select(Watchlist).where(Watchlist.name == payload.name))
    if existing:
        raise HTTPException(status_code=409, detail="Watchlist name already exists")
    if payload.is_default:
        for wl in db.scalars(select(Watchlist).where(Watchlist.is_default.is_(True))).all():
            wl.is_default = False
    wl = Watchlist(
        name=payload.name,
        description=payload.description,
        is_default=payload.is_default,
    )
    db.add(wl)
    db.commit()
    return _watchlist_out(db, _get_watchlist(db, wl.id))


@router.get("/{watchlist_id}", response_model=WatchlistOut)
def get_watchlist(watchlist_id: int, db: Session = Depends(get_db)) -> WatchlistOut:
    return _watchlist_out(db, _get_watchlist(db, watchlist_id))


@router.patch("/{watchlist_id}", response_model=WatchlistOut)
def update_watchlist(
    watchlist_id: int, payload: WatchlistUpdate, db: Session = Depends(get_db)
) -> WatchlistOut:
    wl = _get_watchlist(db, watchlist_id)
    data = payload.model_dump(exclude_unset=True)
    if "name" in data and data["name"] != wl.name:
        clash = db.scalar(select(Watchlist).where(Watchlist.name == data["name"]))
        if clash:
            raise HTTPException(status_code=409, detail="Watchlist name already exists")
    if data.get("is_default") is True:
        for other in db.scalars(select(Watchlist).where(Watchlist.is_default.is_(True))).all():
            other.is_default = False
    for key, value in data.items():
        setattr(wl, key, value)
    db.commit()
    return _watchlist_out(db, _get_watchlist(db, watchlist_id))


@router.delete("/{watchlist_id}", status_code=204)
def delete_watchlist(watchlist_id: int, db: Session = Depends(get_db)) -> None:
    wl = _get_watchlist(db, watchlist_id)
    db.delete(wl)
    db.commit()


async def _resolve_stock(
    db: Session,
    symbol: str,
    provider: MarketDataProvider,
) -> Stock:
    symbol = symbol.upper().strip()
    stock = db.scalar(select(Stock).where(Stock.symbol == symbol))
    if stock is None:
        stock = Stock(symbol=symbol)
        db.add(stock)
        db.flush()
    try:
        quote = await provider.get_quote(symbol)
        if quote:
            if quote.name:
                stock.name = quote.name
            if quote.exchange:
                stock.exchange = quote.exchange
            if quote.sector:
                stock.sector = quote.sector
            if quote.industry:
                stock.industry = quote.industry
            if quote.currency:
                stock.currency = quote.currency
            if quote.market_cap is not None:
                stock.market_cap = quote.market_cap
                stock.market_cap_class = market_cap_class(quote.market_cap)
    except Exception:
        pass
    return stock


@router.post("/{watchlist_id}/items", response_model=WatchlistItemOut, status_code=201)
async def add_item(
    watchlist_id: int,
    payload: WatchlistItemCreate,
    db: Session = Depends(get_db),
    provider: MarketDataProvider = Depends(get_market_provider),
) -> WatchlistItemOut:
    wl = _get_watchlist(db, watchlist_id)
    stock = await _resolve_stock(db, payload.symbol, provider)
    existing = db.scalar(
        select(WatchlistItem).where(
            WatchlistItem.watchlist_id == wl.id,
            WatchlistItem.stock_id == stock.id,
        )
    )
    if existing:
        raise HTTPException(status_code=409, detail="Symbol already in watchlist")
    item = WatchlistItem(
        watchlist_id=wl.id,
        stock_id=stock.id,
        is_pinned=payload.is_pinned,
        sort_order=payload.sort_order,
        notes=payload.notes,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    item = db.scalar(
        select(WatchlistItem)
        .where(WatchlistItem.id == item.id)
        .options(selectinload(WatchlistItem.stock))
    )
    return _item_out(db, item)  # type: ignore[arg-type]


@router.patch("/{watchlist_id}/items/{item_id}", response_model=WatchlistItemOut)
def update_item(
    watchlist_id: int,
    item_id: int,
    payload: WatchlistItemUpdate,
    db: Session = Depends(get_db),
) -> WatchlistItemOut:
    _get_watchlist(db, watchlist_id)
    item = db.scalar(
        select(WatchlistItem)
        .where(WatchlistItem.id == item_id, WatchlistItem.watchlist_id == watchlist_id)
        .options(selectinload(WatchlistItem.stock))
    )
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return _item_out(db, item)


@router.delete("/{watchlist_id}/items/{item_id}", status_code=204)
def delete_item(watchlist_id: int, item_id: int, db: Session = Depends(get_db)) -> None:
    item = db.scalar(
        select(WatchlistItem).where(
            WatchlistItem.id == item_id, WatchlistItem.watchlist_id == watchlist_id
        )
    )
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()


def _parse_symbols_from_csv(content: bytes) -> list[str]:
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    symbols: list[str] = []
    if reader.fieldnames:
        fields = [f.lower().strip() for f in reader.fieldnames]
        symbol_key = None
        for candidate in ("symbol", "ticker", "sym", "code"):
            if candidate in fields:
                symbol_key = reader.fieldnames[fields.index(candidate)]
                break
        if symbol_key:
            for row in reader:
                val = (row.get(symbol_key) or "").strip()
                if val:
                    symbols.append(val.upper())
            return symbols
    # Plain list — restart
    for line in text.splitlines():
        part = line.split(",")[0].strip().strip('"')
        if part and part.lower() not in {"symbol", "ticker", "sym", "code"}:
            symbols.append(part.upper())
    return symbols


def _parse_symbols_from_xlsx(content: bytes) -> list[str]:
    from openpyxl import load_workbook

    wb = load_workbook(filename=io.BytesIO(content), read_only=True, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return []
    header = [str(c).strip().lower() if c is not None else "" for c in rows[0]]
    col_idx = 0
    for candidate in ("symbol", "ticker", "sym", "code"):
        if candidate in header:
            col_idx = header.index(candidate)
            data_rows = rows[1:]
            break
    else:
        data_rows = rows
    symbols: list[str] = []
    for row in data_rows:
        if not row or row[col_idx] is None:
            continue
        val = str(row[col_idx]).strip().upper()
        if val and val.lower() not in {"symbol", "ticker"}:
            symbols.append(val)
    return symbols


@router.post("/{watchlist_id}/import")
async def import_symbols(
    watchlist_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    provider: MarketDataProvider = Depends(get_market_provider),
) -> dict[str, Any]:
    wl = _get_watchlist(db, watchlist_id)
    content = await file.read()
    filename = (file.filename or "").lower()
    if filename.endswith(".xlsx") or filename.endswith(".xls"):
        symbols = _parse_symbols_from_xlsx(content)
    else:
        symbols = _parse_symbols_from_csv(content)

    added = 0
    skipped = 0
    seen_stock_ids: set[int] = set()
    for symbol in symbols:
        stock = await _resolve_stock(db, symbol, provider)
        if stock.id in seen_stock_ids:
            skipped += 1
            continue
        existing = db.scalar(
            select(WatchlistItem).where(
                WatchlistItem.watchlist_id == wl.id,
                WatchlistItem.stock_id == stock.id,
            )
        )
        if existing:
            skipped += 1
            seen_stock_ids.add(stock.id)
            continue
        db.add(
            WatchlistItem(
                watchlist_id=wl.id,
                stock_id=stock.id,
                sort_order=added + skipped,
            )
        )
        db.flush()
        seen_stock_ids.add(stock.id)
        added += 1
    db.commit()
    return {
        "watchlist_id": wl.id,
        "parsed": len(symbols),
        "added": added,
        "skipped": skipped,
    }
