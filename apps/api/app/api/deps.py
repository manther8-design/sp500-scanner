from fastapi import Depends
from sqlalchemy.orm import Session

from apps.api.app.core.config import Settings, get_settings
from apps.api.app.core.database import get_db
from providers.base import MarketDataProvider, get_provider
from services.data_collector import DataCollector


def get_market_provider(settings: Settings = Depends(get_settings)) -> MarketDataProvider:
    return get_provider(settings.data_provider)


def get_collector(
    db: Session = Depends(get_db),
    provider: MarketDataProvider = Depends(get_market_provider),
) -> DataCollector:
    return DataCollector(db=db, provider=provider)
