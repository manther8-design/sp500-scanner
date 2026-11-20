from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from db.models.base import Base, TimestampMixin, utcnow


class Alert(Base, TimestampMixin):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(primary_key=True)
    stock_id: Mapped[int | None] = mapped_column(ForeignKey("stocks.id", ondelete="SET NULL"), nullable=True)
    symbol: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    alert_type: Mapped[str] = mapped_column(String(64), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    price: Mapped[float | None] = mapped_column(Float, nullable=True)
    channel: Mapped[str] = mapped_column(String(32), default="in_app", nullable=False)
    is_sent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    dedupe_key: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    fired_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
