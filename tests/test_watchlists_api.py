def test_health(client):
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_seeded_watchlists(client):
    res = client.get("/api/watchlists")
    assert res.status_code == 200
    data = res.json()
    names = {w["name"] for w in data}
    assert "S&P Core" in names
    assert "Crypto" in names
    core = next(w for w in data if w["name"] == "S&P Core")
    assert core["item_count"] == 150


def test_create_and_add_symbol(client):
    res = client.post(
        "/api/watchlists",
        json={"name": "Test List", "description": "unit"},
    )
    assert res.status_code == 201
    wl = res.json()
    wl_id = wl["id"]

    add = client.post(
        f"/api/watchlists/{wl_id}/items",
        json={"symbol": "AAPL", "is_pinned": True},
    )
    assert add.status_code == 201
    item = add.json()
    assert item["stock"]["symbol"] == "AAPL"
    assert item["is_pinned"] is True

    detail = client.get(f"/api/watchlists/{wl_id}")
    assert detail.status_code == 200
    assert detail.json()["item_count"] == 1


def test_import_csv(client):
    res = client.post("/api/watchlists", json={"name": "Import List"})
    wl_id = res.json()["id"]
    csv_content = b"symbol,name\nMSFT,Microsoft\nNVDA,NVIDIA\nMSFT,Microsoft\n"
    upload = client.post(
        f"/api/watchlists/{wl_id}/import",
        files={"file": ("symbols.csv", csv_content, "text/csv")},
    )
    assert upload.status_code == 200
    body = upload.json()
    assert body["parsed"] == 3
    assert body["added"] == 2
    assert body["skipped"] == 1


def test_dashboard_summary(client):
    res = client.get("/api/dashboard/summary")
    assert res.status_code == 200
    data = res.json()
    assert "provider" in data
    assert data["provider"]["provider"] == "yfinance"
    assert data["watchlist_count"] >= 2


def test_scan_job_update(client):
    res = client.patch(
        "/api/scans/jobs/default",
        json={"interval_minutes": 15, "is_enabled": True},
    )
    assert res.status_code == 200
    assert res.json()["interval_minutes"] == 15

    got = client.get("/api/scans/jobs/default")
    assert got.json()["interval_minutes"] == 15


def test_telegram_webhook_history(client):
    res = client.post(
        "/telegram-webhook",
        json={"message": {"chat": {"id": 1}, "text": "/history"}},
    )
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_seed_sp150(client):
    res = client.post("/api/watchlists/seed-sp150")
    assert res.status_code == 200
    body = res.json()
    assert body["universe_size"] == 150
    assert body["item_count"] == 150
    # Idempotent — second call adds nothing new
    again = client.post("/api/watchlists/seed-sp150")
    assert again.status_code == 200
    assert again.json()["added"] == 0
    assert again.json()["item_count"] == 150
