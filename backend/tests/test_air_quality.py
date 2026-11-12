"""
Air-quality endpoint must never serve invented readings (offline).
"""

import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.weather import WeatherService


class _FakeResponse:
    def __init__(self, payload: dict):
        self._payload = payload

    def raise_for_status(self):
        pass

    def json(self):
        return self._payload


def _patch_upstream(monkeypatch, payload=None, exc=None):
    async def fake_get(self, url, params=None):
        if exc:
            raise exc
        return _FakeResponse(payload)

    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)
    monkeypatch.setattr(WeatherService, "_cache", {})


@pytest.fixture
def client():
    return TestClient(app)


def test_upstream_failure_returns_502_not_fake_values(client, monkeypatch):
    _patch_upstream(monkeypatch, exc=httpx.ConnectError("down"))
    r = client.get("/api/forecast/aqi", params={"lat": 1.11, "lon": 2.22})
    assert r.status_code == 502


def test_missing_aqi_returns_502(client, monkeypatch):
    _patch_upstream(monkeypatch, payload={"current": {"pm2_5": 10}})
    r = client.get("/api/forecast/aqi", params={"lat": 3.33, "lon": 4.44})
    assert r.status_code == 502


def test_missing_pollutants_are_null_and_dominant_is_computed(client, monkeypatch):
    _patch_upstream(monkeypatch, payload={"current": {"us_aqi": 80, "pm2_5": 30.0, "pm10": 40.0}})
    r = client.get("/api/forecast/aqi", params={"lat": 5.55, "lon": 6.66})
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["aqi"] == 80
    assert data["nitrogen_dioxide"] is None
    assert data["ozone"] is None
    # PM2.5 at 2x its WHO guideline beats PM10 at <1x
    assert data["dominant_pollutant"].startswith("PM2.5")
