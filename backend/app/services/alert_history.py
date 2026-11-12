"""
Persistent alert history.

Every time the risk engine evaluates a location, the active alerts are
reconciled against the stored open events for that location:

  * an alert seen for the first time opens a new event,
  * an alert still active refreshes its `last_seen` and keeps the most severe
    level observed (`peak_severity`),
  * an open event whose alert is no longer active is closed (`resolved_at`).

Locations are bucketed to a 0.01° grid (~1 km) so small GPS jitter maps to the
same history. History only covers periods in which the location was assessed.
"""

from __future__ import annotations

import sqlite3
import time
import uuid
from pathlib import Path

SEVERITY_RANK = {"LOW": 0, "MODERATE": 1, "HIGH": 2, "EXTREME": 3}


def location_key(lat: float, lon: float) -> str:
    return f"{round(lat, 2):.2f},{round(lon, 2):.2f}"


class AlertHistoryStore:
    """SQLite-backed log of alert episodes per location."""

    def __init__(self, db_path: str):
        self.db_path = db_path
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS alert_events (
                    id TEXT PRIMARY KEY,
                    location_key TEXT NOT NULL,
                    alert_id TEXT NOT NULL,
                    severity TEXT NOT NULL,
                    peak_severity TEXT NOT NULL,
                    title TEXT NOT NULL,
                    description TEXT NOT NULL,
                    first_seen REAL NOT NULL,
                    last_seen REAL NOT NULL,
                    resolved_at REAL
                )
                """
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_alert_events_loc ON alert_events(location_key, first_seen)"
            )

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def record(self, lat: float, lon: float, alerts: list[dict], now: float | None = None) -> None:
        """Reconcile the currently active alerts for a location with stored events."""
        now = now if now is not None else time.time()
        key = location_key(lat, lon)
        active = {a["id"]: a for a in alerts if a.get("id")}

        with self._connect() as conn:
            open_rows = conn.execute(
                "SELECT * FROM alert_events WHERE location_key = ? AND resolved_at IS NULL",
                (key,),
            ).fetchall()
            open_by_alert = {r["alert_id"]: r for r in open_rows}

            for alert_id, row in open_by_alert.items():
                if alert_id not in active:
                    conn.execute("UPDATE alert_events SET resolved_at = ? WHERE id = ?", (now, row["id"]))

            for alert_id, a in active.items():
                sev = a.get("severity", "LOW")
                row = open_by_alert.get(alert_id)
                if row is None:
                    conn.execute(
                        "INSERT INTO alert_events VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)",
                        (uuid.uuid4().hex, key, alert_id, sev, sev, a.get("title", alert_id),
                         a.get("description", ""), now, now),
                    )
                else:
                    peak = sev if SEVERITY_RANK.get(sev, 0) > SEVERITY_RANK.get(row["peak_severity"], 0) else row["peak_severity"]
                    conn.execute(
                        "UPDATE alert_events SET severity = ?, peak_severity = ?, last_seen = ?, description = ? WHERE id = ?",
                        (sev, peak, now, a.get("description", row["description"]), row["id"]),
                    )

    def history(self, lat: float, lon: float, days: int, now: float | None = None) -> list[dict]:
        """Alert episodes for a location that were active within the last `days` days, newest first."""
        now = now if now is not None else time.time()
        since = now - days * 86400
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT * FROM alert_events
                WHERE location_key = ? AND (resolved_at IS NULL OR resolved_at >= ?)
                ORDER BY first_seen DESC
                """,
                (location_key(lat, lon), since),
            ).fetchall()
        return [dict(r) for r in rows]
