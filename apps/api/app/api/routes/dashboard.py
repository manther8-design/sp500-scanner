from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from apps.api.app.api.deps import get_market_provider
from apps.api.app.api.routes.watchlists import _item_out
from apps.api.app.core.database import get_db
from db.models import Alert, ScanRun, Stock, Watchlist, WatchlistItem
from db.schemas.dashboard import DashboardSummary, ProviderStatus
from providers.base import MarketDataProvider

router = APIRouter(prefix="/dashboard")


@router.get("/summary", response_model=DashboardSummary)
async def dashboard_summary(
    db: Session = Depends(get_db),
    provider: MarketDataProvider = Depends(get_market_provider),
) -> DashboardSummary:
    watchlist_count = db.scalar(select(func.count()).select_from(Watchlist)) or 0
    stock_count = db.scalar(select(func.count()).select_from(Stock)) or 0
    last_scan = db.scalar(select(ScanRun).order_by(ScanRun.id.desc()).limit(1))

    health = await provider.health_check()
    provider_status = ProviderStatus(
        provider=health.get("provider", provider.name),
        status=health.get("status", "unknown"),
        is_delayed=bool(health.get("is_delayed", True)),
        checked_at=health.get("checked_at"),
        sample_price=health.get("sample_price"),
        completeness=health.get("completeness"),
        error=health.get("error"),
    )

    # Build item views from default watchlist using latest quotes
    default_wl = db.scalar(
        select(Watchlist)
        .where(Watchlist.is_default.is_(True))
        .options(selectinload(Watchlist.items).selectinload(WatchlistItem.stock))
    )
    items = []
    if default_wl:
        items = [_item_out(db, item) for item in default_wl.items]

    with_change = [i for i in items if i.quote and i.quote.change_percent is not None]
    gainers = sorted(with_change, key=lambda x: x.quote.change_percent or 0, reverse=True)[:5]
    losers = sorted(with_change, key=lambda x: x.quote.change_percent or 0)[:5]

    def volume_ratio(item: WatchlistItem) -> float:
        # Used only for sorting; missing volumes are skipped, not treated as 0 inventively in UI
        if not item.quote or item.quote.volume is None or not item.quote.avg_volume:
            return -1.0
        return item.quote.volume / item.quote.avg_volume

    high_volume = sorted(
        [i for i in items if i.quote and i.quote.volume is not None and i.quote.avg_volume],
        key=volume_ratio,
        reverse=True,
    )[:5]

    alerts = db.scalars(select(Alert).order_by(Alert.id.desc()).limit(10)).all()
    recent_alerts = [
        {
            "id": a.id,
            "symbol": a.symbol,
            "alert_type": a.alert_type,
            "title": a.title,
            "price": a.price,
            "fired_at": a.fired_at.isoformat() if a.fired_at else None,
            "channel": a.channel,
        }
        for a in alerts
    ]

    return DashboardSummary(
        watchlist_count=watchlist_count,
        stock_count=stock_count,
        last_scan_at=last_scan.finished_at or last_scan.started_at if last_scan else None,
        last_scan_status=last_scan.status if last_scan else None,
        provider=provider_status,
        top_gainers=gainers,
        top_losers=losers,
        high_volume=high_volume,
        recent_alerts=recent_alerts,
    )
