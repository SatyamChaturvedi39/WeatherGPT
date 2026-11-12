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
    assert s.fill_actuals(key, {TARGET: {"temperature": 24.0, "precipitation": 0.0}}, now=TARGET + 7200) == 3
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
        return {TARGET: {"temperature": 21.5, "precipitation": None}}

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
    assert {m["model"] for m in data["rain"]["models"]} == {"xgboost_rain", "open_meteo_rain", "climatology_rain"}
    assert all(m["n"] == 0 and m["mae"] is None for m in data["models"])


def test_rain_forecasts_scored_with_brier(tmp_path):
    s = _store(tmp_path)
    s.log(LAT, LON, {"xgboost_rain": 0.8, "open_meteo_rain": 0.5, "climatology_rain": 0.2, "persistence": 20.0}, issued_at=ISSUED)
    key = next(iter(s.due(now=TARGET + 7200)))
    # 1.2 mm fell: rain event happened (temperature missing for that hour)
    assert s.fill_actuals(key, {TARGET: {"temperature": None, "precipitation": 1.2}}, now=TARGET + 7200) == 3
    rain = {m["model"]: m for m in s.stats(days=30, now=TARGET + 7200, variable="rain")["models"]}
    assert rain["xgboost_rain"]["brier"] == round((0.8 - 1) ** 2, 4)
    assert rain["climatology_rain"]["brier"] == round((0.2 - 1) ** 2, 4)
    assert rain["open_meteo_rain"]["observed_frequency"] == 1.0
    temp = s.stats(days=30, now=TARGET + 7200)
    assert temp["pending"] == 1  # persistence still waiting for a temperature


def test_old_database_gets_variable_column(tmp_path):
    import sqlite3

    path = tmp_path / "old.db"
    conn = sqlite3.connect(path)
    conn.execute(
        "CREATE TABLE forecasts (location_key TEXT, latitude REAL, longitude REAL, model TEXT, issued_at REAL, "
        "target_time REAL, predicted REAL, actual REAL, verified_at REAL, PRIMARY KEY (location_key, model, target_time))"
    )
    conn.execute("INSERT INTO forecasts VALUES ('k', 1, 2, 'persistence', 0, 0, 20, NULL, NULL)")
    conn.commit()
    conn.close()
    s = ForecastLogStore(str(path))
    assert s.stats(days=36500, now=10)["pending"] == 1
