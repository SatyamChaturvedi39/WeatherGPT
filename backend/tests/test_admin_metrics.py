"""
Admin metrics must reflect measured state, not constants (offline).
"""

from fastapi.testclient import TestClient

from app.api import admin
from app.core.database import DB_STATUS
from app.main import app


def test_reports_unloaded_models_and_db_down(monkeypatch):
    monkeypatch.setattr(admin, "get_all_ml_models", lambda: None)
    monkeypatch.setitem(DB_STATUS, "connected", False)
    monkeypatch.setitem(DB_STATUS, "error", "refused")
    data = TestClient(app).get("/api/admin/metrics").json()["services"]
    assert data["database"]["status"] == "unavailable"
    assert data["ml_inference_engine"]["status"] == "artifacts_missing"
    assert all(m["status"] == "not_loaded" for m in data["ml_inference_engine"]["models"])
    names = " ".join(m["name"] for m in data["ml_inference_engine"]["models"])
    assert "Isolation Forest" not in names
    assert "vector_store" not in data


def test_benchmark_horizons_come_from_artifact(monkeypatch):
    monkeypatch.setattr(admin, "_benchmark_rows", lambda: [{"horizon_hours": 24, "mae": 1.23, "rmse": 1.5, "gain_vs_persistence_pct": 12.0}])
    monkeypatch.setattr(admin, "_nwp_benchmark", lambda: None)
    data = TestClient(app).get("/api/admin/metrics").json()["services"]
    point = data["ml_inference_engine"]["models"][0]
    assert point["mae_temperature"] == "1.23 °C"
    assert point["horizons"] == [{"horizon_hours": 24, "mae": 1.23, "rmse": 1.5, "gain_vs_persistence_pct": 12.0}]
