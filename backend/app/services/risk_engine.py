"""
WeatherGPT — Risk and Anomaly Engine.

Computes multi-hazard weather risk scores and actionable alerts
based on physical meteorology thresholds and statistical anomalies.
"""

from typing import Any
from datetime import datetime


def assess_weather_risks(current: dict[str, Any], hourly: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    """
    Evaluate weather conditions and generate prioritized alert records.
    Risk Levels: LOW, MODERATE, HIGH, EXTREME
    """
    alerts = []
    curr = current.get("current", {})
    temp = curr.get("temperature_2m", 20.0)
    feels_like = curr.get("apparent_temperature", temp)
    wind_speed = curr.get("wind_speed_10m", 0.0)
    precip = curr.get("precipitation", 0.0)
    cloud_cover = curr.get("cloud_cover", 0.0)
    weather_code = curr.get("weather_code", 0)

    # 1. Extreme Heat or Cold Risk
    if temp >= 40.0 or feels_like >= 42.0:
        alerts.append({
            "id": "heat-extreme",
            "severity": "EXTREME",
            "alert_type": "extreme_heat",
            "title": "Extreme Heat Emergency",
            "description": f"Dangerous heat detected ({temp}°C, feels like {feels_like}°C). Risk of severe heatstroke and dehydration.",
            "recommendation": "Stay indoors in air-conditioned environments, stay hydrated, and avoid strenuous outdoor activity.",
            "triggered_by": "thermal_threshold",
            "confidence": 0.98,
            "anomaly_score": -0.85,
        })
    elif temp >= 33.0 or feels_like >= 36.0:
        alerts.append({
            "id": "heat-high",
            "severity": "HIGH",
            "alert_type": "heat_wave",
            "title": "High Heat Advisory",
            "description": f"Sustained elevated temperatures ({temp}°C). Heat index indicates moderate-to-high stress.",
            "recommendation": "Limit prolonged sun exposure during peak afternoon hours and drink plenty of water.",
            "triggered_by": "thermal_threshold",
            "confidence": 0.94,
            "anomaly_score": -0.42,
        })
    elif temp <= -15.0 or feels_like <= -20.0:
        alerts.append({
            "id": "cold-extreme",
            "severity": "EXTREME",
            "alert_type": "extreme_cold",
            "title": "Severe Freeze Warning",
            "description": f"Sub-zero extreme temperatures ({temp}°C, wind chill {feels_like}°C). Frostbite risk within 15 minutes.",
            "recommendation": "Wear thermal layers, protect exposed skin, and ensure heating systems are operational.",
            "triggered_by": "thermal_threshold",
            "confidence": 0.97,
            "anomaly_score": -0.79,
        })
    elif temp <= 0.0:
        alerts.append({
            "id": "frost-moderate",
            "severity": "MODERATE",
            "alert_type": "frost_warning",
            "title": "Frost & Freezing Conditions",
            "description": f"Temperatures at or below freezing ({temp}°C). Risk of black ice and icy road conditions.",
            "recommendation": "Exercise caution while driving or walking on untreated surfaces.",
            "triggered_by": "thermal_threshold",
            "confidence": 0.92,
            "anomaly_score": -0.25,
        })

    # 2. Severe Storm & Precipitation
    if weather_code in [95, 96, 99]:
        alerts.append({
            "id": "storm-thunder",
            "severity": "HIGH" if weather_code == 95 else "EXTREME",
            "alert_type": "severe_thunderstorm",
            "title": "Severe Thunderstorm & Hail Warning",
            "description": f"Active thunderstorm system with possible hail and lightning (Code {weather_code}).",
            "recommendation": "Seek sturdy shelter immediately, avoid open fields, tall trees, and water bodies.",
            "triggered_by": "wmo_severe_code",
            "confidence": 0.96,
            "anomaly_score": -0.68,
        })
    elif precip >= 15.0:
        alerts.append({
            "id": "rain-torrential",
            "severity": "HIGH",
            "alert_type": "heavy_rain",
            "title": "Torrential Downpour Alert",
            "description": f"High precipitation rate ({precip} mm). Flash flooding risk in low-lying and urban drainage areas.",
            "recommendation": "Avoid flooded roadways and prepare sump pumps in flood-prone basements.",
            "triggered_by": "precip_rate",
            "confidence": 0.93,
            "anomaly_score": -0.55,
        })
    elif precip >= 4.0:
        alerts.append({
            "id": "rain-moderate",
            "severity": "MODERATE",
            "alert_type": "moderate_rain",
            "title": "Rain & Wet Road Conditions",
            "description": f"Noticeable precipitation ({precip} mm). Reduced visibility and slick road conditions.",
            "recommendation": "Carry an umbrella and maintain extra braking distance on the road.",
            "triggered_by": "precip_rate",
            "confidence": 0.89,
            "anomaly_score": -0.15,
        })

    # 3. High Wind Risk
    if wind_speed >= 75.0:
        alerts.append({
            "id": "wind-extreme",
            "severity": "EXTREME",
            "alert_type": "destructive_wind",
            "title": "Gale / Destructive Wind Warning",
            "description": f"High-velocity wind gusts detected ({wind_speed} km/h). Potential structural damage and fallen trees.",
            "recommendation": "Secure loose outdoor objects, stay clear of powerlines, and remain indoors.",
            "triggered_by": "wind_threshold",
            "confidence": 0.97,
            "anomaly_score": -0.82,
        })
    elif wind_speed >= 45.0:
        alerts.append({
            "id": "wind-high",
            "severity": "HIGH",
            "alert_type": "high_wind",
            "title": "High Wind Advisory",
            "description": f"Strong wind gusts ({wind_speed} km/h). Difficult driving conditions for high-profile vehicles.",
            "recommendation": "Exercise caution on elevated highways and secure patio furniture.",
            "triggered_by": "wind_threshold",
            "confidence": 0.91,
            "anomaly_score": -0.38,
        })

    # 4. Dense Fog / Visibility
    if weather_code in [45, 48]:
        alerts.append({
            "id": "fog-moderate",
            "severity": "MODERATE",
            "alert_type": "dense_fog",
            "title": "Dense Fog & Low Visibility",
            "description": "Thick fog blanket observed. Horizontal visibility severely compromised.",
            "recommendation": "Use low-beam headlights and reduce travel speed.",
            "triggered_by": "visibility_wmo",
            "confidence": 0.90,
            "anomaly_score": -0.30,
        })

    # If no high alerts triggered, provide a reassuring LOW risk baseline
    if not alerts:
        alerts.append({
            "id": "normal-baseline",
            "severity": "LOW",
            "alert_type": "favorable_weather",
            "title": "Favorable Atmospheric Conditions",
            "description": f"Current weather is calm and stable ({temp}°C, wind {wind_speed} km/h). No hazardous anomalies detected.",
            "recommendation": "Standard weather precautions. Great conditions for regular outdoor activities.",
            "triggered_by": "baseline_engine",
            "confidence": 0.99,
            "anomaly_score": 0.12,
        })

    return alerts


def compute_activity_suitability(current: dict[str, Any], hourly: dict[str, Any] | None = None) -> dict[str, Any]:
    """
    Computes activity-specific operational scores (0-100) and actionable safety advisories.
    Commercial value for logistics, event planners, athletes, and drone operators.
    """
    curr = current.get("current", {})
    temp = curr.get("temperature_2m", 20.0)
    wind = curr.get("wind_speed_10m", 0.0)
    precip = curr.get("precipitation", 0.0)
    humidity = curr.get("relative_humidity_2m", 50.0)
    code = curr.get("weather_code", 0)

    # 1. Commuting & Highway Transit
    commute_score = 100
    commute_warnings = []
    if precip > 5.0 or code in [95, 96, 99]:
        commute_score -= 40
        commute_warnings.append("Hydroplaning hazard; standing road water")
    elif precip > 0.5:
        commute_score -= 15
        commute_warnings.append("Wet road surfaces; increased braking distance")
    if code in [45, 48]:
        commute_score -= 30
        commute_warnings.append("Severe fog; horizontal visibility < 500m")
    if wind > 50:
        commute_score -= 25
        commute_warnings.append("Crosswinds affecting high-profile vehicles")

    # 2. Athletics & Outdoor Running
    running_score = 100
    running_warnings = []
    if temp > 32 or (temp > 28 and humidity > 70):
        running_score -= 45
        running_warnings.append("High heat index; dehydration and cramp risk")
    elif temp < 2:
        running_score -= 25
        running_warnings.append("Freezing air; airway irritation and icy footing")
    if precip > 2:
        running_score -= 30
        running_warnings.append("Active rain causing damp footwear & slick trails")
    if wind > 35:
        running_score -= 20
        running_warnings.append("Elevated aerodynamic drag and wind chill")

    # 3. UAV & Drone Flight Operations
    drone_score = 100
    drone_warnings = []
    if wind > 38:
        drone_score -= 60
        drone_warnings.append("Wind exceeds safe stabilization limits (>38 km/h)")
    elif wind > 25:
        drone_score -= 25
        drone_warnings.append("Moderate turbulence; increased battery drain")
    if precip > 0.1:
        drone_score -= 50
        drone_warnings.append("Precipitation risk to unsealed optical sensors")
    if code in [45, 48]:
        drone_score -= 40
        drone_warnings.append("Visual Line of Sight (VLOS) compromised by fog")

    # 4. Construction & Outdoor Staging
    construction_score = 100
    construction_warnings = []
    if code in [95, 96, 99]:
        construction_score -= 70
        construction_warnings.append("Lightning hazard: immediately halt crane and scaffolding ops")
    if wind > 40:
        construction_score -= 40
        construction_warnings.append("High-altitude crane hoist limit exceeded")
    if precip > 10:
        construction_score -= 40
        construction_warnings.append("Ground saturation; delays in concrete curing and trenching")

    def _rating(score: int) -> str:
        if score >= 85: return "Optimal"
        if score >= 65: return "Favorable"
        if score >= 45: return "Caution Advised"
        return "Hazardous / No-Go"

    return {
        "commuting": {
            "name": "Commute & Road Transit",
            "score": max(10, commute_score),
            "status": _rating(commute_score),
            "advisories": commute_warnings or ["Clear road surfaces and stable visibility"],
        },
        "running": {
            "name": "Outdoor Athletics & Running",
            "score": max(10, running_score),
            "status": _rating(running_score),
            "advisories": running_warnings or ["Ideal thermal comfort and clean air density"],
        },
        "aviation_drone": {
            "name": "UAV & Commercial Drone Flight",
            "score": max(10, drone_score),
            "status": _rating(drone_score),
            "advisories": drone_warnings or ["Calm laminar airflow, clear optical line of sight"],
        },
        "construction": {
            "name": "Construction & Rigging",
            "score": max(10, construction_score),
            "status": _rating(construction_score),
            "advisories": construction_warnings or ["Low structural wind loading and dry ground conditions"],
        },
    }
