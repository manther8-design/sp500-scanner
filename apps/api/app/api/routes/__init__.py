from fastapi import APIRouter

from apps.api.app.api.routes import dashboard, scans, stocks, telegram, watchlists

api_router = APIRouter(prefix="/api")
api_router.include_router(watchlists.router, tags=["watchlists"])
api_router.include_router(stocks.router, tags=["stocks"])
api_router.include_router(scans.router, tags=["scans"])
api_router.include_router(dashboard.router, tags=["dashboard"])

root_router = APIRouter()
root_router.include_router(telegram.router, tags=["telegram"])
