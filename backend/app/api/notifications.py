"""
Web Push alert notification endpoints and the background alert job.
"""

from __future__ import annotations

import asyncio
import json
from functools import lru_cache
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.core.config import get_settings
from app.services.alert_history import AlertHistoryStore, location_key
from app.services.push import (
    PushStore,
    SubscriptionGone,
    VapidKeys,
    build_flood_payload,
    build_payload,
    flood_decision,
    notifications_due,
    send_push,
    worst_flood_level,
)
from app.services.risk_engine import assess_weather_risks
from app.services.weather import WeatherService

router = APIRouter()

Severity = Literal["LOW", "MODERATE", "HIGH", "EXTREME"]


class PushKeys(BaseModel):
    p256dh: str
    auth: str


class PushSubscription(BaseModel):
    endpoint: str = Field(..., min_length=10, max_length=1000)
    keys: PushKeys


class WatchedLocation(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    name: str | None = Field(None, max_length=120)


class SubscribeRequest(BaseModel):
    subscription: PushSubscription
    locations: list[WatchedLocation] = Field(..., min_length=1, max_length=10)
    min_severity: Severity = "MODERATE"
    # Bengaluru Flood Twin zone ids to receive waterlogging warnings for
    flood_zones: list[str] = Field(default_factory=list, max_length=30)


class EndpointRequest(BaseModel):
    endpoint: str = Field(..., min_length=10, max_length=1000)


def get_push_store() -> PushStore:
    return PushStore(get_settings().PUSH_DB_PATH)


def get_history_store() -> AlertHistoryStore:
    return AlertHistoryStore(get_settings().ALERT_HISTORY_DB_PATH)


@lru_cache()
def get_vapid_keys() -> VapidKeys:
    return VapidKeys(get_settings().VAPID_PRIVATE_KEY_PATH)


async def _send(sub: dict, payload: str, store: PushStore) -> bool:
    """Send one push off the event loop; drop the subscription if the browser revoked it."""
    try:
        await asyncio.to_thread(send_push, sub, payload, get_vapid_keys(), get_settings().VAPID_SUBJECT)
        return True
    except SubscriptionGone:
        store.unsubscribe(sub["endpoint"])
        return False


@router.get("/vapid-public-key")
async def vapid_public_key():
    return {"public_key": get_vapid_keys().public_key}


@router.post("/subscribe")
async def subscribe(req: SubscribeRequest):
    from app.api.flood import ZONES_BY_ID

    unknown = [z for z in req.flood_zones if z not in ZONES_BY_ID]
    if unknown:
        raise HTTPException(status_code=422, detail=f"Unknown flood zone(s): {', '.join(unknown)}")
    store = get_push_store()
    n = store.subscribe(
        req.subscription.model_dump(),
        [loc.model_dump() for loc in req.locations],
        req.min_severity,
    )
    store.set_flood_zones(req.subscription.endpoint, req.flood_zones)
    return {"status": "subscribed", "locations": n, "min_severity": req.min_severity, "flood_zones": len(set(req.flood_zones))}


@router.post("/unsubscribe")
async def unsubscribe(req: EndpointRequest):
    get_push_store().unsubscribe(req.endpoint)
    return {"status": "unsubscribed"}


@router.post("/status")
async def status(req: EndpointRequest):
    store = get_push_store()
    subs = store.subscriptions(req.endpoint)
    return {
        "subscribed": bool(subs),
        "min_severity": subs[0]["min_severity"] if subs else None,
        "locations": [{"name": s["location_name"], "latitude": s["latitude"], "longitude": s["longitude"]} for s in subs],
        "flood_zones": store.flood_zones(req.endpoint) if subs else [],
    }


@router.post("/test")
async def send_test(req: EndpointRequest):
    store = get_push_store()
    subs = store.subscriptions(req.endpoint)
    if not subs:
        raise HTTPException(status_code=404, detail="This browser is not subscribed to alert notifications.")
    payload = json.dumps({
        "title": "WeatherGPT test notification",
        "body": f"Alerts are on for {', '.join(s['location_name'] for s in subs)}.",
        "url": "/alerts",
        "tag": "weathergpt-test",
    })
    try:
        delivered = await _send(subs[0], payload, store)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Push service rejected the notification: {e}")
    if not delivered:
        raise HTTPException(status_code=410, detail="The browser revoked this subscription; enable notifications again.")
    return {"status": "sent"}


async def run_flood_cycle(push_store: PushStore | None = None, twin_fn=None, send=None) -> int:
    """Push waterlogging warnings for watched Bengaluru zones. Returns pushes sent."""
    push_store = push_store or get_push_store()
    send = send or _send
    watchers = push_store.flood_watchers()
    if not watchers:
        return 0
    if twin_fn is None:
        from app.api.flood import get_flood_twin

        async def twin_fn():
            return (await get_flood_twin(hours=6, scenario_mm=0.0, use_reports=True))["data"]

    zones = {z["id"]: z for z in (await twin_fn())["zones"]}
    sent = 0
    for w in watchers:
        zone = zones.get(w["zone_id"])
        if zone is None:
            continue
        level, point = worst_flood_level(zone)
        previous = push_store.flood_state(w["endpoint"], w["zone_id"])
        notify, new_state = flood_decision(previous, level)
        if notify:
            sub = {"endpoint": w["endpoint"], "p256dh": w["p256dh"], "auth": w["auth"]}
            try:
                if not await send(sub, build_flood_payload(zone, level, point, previous is not None), push_store):
                    continue
                sent += 1
            except Exception as e:
                print(f"[jobs] flood push failed: {e}")
                continue
        push_store.set_flood_state(w["endpoint"], w["zone_id"], new_state)
    return sent


async def run_alert_cycle(push_store: PushStore | None = None, history: AlertHistoryStore | None = None,
                          weather: WeatherService | None = None, send=None) -> int:
    """Evaluate alerts at every subscribed location and push new or escalated ones. Returns pushes sent."""
    push_store = push_store or get_push_store()
    history = history or get_history_store()
    weather = weather or WeatherService()
    send = send or _send
    all_subs = push_store.subscriptions()
    sent = 0
    for lat, lon in push_store.locations():
        key = location_key(lat, lon)
        try:
            current = await weather.get_current_conditions(lat, lon)
            hourly = await weather.get_hourly_forecast(lat, lon, hours=24)
            history.record(lat, lon, assess_weather_risks(current, hourly))
        except Exception as e:
            print(f"[jobs] alert check for {key} failed: {e}")
            continue
        subs = [s for s in all_subs if s["location_key"] == key]
        for sub, ev in notifications_due(subs, history.open_events(lat, lon), push_store):
            escalated = push_store.last_sent_severity(sub["endpoint"], ev["id"]) is not None
            try:
                if await send(sub, build_payload(sub, ev, escalated), push_store):
                    push_store.mark_sent(sub["endpoint"], ev["id"], ev["peak_severity"])
                    sent += 1
            except Exception as e:
                print(f"[jobs] push to subscriber failed: {e}")
    return sent
