"""
Alerts API endpoints.

Provides real-time weather risk alerts based on live atmospheric observations,
statistical thresholds, and anomaly detection.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query, HTTPException
from app.core.config import get_settings
from app.services.alert_history import AlertHistoryStore
from app.services.weather import WeatherService
from app.services.risk_engine import assess_weather_risks, compute_activity_suitability

router = APIRouter()


def get_alert_history_store() -> AlertHistoryStore:
    return AlertHistoryStore(get_settings().ALERT_HISTORY_DB_PATH)


def _iso(ts: float | None) -> str | None:
    return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat() if ts is not None else None


@router.get("/")
async def get_alerts(
    lat: float = Query(..., description="Latitude", ge=-90, le=90),
    lon: float = Query(..., description="Longitude", ge=-180, le=180),
    store: AlertHistoryStore = Depends(get_alert_history_store),
):
    """
    Get active weather alerts and commercial activity suitability scores for a location.
    Evaluates current and short-term atmospheric dynamics to generate
    prioritized risk banners (LOW, MODERATE, HIGH, EXTREME) and activity ratings.
    """
    service = WeatherService()
    try:
        current_data = await service.get_current_conditions(lat, lon)
        hourly_data = await service.get_hourly_forecast(lat, lon, hours=24)
        alerts = assess_weather_risks(current_data, hourly_data)
        activity_scores = compute_activity_suitability(current_data, hourly_data)
        try:
            store.record(lat, lon, alerts)
        except Exception as e:  # history is best-effort; never fail live alerts over it
            print(f"Warning: failed to record alert history: {e}")

        # Summary counts
        severity_counts = {"EXTREME": 0, "HIGH": 0, "MODERATE": 0, "LOW": 0}
        for a in alerts:
            sev = a.get("severity", "LOW")
            severity_counts[sev] = severity_counts.get(sev, 0) + 1

        return {
            "status": "success",
            "location": current_data.get("location"),
            "alerts": alerts,
            "summary": severity_counts,
            "activity_suitability": activity_scores,
            "count": len(alerts),
        }
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to assess weather alerts: {str(e)}")


@router.get("/history")
async def get_alert_history(
    lat: float = Query(..., description="Latitude", ge=-90, le=90),
    lon: float = Query(..., description="Longitude", ge=-180, le=180),
    days: int = Query(7, description="Number of days of history", ge=1, le=30),
    store: AlertHistoryStore = Depends(get_alert_history_store),
):
    """
    Alert episodes recorded by the risk engine for this location (~1 km grid).
    Only periods in which the location's alerts were requested are covered.
    """
    events = store.history(lat, lon, days)
    return {
        "status": "success",
        "source": "recorded",
        "history": [
            {
                "id": e["id"],
                "date": _iso(e["first_seen"]),
                "severity": e["peak_severity"],
                "title": e["title"],
                "description": e["description"],
                "last_seen": _iso(e["last_seen"]),
                "resolved_at": _iso(e["resolved_at"]),
            }
            for e in events
        ],
    }
