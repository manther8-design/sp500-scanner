from sqlalchemy import select
from sqlalchemy.orm import Session

from db.models import DataSource, ScanJob, Stock, UserSettings, Watchlist, WatchlistItem

# Curated starter universe (S&P 500 subset + liquid names). Full universe can be imported via CSV.
DEFAULT_SYMBOLS = [
    "AAPL", "MSFT", "NVDA", "AMZN", "META", "GOOGL", "GOOG", "BRK-B", "LLY", "AVGO",
    "JPM", "TSLA", "V", "UNH", "XOM", "MA", "COST", "PG", "JNJ", "HD",
    "ABBV", "WMT", "NFLX", "MRK", "BAC", "CRM", "CVX", "AMD", "KO", "PEP",
    "TMO", "LIN", "ACN", "MCD", "CSCO", "ABT", "WFC", "INTC", "DIS", "IBM",
    "GE", "CAT", "QCOM", "TXN", "AMAT", "NOW", "ISRG", "SPGI", "BX", "PLTR",
]

CRYPTO_SYMBOLS = ["BTC-USD", "ETH-USD", "SOL-USD", "AVAX-USD"]


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

    # Default watchlist
    wl = db.scalar(select(Watchlist).where(Watchlist.name == "S&P Core"))
    if wl is None:
        wl = Watchlist(
            name="S&P Core",
            description="Starter liquid US equities watchlist",
            is_default=True,
        )
        db.add(wl)
        db.flush()

        for i, symbol in enumerate(DEFAULT_SYMBOLS):
            stock = db.scalar(select(Stock).where(Stock.symbol == symbol))
            if stock is None:
                stock = Stock(symbol=symbol)
                db.add(stock)
                db.flush()
            db.add(
                WatchlistItem(
                    watchlist_id=wl.id,
                    stock_id=stock.id,
                    sort_order=i,
                    is_pinned=symbol in {"AAPL", "NVDA", "MSFT", "TSLA"},
                )
            )

    crypto = db.scalar(select(Watchlist).where(Watchlist.name == "Crypto"))
    if crypto is None:
        crypto = Watchlist(name="Crypto", description="Crypto pairs via Yahoo")
        db.add(crypto)
        db.flush()
        for i, symbol in enumerate(CRYPTO_SYMBOLS):
            stock = db.scalar(select(Stock).where(Stock.symbol == symbol))
            if stock is None:
                stock = Stock(symbol=symbol)
                db.add(stock)
                db.flush()
            db.add(
                WatchlistItem(
                    watchlist_id=crypto.id,
                    stock_id=stock.id,
                    sort_order=i,
                )
            )

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
