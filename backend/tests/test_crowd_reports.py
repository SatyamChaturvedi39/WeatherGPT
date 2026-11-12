"""
Tests for crowd-sourced reports and online flood-twin correction (offline).
"""

import time

import pytest
from fastapi.testclient import TestClient

from app.api import flood
from app.main import app
from app.services.crowd_reports import ReportStore, learn_corrections, nearest_zone
from app.services.flood_twin import unique_zones
from app.services.weather import WeatherService

ZONES = unique_zones(WeatherService.BANGALORE_MICROCLIMATES)
KORA = next(z for z in ZONES if z["id"] == "koramangala")
YELAHANKA = next(z for z in ZONES if z["id"] == "yelahanka")
NOW = 1_800_000_000.0


def _report(zone: dict, kind: str, minutes_ago: float) -> dict:
    return {
        "zone_id": zone["id"],
        "report_type": kind,
        "latitude": zone["latitude"],
        "longitude": zone["longitude"],
        "created_at": NOW - minutes_ago * 60,
    }


class TestOnlineCorrection:

    def test_no_reports_means_no_corrections(self):
        assert learn_corrections([], ZONES, 0.3, now=NOW) == {}

    def test_rain_reports_raise_rain_bias_locally(self):
        reports = [_report(KORA, "raining", m) for m in (30, 20, 10)]
        corr = learn_corrections(reports, ZONES, 0.1, now=NOW)
        assert corr["koramangala"]["rain_bias"] > 1.0
        assert corr["koramangala"]["n_reports"] == 3
        # Yelahanka is ~14 km north: outside the spatial kernel
        assert "yelahanka" not in corr

    def test_dry_reports_lower_rain_bias(self):
        reports = [_report(KORA, "dry", m) for m in (30, 20, 10)]
        corr = learn_corrections(reports, ZONES, 0.8, now=NOW)
        assert corr["koramangala"]["rain_bias"] < -1.0

    def test_bias_decays_as_reports_age(self):
        fresh = learn_corrections([_report(KORA, "raining", 5)], ZONES, 0.1, now=NOW)
        stale = learn_corrections([_report(KORA, "raining", 300)], ZONES, 0.1, now=NOW)
        assert fresh["koramangala"]["rain_bias"] > stale["koramangala"]["rain_bias"] > 0

    def test_reports_outside_window_are_ignored(self):
        assert learn_corrections([_report(KORA, "raining", 7 * 60)], ZONES, 0.1, now=NOW) == {}

    def test_waterlogged_report_assimilates_storage(self):
        corr = learn_corrections([_report(KORA, "waterlogged", 10)], ZONES, 0.5, now=NOW)
        assert corr["koramangala"]["initial_storage_mm"] > 5.0

    def test_dry_report_offsets_waterlogged_report(self):
        wet = learn_corrections([_report(KORA, "waterlogged", 10)], ZONES, 0.5, now=NOW)
        mixed = learn_corrections([_report(KORA, "waterlogged", 10), _report(KORA, "dry", 5)], ZONES, 0.5, now=NOW)
        assert mixed["koramangala"]["initial_storage_mm"] < wet["koramangala"]["initial_storage_mm"]

    def test_nearest_zone(self):
        zone, dist = nearest_zone(12.9355, 77.6250, ZONES)
        assert zone["id"] == "koramangala"
        assert dist < 0.5


class TestReportStore:

    def test_add_and_query(self, tmp_path):
        store = ReportStore(str(tmp_path / "r.db"))
        store.add("koramangala", "raining", 12.93, 77.62, "client-aaaa", created_at=NOW - 60)
        store.add("hebbal", "dry", 13.03, 77.59, "client-bbbb", created_at=NOW - 10 * 3600)
        recent = store.recent(NOW - 3600)
        assert [r["zone_id"] for r in recent] == ["koramangala"]
        assert store.last_from_client("client-aaaa", "koramangala") == NOW - 60
        assert store.last_from_client("client-aaaa", "hebbal") is None


@pytest.fixture
def api_client(tmp_path, monkeypatch):
    store = ReportStore(str(tmp_path / "api.db"))
    monkeypatch.setattr(flood, "get_report_store", lambda: store)
    return TestClient(app)


class TestReportsAPI:

    def test_submit_by_zone_and_list(self, api_client):
        r = api_client.post("/api/flood/reports", json={"report_type": "waterlogged", "zone_id": "koramangala", "client_id": "test-client-1"})
        assert r.status_code == 201
        assert r.json()["report"]["zone_name"] == "Koramangala"
        listed = api_client.get("/api/flood/reports").json()["reports"]
        assert listed[0]["report_type"] == "waterlogged"
        assert "client_id" not in listed[0]

    def test_submit_by_coordinates_snaps_to_zone(self, api_client):
        r = api_client.post("/api/flood/reports", json={"report_type": "raining", "latitude": 12.9305, "longitude": 77.6785, "client_id": "test-client-2"})
        assert r.status_code == 201
        assert r.json()["report"]["zone_id"] == "bellandur"

    def test_rejects_location_outside_bengaluru(self, api_client):
        r = api_client.post("/api/flood/reports", json={"report_type": "dry", "latitude": 19.07, "longitude": 72.87, "client_id": "test-client-3"})
        assert r.status_code == 422

    def test_rate_limits_repeat_reports(self, api_client):
        body = {"report_type": "raining", "zone_id": "hebbal", "client_id": "test-client-4"}
        assert api_client.post("/api/flood/reports", json=body).status_code == 201
        assert api_client.post("/api/flood/reports", json=body).status_code == 429

    def test_rejects_unknown_report_type(self, api_client):
        r = api_client.post("/api/flood/reports", json={"report_type": "snowing", "zone_id": "hebbal", "client_id": "test-client-5"})
        assert r.status_code == 422

    def test_twin_reflects_waterlogged_reports(self, api_client, monkeypatch):
        dry_hours = [{"time": f"2026-11-12T{h:02d}:00", "precipitation": 0.0, "precipitation_probability": 0} for h in range(6)]

        async def fake_hourly(self, lat, lon, hours=48):
            return {"hourly": dry_hours}

        monkeypatch.setattr(WeatherService, "get_hourly_forecast", fake_hourly)
        for i in range(3):
            api_client.post("/api/flood/reports", json={"report_type": "waterlogged", "zone_id": "silk board", "client_id": f"test-client-w{i}"})

        data = api_client.get("/api/flood/twin").json()["data"]
        silk = next(z for z in data["zones"] if z["id"] == "silk board")
        assert data["crowd"]["reports_in_window"] == 3
        assert silk["correction"]["n_reports"] == 3
        assert silk["timeline"][0]["p_waterlog"] > silk["timeline"][0]["p_waterlog_uncorrected"]
        assert silk["timeline"][0]["level"] != "Clear"
