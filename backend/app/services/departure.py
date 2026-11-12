"""
Best time to leave: scan departure times over the next few hours and find the
one where the route is driest when you are actually on it.

For a departure at time d, waypoint i (a fraction f_i along the route) is
reached at d + f_i * travel_time. The hourly NWP forecast at that waypoint is
linearly interpolated to that moment, giving a rain rate (mm/h) and a rain
probability (%). Each departure is scored by the worst point on the trip:

    1. highest probability of rain along the route (lower is better)
    2. highest expected rain rate along the route (tie-break)
    3. earliest departure (tie-break)

Travel time is the dry-road estimate; rain slows traffic, but that effect is
second order for choosing between nearby departure slots.
"""

from __future__ import annotations

import math
from bisect import bisect_right
from datetime import datetime, timezone

RAIN_MM = 0.1


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


# Dry-road average speeds (km/h) by mode, (urban, intercity); same as the route corridor
MODE_SPEEDS = {
    "two_wheeler": (24.0, 65.0),
    "auto_cab": (20.0, 70.0),
    "pedestrian": (4.8, 4.8),
    "four_wheeler": (22.0, 75.0),
}


def travel_minutes(distance_km: float, mode: str) -> float:
    urban, intercity = MODE_SPEEDS.get(mode, MODE_SPEEDS["four_wheeler"])
    speed = urban if distance_km < 35.0 else intercity
    return max(5.0, distance_km / speed * 60.0)


def hourly_series(forecast: dict) -> list[tuple[float, float | None, float | None]]:
    """[(utc_ts, precipitation_mm, precipitation_probability_pct)] from a get_hourly_forecast() result."""
    offset = (forecast.get("location") or {}).get("utc_offset_seconds") or 0
    out = []
    for p in forecast.get("hourly", []):
        local = datetime.fromisoformat(p["time"]).replace(tzinfo=timezone.utc).timestamp()
        out.append((local - offset, p.get("precipitation"), p.get("precipitation_probability")))
    return out


def _interp(series: list[tuple[float, float | None, float | None]], ts: float, idx: int) -> float | None:
    times = [s[0] for s in series]
    j = bisect_right(times, ts)
    if j == 0 or j >= len(series):
        return None
    (t0, *v0), (t1, *v1) = series[j - 1], series[j]
    a, b = v0[idx], v1[idx]
    if a is None or b is None:
        return None
    w = (ts - t0) / (t1 - t0)
    return a + (b - a) * w


def plan_departures(
    waypoint_series: list[list[tuple[float, float | None, float | None]]],
    now_ts: float,
    trip_minutes: float,
    window_hours: float = 6.0,
    step_minutes: int = 15,
) -> list[dict]:
    """Score each departure slot from now to now + window_hours."""
    n = len(waypoint_series)
    fractions = [i / (n - 1) if n > 1 else 0.0 for i in range(n)]
    start = math.ceil(now_ts / (step_minutes * 60)) * step_minutes * 60
    slots = []
    t = start
    while t <= now_ts + window_hours * 3600:
        probs, rates = [], []
        for series, f in zip(waypoint_series, fractions):
            at = t + f * trip_minutes * 60
            prob = _interp(series, at, 1)
            rate = _interp(series, at, 0)
            if prob is not None:
                probs.append(prob)
            if rate is not None:
                rates.append(rate)
        if probs or rates:
            slots.append({
                "depart_ts": t,
                "arrive_ts": t + trip_minutes * 60,
                "max_rain_probability": round(max(probs)) if probs else None,
                "max_rain_mm_h": round(max(rates), 2) if rates else None,
                "wet": bool(rates) and max(rates) >= RAIN_MM,
            })
        t += step_minutes * 60
    return slots


def best_slot(slots: list[dict]) -> dict | None:
    if not slots:
        return None
    return min(
        slots,
        key=lambda s: (
            s["max_rain_probability"] if s["max_rain_probability"] is not None else 101,
            s["max_rain_mm_h"] if s["max_rain_mm_h"] is not None else 1e9,
            s["depart_ts"],
        ),
    )
