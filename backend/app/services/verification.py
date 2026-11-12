"""
Glue between live forecasts and the verification log.

``record_forecast`` is called by the ML prediction endpoint for every forecast
it serves; ``verify_due`` fetches what actually happened for forecasts whose
target hour has passed. Both are best-effort and never raise into callers.
"""

from __future__ import annotations

import json
import os
import time
from datetime import datetime, timezone
from functools import lru_cache

import httpx

from app.core.config import get_settings
from app.services.forecast_log import HORIZON_H, ForecastLogStore
from app.services.weather import WeatherService


def get_forecast_log_store() -> ForecastLogStore:
    return ForecastLogStore(get_settings().FORECAST_LOG_DB_PATH)


@lru_cache()
def climatological_rain_rate() -> float | None:
    """Share of rainy hours (>= 0.1 mm) in the training data, recorded by ml/train.py."""
    from app.api.forecast import ARTIFACTS_DIR

    try:
        with open(os.path.join(ARTIFACTS_DIR, "benchmark_results.json"), encoding="utf-8") as f:
            return float(json.load(f)["precipitation_classification_benchmark"]["positive_class_frequency_train"])
    except Exception:
        return None


async def nwp_forecast_t24(service: WeatherService, lat: float, lon: float) -> dict:
    """Open-Meteo's temperature and rain probability for the hour HORIZON_H hours after the current hour."""
    try:
        hourly = (await service.get_hourly_forecast(lat, lon, hours=HORIZON_H + 1)).get("hourly", [])
        if len(hourly) <= HORIZON_H:
            return {}
        pt = hourly[HORIZON_H]
        prob = pt.get("precipitation_probability")
        return {"temperature": pt.get("temperature_2m"), "rain_probability": prob / 100.0 if prob is not None else None}
    except Exception:
        return {}


async def record_forecast(lat: float, lon: float, blended: float, current_temp: float,
                          rain_probability: float | None = None,
                          store: ForecastLogStore | None = None, service: WeatherService | None = None) -> None:
    try:
        store = store or get_forecast_log_store()
        service = service or WeatherService()
        nwp = await nwp_forecast_t24(service, lat, lon)
        store.log(lat, lon, {
            "xgboost_blend": blended,
            "persistence": current_temp,
            "open_meteo_nwp": nwp.get("temperature"),
            "xgboost_rain": rain_probability,
            "open_meteo_rain": nwp.get("rain_probability"),
            "climatology_rain": climatological_rain_rate(),
        })
    except Exception as e:
        print(f"Warning: failed to log forecast for verification: {e}")


async def fetch_observed(lat: float, lon: float, past_days: int = 7) -> dict[float, dict]:
    """Hourly temperature and precipitation analysis for the last `past_days` days, keyed by UTC hour."""
    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": "temperature_2m,precipitation",
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
    out: dict[float, dict] = {}
    for t, temp, precip in zip(hourly.get("time", []), hourly.get("temperature_2m", []), hourly.get("precipitation", [])):
        ts = datetime.fromisoformat(t).replace(tzinfo=timezone.utc).timestamp()
        # Only hours that have fully elapsed count as observed
        if ts + 3600 <= now:
            out[ts] = {"temperature": temp, "precipitation": precip}
    return out


async def verify_due(store: ForecastLogStore | None = None, fetch=fetch_observed) -> int:
    """Fill in what happened for all forecasts whose target hour has passed."""
    store = store or get_forecast_log_store()
    filled = 0
    for key, loc in store.due().items():
        try:
            past_days = min(92, max(1, int((time.time() - loc["first_t"]) // 86400) + 2))
            observed = await fetch(loc["latitude"], loc["longitude"], past_days)
            filled += store.fill_actuals(key, observed)
        except Exception as e:
            print(f"Warning: verification fetch failed for {key}: {e}")
    return filled
