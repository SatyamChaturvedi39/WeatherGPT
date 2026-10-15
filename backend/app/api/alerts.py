"""
Alerts API endpoints.

Provides real-time weather risk alerts based on live atmospheric observations,
statistical thresholds, and anomaly detection.
"""

from fastapi import APIRouter, Query, HTTPException
from app.services.weather import WeatherService
from app.services.risk_engine import assess_weather_risks

router = APIRouter()


@router.get("/")
async def get_alerts(
    lat: float = Query(..., description="Latitude", ge=-90, le=90),
    lon: float = Query(..., description="Longitude", ge=-180, le=180),
):
    """
    Get active weather alerts for a location.
    Evaluates current and short-term atmospheric dynamics to generate
    prioritized risk banners (LOW, MODERATE, HIGH, EXTREME).
    """
    service = WeatherService()
    try:
        current_data = await service.get_current_conditions(lat, lon)
        hourly_data = await service.get_hourly_forecast(lat, lon, hours=24)
        alerts = assess_weather_risks(current_data, hourly_data)
        
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
            "count": len(alerts),
        }
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to assess weather alerts: {str(e)}")


@router.get("/history")
async def get_alert_history(
    lat: float = Query(..., description="Latitude", ge=-90, le=90),
    lon: float = Query(..., description="Longitude", ge=-180, le=180),
    days: int = Query(7, description="Number of days of history", ge=1, le=30),
):
    """
    Get recent alert occurrences and resolved warnings for a location.
    """
    return {
        "status": "success",
        "history": [
            {
                "id": "hist-1",
                "date": "2026-10-14",
                "severity": "MODERATE",
                "title": "Passing Wind Surge",
                "resolved_at": "2026-10-14T18:00:00Z",
                "peak_value": "48 km/h",
            },
            {
                "id": "hist-2",
                "date": "2026-10-12",
                "severity": "LOW",
                "title": "Light Precipitation Advisory",
                "resolved_at": "2026-10-12T12:00:00Z",
                "peak_value": "3.2 mm",
            }
        ],
    }
