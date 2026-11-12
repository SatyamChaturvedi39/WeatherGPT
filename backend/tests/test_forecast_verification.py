"""
Live forecast verification log and endpoint (offline).
"""

import asyncio

from fastapi.testclient import TestClient

from app.api import admin
from app.main import app
from app.services.forecast_log import ForecastLogStore, floor_hour
from app.services.verification import verify_due

ISSUED = 1_800_000_000.0
TARGET = floor_hour(ISSUED) + 24 * 3600
LAT, LON = 12.9716, 77.5946


def _store(tmp_path):
    return ForecastLogStore(str(tmp_path / "f.db"))


def test_log_targets_24h_ahead_and_dedupes(tmp_path):
    s = _store(tmp_path)
    assert s.log(LAT, LON, {"xgboost_blend": 25.0, "persistence": 24.0, "open_meteo_nwp": None}, issued_at=ISSUED) == 2
    # second issue in the same hour for the same target is ignored
    assert s.log(LAT, LON, {"xgboost_blend": 30.0, "persistence": 30.0}, issued_at=ISSUED + 60) == 0
    assert s.due(now=TARGET - 10) == {}
    due = s.due(now=TARGET + 7200)
    assert len(due) == 1


def test_stats_after_actuals(tmp_path):
    s = _store(tmp_path)
    s.log(LAT, LON, {"xgboost_blend": 25.0, "persistence": 23.0, "open_meteo_nwp": 26.0}, issued_at=ISSUED)
    key = next(iter(s.due(now=TARGET + 7200)))
    assert s.fill_actuals(key, {TARGET: 24.0}, now=TARGET + 7200) == 3
    st = s.stats(days=30, now=TARGET + 7200)
    by = {m["model"]: m for m in st["models"]}
    assert by["xgboost_blend"]["mae"] == 1.0 and by["xgboost_blend"]["bias"] == 1.0
    assert by["persistence"]["bias"] == -1.0
    assert by["open_meteo_nwp"]["mae"] == 2.0
    assert st["pending"] == 0
    pairs = s.recent_pairs()
    assert pairs[0]["actual"] == 24.0 and pairs[0]["xgboost_blend"] == 25.0


def test_verify_due_uses_fetched_observations(tmp_path, monkeypatch):
    s = _store(tmp_path)
    s.log(LAT, LON, {"persistence": 20.0}, issued_at=ISSUED)
    monkeypatch.setattr("app.services.verification.time.time", lambda: TARGET + 7200)
    monkeypatch.setattr("app.services.forecast_log.time.time", lambda: TARGET + 7200)

    async def fake_fetch(lat, lon, past_days):
        return {TARGET: 21.5}

    assert asyncio.run(verify_due(s, fetch=fake_fetch)) == 1


def test_endpoint_reports_stats(tmp_path, monkeypatch):
    s = _store(tmp_path)
    monkeypatch.setattr(admin, "get_forecast_log_store", lambda: s)

    async def no_verify(store):
        return 0

    monkeypatch.setattr(admin, "verify_due", no_verify)
    data = TestClient(app).get("/api/admin/verification").json()
    assert data["horizon_hours"] == 24
    assert {m["model"] for m in data["models"]} == {"xgboost_blend", "persistence", "open_meteo_nwp"}
    assert all(m["n"] == 0 and m["mae"] is None for m in data["models"])
