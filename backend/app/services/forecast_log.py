"""
Live forecast verification.

Every T+24h forecast the app issues is logged together with reference
forecasts for the same target hour.

Temperature (scored by MAE / RMSE / bias, °C):
  * ``xgboost_blend``    - WeatherGPT's published T+24h point forecast
  * ``persistence``      - the temperature at issue time (y_{t+24} = y_t)
  * ``open_meteo_nwp``   - Open-Meteo's own deterministic forecast for that hour

Rain occurrence, >= 0.1 mm in the target hour (scored by Brier score):
  * ``xgboost_rain``     - WeatherGPT's precipitation classifier probability
  * ``open_meteo_rain``  - Open-Meteo's precipitation probability for that hour
  * ``climatology_rain`` - the training-set base rate of rainy hours

Once the target hour has passed, what happened is filled in from Open-Meteo's
hourly analysis (the same product the app treats as current conditions; not
an independent station observation).

At most one forecast per model, location cell and target hour is kept (the
first one issued), so frequent page loads do not overweight any hour.
"""

from __future__ import annotations

import math
import sqlite3
import time
from pathlib import Path

from app.services.alert_history import location_key

HORIZON_H = 24
RAIN_THRESHOLD_MM = 0.1

MODEL_VARIABLE = {
    "xgboost_blend": "temperature",
    "persistence": "temperature",
    "open_meteo_nwp": "temperature",
    "xgboost_rain": "rain",
    "open_meteo_rain": "rain",
    "climatology_rain": "rain",
}
VARIABLE_MODELS = {
    v: tuple(m for m, var in MODEL_VARIABLE.items() if var == v) for v in ("temperature", "rain")
}
# Kept for callers that only deal with temperature
MODELS = VARIABLE_MODELS["temperature"]


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
                    variable TEXT NOT NULL DEFAULT 'temperature',
                    PRIMARY KEY (location_key, model, target_time)
                )
                """
            )
            cols = {r["name"] for r in conn.execute("PRAGMA table_info(forecasts)")}
            if "variable" not in cols:  # databases created before rain verification
                conn.execute("ALTER TABLE forecasts ADD COLUMN variable TEXT NOT NULL DEFAULT 'temperature'")
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
            (key, lat, lon, model, issued_at, target, float(value), MODEL_VARIABLE[model])
            for model, value in predictions.items()
            if model in MODEL_VARIABLE and value is not None and math.isfinite(value)
        ]
        with self._connect() as conn:
            before = conn.total_changes
            conn.executemany(
                "INSERT OR IGNORE INTO forecasts "
                "(location_key, latitude, longitude, model, issued_at, target_time, predicted, variable) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
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

    def fill_actuals(self, key: str, observed: dict[float, dict], now: float | None = None) -> int:
        """
        Attach what happened to matching forecasts. `observed` maps a UTC hour
        timestamp to {"temperature": °C, "precipitation": mm}.
        """
        now = now if now is not None else time.time()
        updates = []
        for t, obs in observed.items():
            temp = obs.get("temperature")
            precip = obs.get("precipitation")
            if temp is not None:
                updates.append((float(temp), now, key, t, "temperature"))
            if precip is not None:
                updates.append((1.0 if precip >= RAIN_THRESHOLD_MM else 0.0, now, key, t, "rain"))
        with self._connect() as conn:
            before = conn.total_changes
            conn.executemany(
                "UPDATE forecasts SET actual = ?, verified_at = ? "
                "WHERE location_key = ? AND target_time = ? AND variable = ? AND actual IS NULL",
                updates,
            )
            return conn.total_changes - before

    def stats(self, days: int = 30, now: float | None = None, variable: str = "temperature") -> dict:
        """
        Per-model scores over verified forecasts in the window.
        Temperature: MAE, RMSE, bias. Rain: Brier score, mean forecast probability,
        observed rain frequency.
        """
        now = now if now is not None else time.time()
        since = now - days * 86400
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT model, predicted, actual FROM forecasts "
                "WHERE actual IS NOT NULL AND target_time >= ? AND variable = ?",
                (since, variable),
            ).fetchall()
            pending = conn.execute(
                "SELECT COUNT(*) FROM forecasts WHERE actual IS NULL AND variable = ?", (variable,)
            ).fetchone()[0]
            locations = conn.execute(
                "SELECT COUNT(DISTINCT location_key) FROM forecasts WHERE target_time >= ? AND variable = ?",
                (since, variable),
            ).fetchone()[0]

        pairs: dict[str, list[tuple[float, float]]] = {m: [] for m in VARIABLE_MODELS[variable]}
        for r in rows:
            pairs.setdefault(r["model"], []).append((r["predicted"], r["actual"]))

        models = []
        for m in VARIABLE_MODELS[variable]:
            pv = pairs.get(m, [])
            n = len(pv)
            if variable == "rain":
                models.append({
                    "model": m,
                    "n": n,
                    "brier": round(sum((p - a) ** 2 for p, a in pv) / n, 4) if n else None,
                    "mean_probability": round(sum(p for p, _ in pv) / n, 3) if n else None,
                    "observed_frequency": round(sum(a for _, a in pv) / n, 3) if n else None,
                })
            else:
                errs = [p - a for p, a in pv]
                models.append({
                    "model": m,
                    "n": n,
                    "mae": round(sum(abs(e) for e in errs) / n, 3) if n else None,
                    "rmse": round(math.sqrt(sum(e * e for e in errs) / n), 3) if n else None,
                    "bias": round(sum(errs) / n, 3) if n else None,
                })
        return {"window_days": days, "locations": locations, "pending": pending, "models": models}

    def recent_pairs(self, limit: int = 48, variable: str = "temperature") -> list[dict]:
        """Most recent verified target hours with all models side by side (for charts)."""
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT location_key, target_time, model, predicted, actual FROM forecasts
                WHERE actual IS NOT NULL AND variable = ? AND (location_key, target_time) IN (
                    SELECT location_key, target_time FROM forecasts WHERE actual IS NOT NULL AND variable = ?
                    GROUP BY location_key, target_time ORDER BY target_time DESC LIMIT ?
                )
                ORDER BY target_time ASC
                """,
                (variable, variable, limit),
            ).fetchall()
        grouped: dict[tuple, dict] = {}
        for r in rows:
            g = grouped.setdefault(
                (r["location_key"], r["target_time"]),
                {"location_key": r["location_key"], "target_time": r["target_time"], "actual": r["actual"]},
            )
            g[r["model"]] = r["predicted"]
        return list(grouped.values())
