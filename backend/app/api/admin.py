"""
Admin & Data-Ops Telemetry API.

Reports measured operational state only: Open-Meteo usage counters, which ML
artifacts actually loaded, their held-out benchmark error, the startup
database connection result, and row counts of the local SQLite stores.
"""

import json
import os
import time
from datetime import datetime, timezone

from fastapi import APIRouter

from app.api.forecast import ARTIFACTS_DIR, get_all_ml_models
from app.core.config import get_settings
from app.core.database import DB_STATUS
from app.services.alert_history import AlertHistoryStore
from app.services.crowd_reports import ReportStore
from app.services.weather import WeatherService

router = APIRouter()
START_TIME = time.time()


def _artifact_time(name: str) -> str | None:
    path = os.path.join(ARTIFACTS_DIR, name)
    if not os.path.exists(path):
        return None
    return datetime.fromtimestamp(os.path.getmtime(path), tz=timezone.utc).isoformat()


def _benchmark_rows() -> list[dict]:
    """Held-out XGBoost temperature errors per horizon, from benchmark_results.json."""
    try:
        with open(os.path.join(ARTIFACTS_DIR, "benchmark_results.json"), encoding="utf-8") as f:
            rows = json.load(f).get("temperature_forecasting_benchmark", [])
    except Exception:
        return []
    out = []
    for r in rows:
        try:
            hours = int(str(r["horizon"]).strip("T+h"))
            out.append({
                "horizon_hours": hours,
                "mae": r["xgboost_mae"],
                "rmse": r["xgboost_rmse"],
                "gain_vs_persistence_pct": r.get("xgboost_gain_vs_persistence_pct"),
            })
        except (KeyError, ValueError):
            continue
    return out


def _count_rows(db_path: str, table: str, store_cls) -> int | None:
    try:
        store = store_cls(db_path)
        with store._connect() as conn:
            return conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
    except Exception:
        return None


@router.get("/metrics")
async def get_system_metrics():
    """
    Returns live system telemetry and operational status for Data-Ops monitoring.
    """
    settings = get_settings()
    quota_info = WeatherService.get_quota_telemetry()
    latency = WeatherService._last_latency_ms

    models = get_all_ml_models() or {}
    loaded = "point" in models
    trained_at = _artifact_time("xgboost_t24_point.json")
    bench = _benchmark_rows()
    mae_24h = next((b["mae"] for b in bench if b["horizon_hours"] == 24), None)

    model_cards = [
        {
            "name": "XGBoost T+24h Point Regressor",
            "trained_at": trained_at,
            "task": "24h temperature forecast",
            "status": "loaded" if loaded else "not_loaded",
            # Same "<value> °C" string format the admin page parses
            **({"mae_temperature": f"{mae_24h} °C"} if mae_24h is not None else {}),
            "horizons": bench,
        },
        {
            "name": "XGBoost Quantile Regressors (P10/P50/P90)",
            "trained_at": _artifact_time("xgboost_q50.json"),
            "task": "Temperature prediction interval",
            "status": "loaded" if all(k in models for k in ("q10", "q50", "q90")) else "not_loaded",
        },
        {
            "name": "XGBoost Precipitation Classifier",
            "trained_at": _artifact_time("xgboost_precipitation_t24.json"),
            "task": "Rain occurrence T+24h",
            "status": "loaded" if "precip" in models else "not_loaded",
        },
        {
            "name": "TreeSHAP Explainer",
            "task": "Feature attribution for the point regressor",
            "status": "loaded" if "explainer" in models else "not_loaded",
        },
    ]

    return {
        "status": "operational",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "uptime_seconds": round(time.time() - START_TIME, 1),
        "services": {
            "open_meteo_api": {
                # "unknown" until a call has succeeded since the server started
                "status": "healthy" if latency is not None else "unknown",
                "tier": "Free (10,000 calls/day)",
                "calls_today": quota_info["calls_used"],
                "quota_remaining": quota_info["quota_remaining"],
                "total_quota": quota_info["total_quota"],
                "percent_available": quota_info["percent_available"],
                "percent_used": quota_info["percent_used"],
                "cache_hits": quota_info["cache_hits"],
                "caching_efficiency": quota_info["caching_efficiency"],
                "avg_latency_ms": latency,
            },
            "ml_inference_engine": {
                "status": "active" if loaded else "artifacts_missing",
                "models": model_cards,
            },
            "database": {
                "engine": "PostgreSQL (SQLAlchemy)",
                "status": "active" if DB_STATUS["connected"] else "unavailable",
                "error": DB_STATUS["error"],
            },
            "local_stores": {
                "engine": "SQLite",
                "crowd_reports": _count_rows(settings.CROWD_DB_PATH, "crowd_reports", ReportStore),
                "alert_events": _count_rows(settings.ALERT_HISTORY_DB_PATH, "alert_events", AlertHistoryStore),
            },
        },
    }
