from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.models.base import Base, TimestampMixin, utcnow


class Stock(Base, TimestampMixin):
    __tablename__ = "stocks"

    id: Mapped[int] = mapped_column(primary_key=True)
    symbol: Mapped[str] = mapped_column(String(32), unique=True, index=True, nullable=False)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    exchange: Mapped[str | None] = mapped_column(String(64), nullable=True)
    sector: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    industry: Mapped[str | None] = mapped_column(String(128), nullable=True)
    market_cap: Mapped[float | None] = mapped_column(Float, nullable=True)
    market_cap_class: Mapped[str | None] = mapped_column(String(32), nullable=True)
    currency: Mapped[str | None] = mapped_column(String(16), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_delisted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_quote_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    watchlist_items = relationship("WatchlistItem", back_populates="stock")
    quotes = relationship("QuoteSnapshot", back_populates="stock")
    bars = relationship("MarketBar", back_populates="stock")
