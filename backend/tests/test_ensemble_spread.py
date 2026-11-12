"""
Hourly temperature band comes from ensemble percentiles, not a fixed formula (offline).
"""

import asyncio

import httpx

from app.services.weather import WeatherService


class _Resp:
    def __init__(self, payload):
        self._p = payload

    def raise_for_status(self):
        pass

    def json(self):
        return self._p


def test_spread_is_p10_p90_of_members(monkeypatch):
    members = {f"temperature_2m_member{i:02d}": [float(i)] for i in range(1, 21)}
    payload = {"hourly": {"time": ["2030-01-01T00:00"], "temperature_2m": [10.5], **members}}

    async def fake_get(self, url, params=None):
        assert "ensemble" in url
        return _Resp(payload)

    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)
    monkeypatch.setattr(WeatherService, "_cache", {})
    spread = asyncio.run(WeatherService().get_ensemble_temperature_spread(1.0, 2.0, hours=1))
    lo, hi = spread["2030-01-01T00:00"]
    assert 2.0 <= lo <= 3.5 and 17.5 <= hi <= 19.0


def test_spread_empty_on_failure(monkeypatch):
    async def boom(self, url, params=None):
        raise httpx.ConnectError("down")

    monkeypatch.setattr(httpx.AsyncClient, "get", boom)
    monkeypatch.setattr(WeatherService, "_cache", {})
    assert asyncio.run(WeatherService().get_ensemble_temperature_spread(1.0, 2.0)) == {}
