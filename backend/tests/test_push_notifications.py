"""
Web Push alert notifications (offline: no real push service or weather API).
"""

import asyncio
import json

from fastapi.testclient import TestClient

from app.api import notifications
from app.main import app
from app.services.alert_history import AlertHistoryStore
from app.services.push import PushStore, VapidKeys

LAT, LON = 12.9716, 77.5946
SUB = {"endpoint": "https://push.example.test/abc123", "keys": {"p256dh": "pk", "auth": "ak"}}


def _alert(alert_id, severity, title="Storm"):
    return {"id": alert_id, "severity": severity, "title": title, "description": f"{title} expected", "alert_type": "storm"}


class _Weather:
    def __init__(self):
        self.alerts = []

    async def get_current_conditions(self, lat, lon):
        return {}

    async def get_hourly_forecast(self, lat, lon, hours=24):
        return {}


def _setup(tmp_path, monkeypatch, min_severity="MODERATE"):
    push = PushStore(str(tmp_path / "p.db"))
    hist = AlertHistoryStore(str(tmp_path / "h.db"))
    push.subscribe(SUB, [{"latitude": LAT, "longitude": LON, "name": "Home"}], min_severity)
    weather = _Weather()
    monkeypatch.setattr(notifications, "assess_weather_risks", lambda c, h: weather.alerts)
    sent = []

    async def fake_send(sub, payload, store):
        sent.append(json.loads(payload))
        return True

    def cycle():
        return asyncio.run(notifications.run_alert_cycle(push, hist, weather, send=fake_send))

    return weather, sent, cycle


def test_new_alert_is_pushed_once(tmp_path, monkeypatch):
    weather, sent, cycle = _setup(tmp_path, monkeypatch)
    weather.alerts = [_alert("storm-thunder", "HIGH")]
    assert cycle() == 1
    assert sent[0]["title"] == "HIGH: Storm" and "New alert for Home" in sent[0]["body"]
    assert cycle() == 0  # same episode, same severity: no repeat


def test_escalation_is_pushed_again(tmp_path, monkeypatch):
    weather, sent, cycle = _setup(tmp_path, monkeypatch)
    weather.alerts = [_alert("wind", "MODERATE")]
    cycle()
    weather.alerts = [_alert("wind", "EXTREME")]
    assert cycle() == 1
    assert sent[-1]["title"].startswith("EXTREME") and "upgraded" in sent[-1]["body"]


def test_below_threshold_is_not_pushed(tmp_path, monkeypatch):
    weather, sent, cycle = _setup(tmp_path, monkeypatch, min_severity="HIGH")
    weather.alerts = [_alert("wind", "MODERATE")]
    assert cycle() == 0


def test_all_clear_never_pushed(tmp_path, monkeypatch):
    weather, sent, cycle = _setup(tmp_path, monkeypatch, min_severity="LOW")
    weather.alerts = [{**_alert("normal-baseline", "LOW", "Favorable"), "alert_type": "favorable_weather"}]
    assert cycle() == 0


def test_vapid_keys_persist(tmp_path):
    k1 = VapidKeys(str(tmp_path / "v.pem"))
    k2 = VapidKeys(str(tmp_path / "v.pem"))
    assert k1.public_key == k2.public_key and len(k1.public_key) > 80


def test_subscribe_status_unsubscribe_api(tmp_path, monkeypatch):
    store = PushStore(str(tmp_path / "api.db"))
    monkeypatch.setattr(notifications, "get_push_store", lambda: store)
    c = TestClient(app)
    assert len(c.get("/api/notifications/vapid-public-key").json()["public_key"]) > 80
    r = c.post("/api/notifications/subscribe", json={
        "subscription": SUB,
        "locations": [{"latitude": LAT, "longitude": LON, "name": "Home"}, {"latitude": LAT + 0.001, "longitude": LON}],
        "min_severity": "HIGH",
    })
    assert r.json()["locations"] == 1  # same ~1 km cell collapses
    st = c.post("/api/notifications/status", json={"endpoint": SUB["endpoint"]}).json()
    assert st["subscribed"] and st["min_severity"] == "HIGH"
    c.post("/api/notifications/unsubscribe", json={"endpoint": SUB["endpoint"]})
    assert not c.post("/api/notifications/status", json={"endpoint": SUB["endpoint"]}).json()["subscribed"]
    assert c.post("/api/notifications/test", json={"endpoint": SUB["endpoint"]}).status_code == 404
