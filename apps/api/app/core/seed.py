from sqlalchemy import select
from sqlalchemy.orm import Session

from apps.api.app.core.symbols_sp150 import DEFAULT_SYMBOLS, PINNED_SYMBOLS
from db.models import DataSource, ScanJob, Stock, UserSettings, Watchlist, WatchlistItem

CRYPTO_SYMBOLS = ["BTC-USD", "ETH-USD", "SOL-USD", "AVAX-USD"]


def _ensure_stock(db: Session, symbol: str) -> Stock:
    stock = db.scalar(select(Stock).where(Stock.symbol == symbol))
    if stock is None:
        stock = Stock(symbol=symbol)
        db.add(stock)
        db.flush()
    return stock


def sync_watchlist_symbols(
    db: Session,
    watchlist: Watchlist,
    symbols: list[str],
    *,
    pinned: set[str] | None = None,
) -> int:
    """Add any missing symbols to a watchlist. Returns number of newly added items."""
    pinned = pinned or set()
    items = db.scalars(
        select(WatchlistItem).where(WatchlistItem.watchlist_id == watchlist.id)
    ).all()
    existing_stock_ids = {item.stock_id for item in items}
    existing_symbols: set[str] = set()
    if existing_stock_ids:
        existing_symbols = set(
            db.scalars(select(Stock.symbol).where(Stock.id.in_(existing_stock_ids))).all()
        )

    added = 0
    for i, symbol in enumerate(symbols):
        if symbol in existing_symbols:
            continue
        stock = _ensure_stock(db, symbol)
        linked = db.scalar(
            select(WatchlistItem).where(
                WatchlistItem.watchlist_id == watchlist.id,
                WatchlistItem.stock_id == stock.id,
            )
        )
        if linked:
            continue
        db.add(
            WatchlistItem(
                watchlist_id=watchlist.id,
                stock_id=stock.id,
                sort_order=i,
                is_pinned=symbol in pinned,
            )
        )
        existing_symbols.add(symbol)
        added += 1
    return added


def seed_defaults(db: Session) -> None:
    # Data source
    if db.scalar(select(DataSource).where(DataSource.code == "yfinance")) is None:
        db.add(
            DataSource(
                code="yfinance",
                name="Yahoo Finance (yfinance)",
                is_active=True,
                supports_realtime=False,
                status="unknown",
                notes="Delayed quotes; missing fields stay null.",
            )
        )

    # Settings
    defaults = {
        "scan_interval_minutes": ("60", 60, None, "Default automatic scan interval"),
        "alert_dedupe_minutes": ("30", 30, None, "Suppress duplicate alerts within N minutes"),
    }
    for key, (value, value_int, value_float, desc) in defaults.items():
        if db.scalar(select(UserSettings).where(UserSettings.key == key)) is None:
            db.add(
                UserSettings(
                    key=key,
                    value=value,
                    value_int=value_int,
                    value_float=value_float,
                    description=desc,
                )
            )

    # Default watchlist — create or top-up to 150 symbols
    wl = db.scalar(select(Watchlist).where(Watchlist.name == "S&P Core"))
    if wl is None:
        wl = Watchlist(
            name="S&P Core",
            description="150 liquid US equities starter watchlist",
            is_default=True,
        )
        db.add(wl)
        db.flush()
    else:
        if not wl.description:
            wl.description = "150 liquid US equities starter watchlist"

    sync_watchlist_symbols(db, wl, DEFAULT_SYMBOLS, pinned=PINNED_SYMBOLS)

    crypto = db.scalar(select(Watchlist).where(Watchlist.name == "Crypto"))
    if crypto is None:
        crypto = Watchlist(name="Crypto", description="Crypto pairs via Yahoo")
        db.add(crypto)
        db.flush()
    sync_watchlist_symbols(db, crypto, CRYPTO_SYMBOLS)

    # Scan job
    if db.scalar(select(ScanJob).where(ScanJob.name == "default")) is None:
        interval = 60
        setting = db.scalar(
            select(UserSettings).where(UserSettings.key == "scan_interval_minutes")
        )
        if setting and setting.value_int:
            interval = setting.value_int
        db.add(
            ScanJob(
                name="default",
                watchlist_id=wl.id if wl else None,
                interval_minutes=interval,
                is_enabled=True,
            )
        )

    db.commit()
