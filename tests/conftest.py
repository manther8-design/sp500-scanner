import importlib
import os
import sys

import pytest


@pytest.fixture()
def client(tmp_path, monkeypatch):
    db_path = tmp_path / "scanner.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_path}")
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "")
    monkeypatch.setenv("TELEGRAM_CHAT_ID", "")
    monkeypatch.setenv("SCAN_INTERVAL_MINUTES", "60")

    # Clear cached settings and previously imported app modules so engine rebinds
    modules_to_clear = [
        name
        for name in list(sys.modules)
        if name.startswith("apps.api") or name in {"providers", "services"}
    ]
    # Keep packages; reload core modules carefully
    for name in [
        "apps.api.app.core.config",
        "apps.api.app.core.database",
        "apps.api.app.core.seed",
        "apps.api.app.main",
        "apps.api.app.api.deps",
        "apps.api.app.api.routes.scans",
        "apps.api.app.api.routes.telegram",
        "apps.api.app.api.routes.dashboard",
        "apps.api.app.api.routes.watchlists",
        "apps.api.app.api.routes.stocks",
        "apps.api.app.api.routes",
        "services.alerts.telegram",
        "services.data_collector.collector",
    ]:
        if name in sys.modules:
            del sys.modules[name]

    from apps.api.app.core.config import get_settings

    get_settings.cache_clear()

    from apps.api.app.main import create_app
    from fastapi.testclient import TestClient

    app = create_app()
    with TestClient(app) as c:
        yield c

    get_settings.cache_clear()
