"""
In-process background jobs, started from the FastAPI lifespan.

* Forecast job (hourly): issue a T+24h forecast for every tracked location so
  the verification log fills up even without visitors, then verify forecasts
  whose target hour has passed.
* Alert job (every 15 min): evaluate alerts at every location a browser has
  subscribed to and send Web Push notifications for new or escalated alerts,
  then run the Flood Twin and warn watchers of Bengaluru zones heading for
  Warning/Severe waterlogging in the next 6 hours.

Jobs are best-effort: failures are logged and the loop keeps running.
Disable with BACKGROUND_JOBS_ENABLED=false (the test suite does).
"""

from __future__ import annotations

import asyncio

from app.core.config import get_settings


async def run_forecast_cycle() -> None:
    # Imported lazily to avoid a circular import with app.api.forecast
    from app.api.forecast import get_ml_prediction
    from app.services.verification import verify_due

    for lat, lon in get_settings().TRACKED_LOCATIONS:
        try:
            await get_ml_prediction(lat=lat, lon=lon)  # logs itself via record_forecast
        except Exception as e:
            print(f"[jobs] forecast for ({lat}, {lon}) failed: {e}")
    try:
        filled = await verify_due()
        if filled:
            print(f"[jobs] verified {filled} forecasts")
    except Exception as e:
        print(f"[jobs] verification failed: {e}")


async def _loop(name: str, interval_s: int, fn) -> None:
    while True:
        try:
            await fn()
        except asyncio.CancelledError:
            raise
        except Exception as e:
            print(f"[jobs] {name} cycle failed: {e}")
        await asyncio.sleep(interval_s)


async def run_alert_cycle() -> None:
    from app.api.notifications import run_alert_cycle as alerts, run_flood_cycle as floods

    sent = await alerts()
    if sent:
        print(f"[jobs] sent {sent} alert notifications")
    try:
        sent = await floods()
        if sent:
            print(f"[jobs] sent {sent} flood warnings")
    except Exception as e:
        print(f"[jobs] flood warning cycle failed: {e}")


def start_background_jobs() -> list[asyncio.Task]:
    s = get_settings()
    return [
        asyncio.create_task(_loop("forecast", s.FORECAST_JOB_INTERVAL_S, run_forecast_cycle)),
        asyncio.create_task(_loop("alerts", s.ALERT_JOB_INTERVAL_S, run_alert_cycle)),
    ]
