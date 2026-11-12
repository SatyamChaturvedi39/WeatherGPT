"""
Glue between live forecasts and the verification log.

``record_forecast`` is called by the ML prediction endpoint for every forecast
it serves; ``verify_due`` fetches observed temperatures for forecasts whose
target hour has passed. Both are best-effort and never raise into callers.
"""

from __future__ import annotations

import time
from datetime import datetime, timezone

import httpx

from app.core.config import get_settings
from app.services.forecast_log import HORIZON_H, ForecastLogStore
from app.services.weather import WeatherService


def get_forecast_log_store() -> ForecastLogStore:
    return ForecastLogStore(get_settings().FORECAST_LOG_DB_PATH)


async def nwp_forecast_t24(service: WeatherService, lat: float, lon: float) -> float | None:
    """Open-Meteo's deterministic temperature for the hour HORIZON_H hours after the current hour."""
    try:
        hourly = (await service.get_hourly_forecast(lat, lon, hours=HORIZON_H + 1)).get("hourly", [])
        return hourly[HORIZON_H].get("temperature_2m") if len(hourly) > HORIZON_H else None
    except Exception:
        return None


async def record_forecast(lat: float, lon: float, blended: float, current_temp: float,
                          store: ForecastLogStore | None = None, service: WeatherService | None = None) -> None:
    try:
        store = store or get_forecast_log_store()
        service = service or WeatherService()
        nwp = await nwp_forecast_t24(service, lat, lon)
        store.log(lat, lon, {"xgboost_blend": blended, "persistence": current_temp, "open_meteo_nwp": nwp})
    except Exception as e:
        print(f"Warning: failed to log forecast for verification: {e}")


async def fetch_observed_temperatures(lat: float, lon: float, past_days: int = 7) -> dict[float, float]:
    """Hourly 2 m temperature analysis for the last `past_days` days, keyed by UTC hour timestamp."""
    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": "temperature_2m",
        "past_days": past_days,
        "forecast_days": 1,
        "timezone": "UTC",
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.get(f"{get_settings().OPEN_METEO_BASE_URL}/forecast", params=params)
        res.raise_for_status()
        hourly = res.json().get("hourly", {})
    WeatherService._api_calls_count += 1
    now = time.time()
    out: dict[float, float] = {}
    for t, temp in zip(hourly.get("time", []), hourly.get("temperature_2m", [])):
        ts = datetime.fromisoformat(t).replace(tzinfo=timezone.utc).timestamp()
        if temp is not None and ts <= now:
            out[ts] = float(temp)
    return out


async def verify_due(store: ForecastLogStore | None = None, fetch=fetch_observed_temperatures) -> int:
    """Fill in actual temperatures for all forecasts whose target hour has passed."""
    store = store or get_forecast_log_store()
    filled = 0
    for key, loc in store.due().items():
        try:
            past_days = min(92, max(1, int((time.time() - loc["first_t"]) // 86400) + 2))
            actuals = await fetch(loc["latitude"], loc["longitude"], past_days)
            filled += store.fill_actuals(key, actuals)
        except Exception as e:
            print(f"Warning: verification fetch failed for {key}: {e}")
    return filled
