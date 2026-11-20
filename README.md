# Atlas Markets — Stock Analysis Platform

Professional stock monitoring foundation (Phase 1).

## What's included

- Modular monorepo: FastAPI API + Next.js web + provider adapters
- Watchlists (CRUD, pin, CSV/Excel import)
- `YahooFinanceProvider` with data completeness metadata (missing ≠ zero)
- Daily quote/bar ingestion + scheduled/manual scans
- Dashboard + stock detail pages (Arabic RTL)
- Telegram webhook using env secrets (no hardcoded tokens)
- Docker Compose for Postgres/TimescaleDB + Redis + API + Web

## Quick start (local / SQLite)

```bash
python3 -m pip install -r requirements.txt
cp .env.example .env
# Optional: leave DATABASE_URL as sqlite for smoke tests
export DATABASE_URL=sqlite:///./scanner.db
export PYTHONPATH=.
python3 -m uvicorn apps.api.app.main:app --reload --port 8000
```

```bash
cd apps/web
npm install
# Browser calls same origin; Next.js proxies /api → backend :8000
npm run dev
```

### Windows PowerShell (two terminals)

Terminal 1 — API (must stay running):
```powershell
cd path\to\sp500-scanner
python -m pip install -r requirements.txt
$env:PYTHONPATH = "."
$env:DATABASE_URL = "sqlite:///./scanner.db"
python -m uvicorn apps.api.app.main:app --reload --port 8000
```

Terminal 2 — Web:
```powershell
cd path\to\sp500-scanner\apps\web
npm install
npm run dev
```

Open http://localhost:3000 (or the port Next prints, e.g. 3001).  
If you see «Failed to fetch» / تعذر الاتصال: the API on port 8000 is not running.

## Docker

```bash
cp .env.example .env
docker compose -f docker/docker-compose.yml up --build
```

- API: http://localhost:8000/docs  
- Web: http://localhost:3000  

## Tests

```bash
PYTHONPATH=. python3 -m pytest tests/ -v
```

## Telegram

Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` in `.env`. Commands: `/scan`, `/scan TICKER`, `/scan_crypto`, `/history`, `/status`.

## Phase roadmap

Phases 2–10 (collection quality, technical/SMC/volume, quant, patterns, ML scoring, zones, backtesting, production) are scaffolded under `services/analysis/` and documented in `docs/architecture.md`.
