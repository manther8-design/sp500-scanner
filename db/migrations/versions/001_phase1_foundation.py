"""phase1 foundation tables

Revision ID: 001_phase1
Revises:
Create Date: 2026-11-20

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "001_phase1"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "stocks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("symbol", sa.String(32), nullable=False),
        sa.Column("name", sa.String(255)),
        sa.Column("exchange", sa.String(64)),
        sa.Column("sector", sa.String(128)),
        sa.Column("industry", sa.String(128)),
        sa.Column("market_cap", sa.Float()),
        sa.Column("market_cap_class", sa.String(32)),
        sa.Column("currency", sa.String(16)),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("is_delisted", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("notes", sa.Text()),
        sa.Column("last_quote_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_stocks_symbol", "stocks", ["symbol"], unique=True)

    op.create_table(
        "watchlists",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(128), nullable=False, unique=True),
        sa.Column("description", sa.Text()),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "watchlist_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("watchlist_id", sa.Integer(), sa.ForeignKey("watchlists.id", ondelete="CASCADE")),
        sa.Column("stock_id", sa.Integer(), sa.ForeignKey("stocks.id", ondelete="CASCADE")),
        sa.Column("is_pinned", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status_label", sa.String(32)),
        sa.Column("notes", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("watchlist_id", "stock_id", name="uq_watchlist_stock"),
    )

    op.create_table(
        "data_sources",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("code", sa.String(64), nullable=False, unique=True),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("supports_realtime", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("notes", sa.Text()),
        sa.Column("last_success_at", sa.DateTime(timezone=True)),
        sa.Column("last_error", sa.Text()),
        sa.Column("status", sa.String(32), nullable=False, server_default="unknown"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "data_collection_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("source", sa.String(64), nullable=False),
        sa.Column("operation", sa.String(64), nullable=False),
        sa.Column("symbol", sa.String(32)),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("records_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("completeness", sa.Float()),
        sa.Column("message", sa.Text()),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "quotes_snapshot",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("stock_id", sa.Integer(), sa.ForeignKey("stocks.id", ondelete="CASCADE")),
        sa.Column("source", sa.String(64), nullable=False),
        sa.Column("price", sa.Float()),
        sa.Column("open", sa.Float()),
        sa.Column("high", sa.Float()),
        sa.Column("low", sa.Float()),
        sa.Column("previous_close", sa.Float()),
        sa.Column("change", sa.Float()),
        sa.Column("change_percent", sa.Float()),
        sa.Column("volume", sa.Float()),
        sa.Column("avg_volume", sa.Float()),
        sa.Column("vwap", sa.Float()),
        sa.Column("bid", sa.Float()),
        sa.Column("ask", sa.Float()),
        sa.Column("spread", sa.Float()),
        sa.Column("as_of", sa.DateTime(timezone=True)),
        sa.Column("ingested_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_delayed", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("data_completeness", sa.Float()),
        sa.Column("quality_flag", sa.String(32)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "market_bars",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("stock_id", sa.Integer(), sa.ForeignKey("stocks.id", ondelete="CASCADE")),
        sa.Column("timeframe", sa.String(16), nullable=False),
        sa.Column("bar_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("open", sa.Float()),
        sa.Column("high", sa.Float()),
        sa.Column("low", sa.Float()),
        sa.Column("close", sa.Float()),
        sa.Column("adjusted_close", sa.Float()),
        sa.Column("volume", sa.Float()),
        sa.Column("vwap", sa.Float()),
        sa.Column("trade_count", sa.Integer()),
        sa.Column("source", sa.String(64), nullable=False),
        sa.Column("ingested_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_delayed", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("data_completeness", sa.Float()),
        sa.Column("quality_flag", sa.String(32)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("stock_id", "timeframe", "bar_time", "source", name="uq_bar_identity"),
    )

    op.create_table(
        "scan_jobs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("watchlist_id", sa.Integer(), sa.ForeignKey("watchlists.id", ondelete="SET NULL")),
        sa.Column("interval_minutes", sa.Integer(), nullable=False, server_default="60"),
        sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("last_run_at", sa.DateTime(timezone=True)),
        sa.Column("next_run_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "scan_runs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("job_id", sa.Integer(), sa.ForeignKey("scan_jobs.id", ondelete="SET NULL")),
        sa.Column("trigger", sa.String(32), nullable=False),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("watchlist_id", sa.Integer(), sa.ForeignKey("watchlists.id", ondelete="SET NULL")),
        sa.Column("symbols_total", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("symbols_ok", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("symbols_failed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("avg_completeness", sa.Float()),
        sa.Column("message", sa.Text()),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "alerts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("stock_id", sa.Integer(), sa.ForeignKey("stocks.id", ondelete="SET NULL")),
        sa.Column("symbol", sa.String(32), nullable=False),
        sa.Column("alert_type", sa.String(64), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("message", sa.Text()),
        sa.Column("price", sa.Float()),
        sa.Column("channel", sa.String(32), nullable=False, server_default="in_app"),
        sa.Column("is_sent", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("dedupe_key", sa.String(255)),
        sa.Column("fired_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "user_settings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("key", sa.String(128), nullable=False, unique=True),
        sa.Column("value", sa.Text()),
        sa.Column("value_int", sa.Integer()),
        sa.Column("value_float", sa.Float()),
        sa.Column("description", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    for table in [
        "user_settings",
        "alerts",
        "scan_runs",
        "scan_jobs",
        "market_bars",
        "quotes_snapshot",
        "data_collection_logs",
        "data_sources",
        "watchlist_items",
        "watchlists",
        "stocks",
    ]:
        op.drop_table(table)
