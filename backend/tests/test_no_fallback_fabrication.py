"""
Explainability and benchmark endpoints must fail honestly instead of serving
invented numbers when artifacts are missing (offline).
"""

from fastapi.testclient import TestClient

from app.api import forecast
from app.main import app
from app.services.weather import WeatherService


def test_explain_without_models_returns_503(monkeypatch):
    async def fake_current(self, lat, lon):
        return {"current": {"temperature_2m": 25.0}}

    monkeypatch.setattr(WeatherService, "get_current_conditions", fake_current)
    monkeypatch.setattr(forecast, "get_all_ml_models", lambda: None)
    monkeypatch.setattr(forecast, "_cached_explain", {})
    r = TestClient(app).get("/api/forecast/explain", params={"lat": 1.0, "lon": 2.0})
    assert r.status_code == 503


def test_benchmarks_without_results_file_returns_503(monkeypatch, tmp_path):
    monkeypatch.setattr(forecast, "ARTIFACTS_DIR", str(tmp_path))
    r = TestClient(app).get("/api/forecast/benchmarks")
    assert r.status_code == 503
