"""Risk alerts and activity impact evaluation endpoints."""
from fastapi import APIRouter, Depends, Query
from app.schemas.weather import AlertRiskResponse
from app.ingestion.open_meteo import OpenMeteoClient

router = APIRouter()
open_meteo_client = OpenMeteoClient()


@router.get("", response_model=AlertRiskResponse)
async def get_activity_risk(
    lat: float = Query(..., ge=-90.0, le=90.0),
    lon: float = Query(..., ge=-180.0, le=180.0),
    activity: str = Query("running", description="Activity type: commuting, running, travel, outdoor_event"),
) -> AlertRiskResponse:
    """Calculate personalized risk score and human-readable explanation for outdoor activity."""
    records = await open_meteo_client.get_forecast(lat, lon, forecast_days=2)
    next_24h = records[:24] if records else []

    max_temp = max((r["temperature_2m"] for r in next_24h), default=20.0)
    min_temp = min((r["temperature_2m"] for r in next_24h), default=15.0)
    max_wind = max((r["wind_speed_10m"] for r in next_24h), default=10.0)
    max_precip = max((r["precipitation"] for r in next_24h), default=0.0)

    # Risk scoring algorithm based on activity profile
    risk_score = 15.0
    contributing_factors = []
    reason_parts = []

    if max_precip > 5.0:
        risk_score += 45
        contributing_factors.append(f"Heavy precipitation expected ({max_precip:.1f} mm/h)")
        reason_parts.append("heavy rain")
    elif max_precip > 1.0:
        risk_score += 25
        contributing_factors.append(f"Showers expected ({max_precip:.1f} mm/h)")
        reason_parts.append("moderate rain")

    if max_wind > 45.0:
        risk_score += 35
        contributing_factors.append(f"High wind gusts up to {max_wind:.0f} km/h")
        reason_parts.append("high winds")
    elif max_wind > 25.0:
        risk_score += 15
        contributing_factors.append(f"Breezy conditions ({max_wind:.0f} km/h)")

    if max_temp > 33.0:
        risk_score += 30
        contributing_factors.append(f"Excessive heat ({max_temp:.1f}°C)")
        reason_parts.append("excessive heat")
    elif min_temp < 0.0:
        risk_score += 25
        contributing_factors.append(f"Sub-zero freezing temperature ({min_temp:.1f}°C)")
        reason_parts.append("freezing conditions")

    # Extra sensitivity based on activity
    if activity in ["running", "cycling"] and (max_temp > 28.0 or max_precip > 2.0):
        risk_score += 15
        contributing_factors.append(f"High thermal/aerobic strain for {activity}")

    risk_score = min(100.0, risk_score)

    if risk_score >= 65:
        level = "High"
    elif risk_score >= 35:
        level = "Moderate"
    else:
        level = "Low"

    summary_reason = f"Conditions for {activity} pose {level.lower()} risk"
    if reason_parts:
        summary_reason += f" due to {', '.join(reason_parts)}."
    else:
        summary_reason += " with favorable atmospheric stability and clear paths."

    p_rain = min(1.0, max_precip / 4.0 if max_precip > 0 else 0.05)

    return AlertRiskResponse(
        location_name=f"Location ({lat:.2f}, {lon:.2f})",
        latitude=lat,
        longitude=lon,
        activity=activity,
        risk_level=level,
        risk_score=round(risk_score, 1),
        reason=summary_reason,
        contributing_factors=contributing_factors or ["Optimal atmospheric conditions"],
        is_anomaly=False,
        precipitation_probability=round(p_rain, 2),
        max_wind_speed=round(max_wind, 1),
        temp_range=[round(min_temp, 1), round(max_temp, 1)],
        caution_widened=False,
    )
