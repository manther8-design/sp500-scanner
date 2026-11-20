# Stock Analysis Platform — Architecture (Phase 1)

## Stack

- **Frontend:** Next.js (App Router), TypeScript, Tailwind CSS, Arabic RTL
- **Backend:** FastAPI, SQLAlchemy 2, APScheduler
- **Data:** yfinance via `MarketDataProvider` adapter
- **Storage:** PostgreSQL / TimescaleDB (Docker); SQLite for local smoke tests
- **Cache:** Redis (wired for later phases)

## Reliability rules

1. Missing market fields stay `null` — never coerced to `0`.
2. Every quote/bar carries `source`, `as_of`, `ingested_at`, `is_delayed`, `completeness`.
3. Telegram secrets live in environment variables only.
4. Analysis engines (phases 3+) are separate packages under `services/analysis/`.

## Phase 1 API surface

| Method | Path | Purpose |
|--------|------|---------|
| GET/POST/PATCH/DELETE | `/api/watchlists` | Watchlist CRUD |
| POST | `/api/watchlists/{id}/items` | Add symbol |
| POST | `/api/watchlists/{id}/import` | CSV/Excel import |
| GET | `/api/stocks/search` | Symbol search |
| GET | `/api/stocks/{symbol}/quote` | Live/stored quote |
| POST | `/api/scans/run-now` | Synchronous scan |
| POST | `/api/scans` | Async scan |
| GET | `/api/dashboard/summary` | Dashboard payload |
| POST | `/telegram-webhook` | Telegram bot commands |

## Next phases

See the project plan: collection quality → technical/volume → SMC → quant → patterns → ML/scoring → zones/alerts → backtest → production hardening.
