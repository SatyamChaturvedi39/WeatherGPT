"""
Live forecast verification.

Every T+24h temperature forecast the app issues is logged together with two
reference forecasts for the same target hour:

  * ``xgboost_blend``  - WeatherGPT's published T+24h point forecast
  * ``persistence``    - the temperature at issue time (y_{t+24} = y_t)
  * ``open_meteo_nwp`` - Open-Meteo's own deterministic forecast for that hour

Once the target hour has passed, the "actual" temperature is filled in from
Open-Meteo's hourly analysis (the same product the app treats as current
conditions; not an independent station observation). Error statistics are
then computed per model over a rolling window.

At most one forecast per model, location cell and target hour is kept (the
first one issued), so frequent page loads do not overweight any hour.
"""

from __future__ import annotations

import math
import sqlite3
import time
from pathlib import Path

from app.services.alert_history import location_key

MODELS = ("xgboost_blend", "persistence", "open_meteo_nwp")
HORIZON_H = 24


def floor_hour(ts: float) -> float:
    return math.floor(ts / 3600.0) * 3600.0


class ForecastLogStore:
    """SQLite-backed log of issued forecasts and their verifying observations."""

    def __init__(self, db_path: str):
        self.db_path = db_path
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS forecasts (
                    location_key TEXT NOT NULL,
                    latitude REAL NOT NULL,
                    longitude REAL NOT NULL,
                    model TEXT NOT NULL,
                    issued_at REAL NOT NULL,
                    target_time REAL NOT NULL,
                    predicted REAL NOT NULL,
                    actual REAL,
                    verified_at REAL,
                    PRIMARY KEY (location_key, model, target_time)
                )
                """
            )
            conn.execute("CREATE INDEX IF NOT EXISTS idx_forecasts_due ON forecasts(verified_at, target_time)")

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def log(self, lat: float, lon: float, predictions: dict[str, float | None], issued_at: float | None = None) -> int:
        """Record T+24h predictions issued now. Returns the number of new rows."""
        issued_at = issued_at if issued_at is not None else time.time()
        target = floor_hour(issued_at) + HORIZON_H * 3600
        key = location_key(lat, lon)
        rows = [
            (key, lat, lon, model, issued_at, target, float(value))
            for model, value in predictions.items()
            if model in MODELS and value is not None and math.isfinite(value)
        ]
        with self._connect() as conn:
            before = conn.total_changes
            conn.executemany(
                "INSERT OR IGNORE INTO forecasts (location_key, latitude, longitude, model, issued_at, target_time, predicted) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                rows,
            )
            return conn.total_changes - before

    def due(self, now: float | None = None) -> dict[str, dict]:
        """Unverified forecasts whose target hour has passed, grouped by location cell."""
        now = now if now is not None else time.time()
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT location_key, latitude, longitude, MIN(target_time) AS first_t "
                "FROM forecasts WHERE actual IS NULL AND target_time <= ? GROUP BY location_key",
                (now - 3600,),
            ).fetchall()
        return {r["location_key"]: dict(r) for r in rows}

    def fill_actuals(self, key: str, actuals: dict[float, float], now: float | None = None) -> int:
        """Attach observed temperatures (keyed by UTC hour timestamp) to matching forecasts."""
        now = now if now is not None else time.time()
        with self._connect() as conn:
            before = conn.total_changes
            conn.executemany(
                "UPDATE forecasts SET actual = ?, verified_at = ? "
                "WHERE location_key = ? AND target_time = ? AND actual IS NULL",
                [(temp, now, key, t) for t, temp in actuals.items() if temp is not None],
            )
            return conn.total_changes - before

    def stats(self, days: int = 30, now: float | None = None) -> dict:
        """Per-model MAE, RMSE and bias over verified forecasts in the window, plus counts."""
        now = now if now is not None else time.time()
        since = now - days * 86400
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT model, predicted, actual FROM forecasts WHERE actual IS NOT NULL AND target_time >= ?",
                (since,),
            ).fetchall()
            pending = conn.execute("SELECT COUNT(*) FROM forecasts WHERE actual IS NULL").fetchone()[0]
            locations = conn.execute(
                "SELECT COUNT(DISTINCT location_key) FROM forecasts WHERE target_time >= ?", (since,)
            ).fetchone()[0]

        per_model: dict[str, list[float]] = {m: [] for m in MODELS}
        for r in rows:
            per_model.setdefault(r["model"], []).append(r["predicted"] - r["actual"])

        models = []
        for m in MODELS:
            errs = per_model.get(m, [])
            n = len(errs)
            models.append({
                "model": m,
                "n": n,
                "mae": round(sum(abs(e) for e in errs) / n, 3) if n else None,
                "rmse": round(math.sqrt(sum(e * e for e in errs) / n), 3) if n else None,
                "bias": round(sum(errs) / n, 3) if n else None,
            })
        return {"window_days": days, "locations": locations, "pending": pending, "models": models}

    def recent_pairs(self, limit: int = 48) -> list[dict]:
        """Most recent verified target hours with all models side by side (for charts)."""
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT location_key, target_time, model, predicted, actual FROM forecasts
                WHERE actual IS NOT NULL AND (location_key, target_time) IN (
                    SELECT location_key, target_time FROM forecasts WHERE actual IS NOT NULL
                    GROUP BY location_key, target_time ORDER BY target_time DESC LIMIT ?
                )
                ORDER BY target_time ASC
                """,
                (limit,),
            ).fetchall()
        grouped: dict[tuple, dict] = {}
        for r in rows:
            g = grouped.setdefault(
                (r["location_key"], r["target_time"]),
                {"location_key": r["location_key"], "target_time": r["target_time"], "actual": r["actual"]},
            )
            g[r["model"]] = r["predicted"]
        return list(grouped.values())
