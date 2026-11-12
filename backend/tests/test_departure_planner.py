"""
Best-time-to-leave planner (offline).
"""

from app.services import departure

H = 3600.0
T0 = 1_800_000_000.0 - (1_800_000_000.0 % H)  # on the hour


def _series(probs, rates):
    return [(T0 + i * H, rate, prob) for i, (prob, rate) in enumerate(zip(probs, rates))]


def test_picks_dry_slot_after_rain_band():
    # Rain for the next 2 hours, dry afterwards, at every waypoint
    probs = [90, 80, 10, 5, 5, 5, 5, 5, 5, 5]
    rates = [3.0, 2.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]
    wps = [_series(probs, rates) for _ in range(5)]
    slots = departure.plan_departures(wps, now_ts=T0, trip_minutes=30, window_hours=6)
    assert slots[0]["depart_ts"] == T0 and slots[0]["wet"]
    best = departure.best_slot(slots)
    assert best["max_rain_probability"] <= 10 and not best["wet"]
    assert best["depart_ts"] >= T0 + 2 * H


def test_later_waypoints_use_arrival_time():
    # Origin dry; destination gets rain from +1h. A 60-minute trip leaving now hits it at the end.
    dry = _series([0] * 8, [0.0] * 8)
    late_rain = _series([0, 95, 95, 0, 0, 0, 0, 0], [0.0, 5.0, 5.0, 0.0, 0.0, 0.0, 0.0, 0.0])
    slots = departure.plan_departures([dry, dry, dry, dry, late_rain], now_ts=T0, trip_minutes=60, window_hours=4)
    leave_now = slots[0]
    assert leave_now["max_rain_probability"] == 95 and leave_now["wet"]


def test_hourly_series_converts_local_time_to_utc():
    fc = {"location": {"utc_offset_seconds": 19800}, "hourly": [{"time": "2030-01-01T05:30", "precipitation": 0.2, "precipitation_probability": 40}]}
    (ts, rate, prob), = departure.hourly_series(fc)
    assert ts == 1893456000.0  # 2030-01-01T00:00Z
    assert (rate, prob) == (0.2, 40)


def test_ties_break_to_earliest():
    flat = _series([20] * 8, [0.0] * 8)
    slots = departure.plan_departures([flat] * 3, now_ts=T0 + 60, trip_minutes=20, window_hours=3)
    assert departure.best_slot(slots)["depart_ts"] == slots[0]["depart_ts"]


def test_travel_minutes_by_mode():
    assert round(departure.travel_minutes(12.0, "two_wheeler")) == 30
    assert departure.travel_minutes(1.0, "four_wheeler") == 5.0  # floor
