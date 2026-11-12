"""
Web Push alert notifications.

Browsers subscribe with a Push API subscription plus the locations they care
about and a minimum severity. A background job evaluates alerts for every
subscribed location (recording them in the alert history) and pushes a
notification when an alert episode at that location is new, or has reached
a higher severity than the last one sent to that subscriber.

VAPID keys are generated on first use and stored next to the other local
SQLite stores; they never leave the server except for the public key.
"""

from __future__ import annotations

import base64
import json
import sqlite3
import time
from pathlib import Path

from app.services.alert_history import SEVERITY_RANK, location_key


def _b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


class VapidKeys:
    """Loads or creates the server's VAPID key pair."""

    def __init__(self, private_key_path: str):
        from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
        from py_vapid import Vapid01

        path = Path(private_key_path)
        if path.exists():
            vapid = Vapid01.from_file(str(path))
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            vapid = Vapid01()
            vapid.generate_keys()
            vapid.save_key(str(path))
        self.private_key_path = str(path)
        self.public_key = _b64url(vapid.public_key.public_bytes(Encoding.X962, PublicFormat.UncompressedPoint))


class PushStore:
    """SQLite store of push subscriptions and what each one has been sent."""

    def __init__(self, db_path: str):
        self.db_path = db_path
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS push_subscriptions (
                    endpoint TEXT NOT NULL,
                    p256dh TEXT NOT NULL,
                    auth TEXT NOT NULL,
                    location_key TEXT NOT NULL,
                    latitude REAL NOT NULL,
                    longitude REAL NOT NULL,
                    location_name TEXT NOT NULL,
                    min_severity TEXT NOT NULL,
                    created_at REAL NOT NULL,
                    PRIMARY KEY (endpoint, location_key)
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS push_sent (
                    endpoint TEXT NOT NULL,
                    event_id TEXT NOT NULL,
                    severity TEXT NOT NULL,
                    sent_at REAL NOT NULL,
                    PRIMARY KEY (endpoint, event_id)
                )
                """
            )

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def subscribe(self, subscription: dict, locations: list[dict], min_severity: str) -> int:
        """Replace this endpoint's locations. Returns the number of locations stored."""
        endpoint = subscription["endpoint"]
        keys = subscription["keys"]
        now = time.time()
        rows = []
        seen = set()
        for loc in locations:
            key = location_key(loc["latitude"], loc["longitude"])
            if key in seen:
                continue
            seen.add(key)
            rows.append((endpoint, keys["p256dh"], keys["auth"], key, loc["latitude"], loc["longitude"],
                         loc.get("name") or key, min_severity, now))
        with self._connect() as conn:
            conn.execute("DELETE FROM push_subscriptions WHERE endpoint = ?", (endpoint,))
            conn.executemany("INSERT INTO push_subscriptions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", rows)
        return len(rows)

    def unsubscribe(self, endpoint: str) -> None:
        with self._connect() as conn:
            conn.execute("DELETE FROM push_subscriptions WHERE endpoint = ?", (endpoint,))
            conn.execute("DELETE FROM push_sent WHERE endpoint = ?", (endpoint,))

    def subscriptions(self, endpoint: str | None = None) -> list[dict]:
        with self._connect() as conn:
            if endpoint:
                rows = conn.execute("SELECT * FROM push_subscriptions WHERE endpoint = ?", (endpoint,)).fetchall()
            else:
                rows = conn.execute("SELECT * FROM push_subscriptions").fetchall()
        return [dict(r) for r in rows]

    def locations(self) -> list[tuple[float, float]]:
        """Distinct subscribed locations (one representative point per ~1 km cell)."""
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT location_key, AVG(latitude) AS lat, AVG(longitude) AS lon FROM push_subscriptions GROUP BY location_key"
            ).fetchall()
        return [(r["lat"], r["lon"]) for r in rows]

    def last_sent_severity(self, endpoint: str, event_id: str) -> str | None:
        with self._connect() as conn:
            r = conn.execute(
                "SELECT severity FROM push_sent WHERE endpoint = ? AND event_id = ?", (endpoint, event_id)
            ).fetchone()
        return r["severity"] if r else None

    def mark_sent(self, endpoint: str, event_id: str, severity: str) -> None:
        with self._connect() as conn:
            conn.execute(
                "INSERT INTO push_sent VALUES (?, ?, ?, ?) "
                "ON CONFLICT(endpoint, event_id) DO UPDATE SET severity = excluded.severity, sent_at = excluded.sent_at",
                (endpoint, event_id, severity, time.time()),
            )


def notifications_due(subscriptions: list[dict], open_events: list[dict], store: PushStore) -> list[tuple[dict, dict]]:
    """
    (subscription, event) pairs that should be pushed: the event is at or above
    the subscriber's minimum severity and either was never sent to them or has
    since escalated beyond the severity they were last told about.
    """
    due = []
    for sub in subscriptions:
        threshold = SEVERITY_RANK.get(sub["min_severity"], 1)
        for ev in open_events:
            if ev["location_key"] != sub["location_key"]:
                continue
            sev = ev["peak_severity"]
            rank = SEVERITY_RANK.get(sev, 0)
            if rank < threshold:
                continue
            last = store.last_sent_severity(sub["endpoint"], ev["id"])
            if last is None or rank > SEVERITY_RANK.get(last, 0):
                due.append((sub, ev))
    return due


def build_payload(sub: dict, ev: dict, escalated: bool) -> str:
    prefix = "Alert upgraded" if escalated else "New alert"
    return json.dumps({
        "title": f"{ev['peak_severity']}: {ev['title']}",
        "body": f"{prefix} for {sub['location_name']}. {ev['description']}".strip(),
        "url": "/alerts",
        "tag": f"alert-{ev['id']}",
    })


class SubscriptionGone(Exception):
    """The push service says this subscription no longer exists (HTTP 404/410)."""


def send_push(sub: dict, payload: str, keys: VapidKeys, subject: str) -> None:
    from pywebpush import WebPushException, webpush

    try:
        webpush(
            subscription_info={"endpoint": sub["endpoint"], "keys": {"p256dh": sub["p256dh"], "auth": sub["auth"]}},
            data=payload,
            vapid_private_key=keys.private_key_path,
            vapid_claims={"sub": subject},
            ttl=3600,
        )
    except WebPushException as e:
        status = getattr(e.response, "status_code", None)
        if status in (404, 410):
            raise SubscriptionGone(sub["endpoint"]) from e
        raise
