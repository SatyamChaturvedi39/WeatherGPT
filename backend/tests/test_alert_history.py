"""
Tests for persistent alert history (offline).
"""

import pytest
from fastapi.testclient import TestClient

from app.api import alerts as alerts_api
from app.main import app
from app.services.alert_history import AlertHistoryStore
from app.services.weather import WeatherService

NOW = 1_800_000_000.0
LAT, LON = 12.9716, 77.5946


def _alert(alert_id: str, severity: str = "MODERATE") -> dict:
    return {"id": alert_id, "severity": severity, "title": alert_id.title(), "description": f"{alert_id} desc"}


class TestAlertHistoryStore:

    def test_new_alert_opens_event(self, tmp_path):
        store = AlertHistoryStore(str(tmp_path / "a.db"))
        store.record(LAT, LON, [_alert("wind")], now=NOW)
        hist = store.history(LAT, LON, 7, now=NOW)
        assert len(hist) == 1
        assert hist[0]["alert_id"] == "wind"
        assert hist[0]["resolved_at"] is None

    def test_repeat_alert_extends_same_event_and_tracks_peak(self, tmp_path):
        store = AlertHistoryStore(str(tmp_path / "a.db"))
        store.record(LAT, LON, [_alert("wind", "MODERATE")], now=NOW)
        store.record(LAT, LON, [_alert("wind", "HIGH")], now=NOW + 600)
        store.record(LAT, LON, [_alert("wind", "LOW")], now=NOW + 1200)
        hist = store.history(LAT, LON, 7, now=NOW + 1200)
        assert len(hist) == 1
        assert hist[0]["peak_severity"] == "HIGH"
        assert hist[0]["last_seen"] == NOW + 1200

    def test_cleared_alert_is_resolved(self, tmp_path):
        store = AlertHistoryStore(str(tmp_path / "a.db"))
        store.record(LAT, LON, [_alert("wind")], now=NOW)
        store.record(LAT, LON, [], now=NOW + 3600)
        hist = store.history(LAT, LON, 7, now=NOW + 3600)
        assert hist[0]["resolved_at"] == NOW + 3600

    def test_recurrence_after_resolution_opens_new_event(self, tmp_path):
        store = AlertHistoryStore(str(tmp_path / "a.db"))
        store.record(LAT, LON, [_alert("wind")], now=NOW)
        store.record(LAT, LON, [], now=NOW + 3600)
        store.record(LAT, LON, [_alert("wind")], now=NOW + 7200)
        assert len(store.history(LAT, LON, 7, now=NOW + 7200)) == 2

    def test_all_clear_status_is_not_recorded(self, tmp_path):
        store = AlertHistoryStore(str(tmp_path / "a.db"))
        all_clear = {**_alert("normal-baseline", "LOW"), "alert_type": "favorable_weather"}
        store.record(LAT, LON, [all_clear], now=NOW)
        assert store.history(LAT, LON, 7, now=NOW) == []

    def test_history_is_per_location_and_window(self, tmp_path):
        store = AlertHistoryStore(str(tmp_path / "a.db"))
        store.record(LAT, LON, [_alert("wind")], now=NOW)
        store.record(LAT, LON, [], now=NOW + 60)
        store.record(28.61, 77.21, [_alert("heat")], now=NOW)
        # nearby jitter (same ~1 km cell) shares history
        assert len(store.history(LAT + 0.001, LON, 7, now=NOW + 120)) == 1
        # resolved more than `days` ago drops out
        assert store.history(LAT, LON, 1, now=NOW + 2 * 86400) == []


@pytest.fixture
def api_client(tmp_path):
    store = AlertHistoryStore(str(tmp_path / "api.db"))
    app.dependency_overrides[alerts_api.get_alert_history_store] = lambda: store
    yield TestClient(app), store
    app.dependency_overrides.pop(alerts_api.get_alert_history_store, None)


class TestAlertHistoryApi:

    def test_history_empty_without_recorded_alerts(self, api_client):
        client, _ = api_client
        r = client.get("/api/alerts/history", params={"lat": LAT, "lon": LON})
        assert r.status_code == 200
        assert r.json()["history"] == []

    def test_live_alerts_are_recorded_into_history(self, api_client, monkeypatch):
        client, _ = api_client

        async def fake_current(self, lat, lon):
            return {"location": {"name": "Test"}, "current": {}}

        async def fake_hourly(self, lat, lon, hours=24):
            return {"hourly": {}}

        monkeypatch.setattr(WeatherService, "get_current_conditions", fake_current)
        monkeypatch.setattr(WeatherService, "get_hourly_forecast", fake_hourly)
        monkeypatch.setattr(alerts_api, "assess_weather_risks", lambda c, h: [_alert("storm-thunder", "HIGH")])
        monkeypatch.setattr(alerts_api, "compute_activity_suitability", lambda c, h: {})

        assert client.get("/api/alerts/", params={"lat": LAT, "lon": LON}).status_code == 200
        hist = client.get("/api/alerts/history", params={"lat": LAT, "lon": LON}).json()["history"]
        assert len(hist) == 1
        assert hist[0]["title"] == "Storm-Thunder"
        assert hist[0]["severity"] == "HIGH"
        assert hist[0]["resolved_at"] is None
