"""
Flood-Risk Digital Twin API.

Per-zone waterlogging probability forecasts for Bengaluru, driven by the live
NWP rain forecast and propagated through the zone ponding model, with
crowd-sourced ground-truth reports assimilated on every request.
"""

import time
from functools import lru_cache
from typing import Literal

from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel, Field

from app.core.config import get_settings
from app.services.weather import WeatherService
from app.services.flood_twin import run_flood_twin, unique_zones
from app.services.crowd_reports import (
    MAX_ZONE_DISTANCE_KM,
    RATE_LIMIT_S,
    REPORT_WINDOW_H,
    ReportStore,
    learn_corrections,
    nearest_zone,
)

router = APIRouter()

# Bengaluru CBD reference station used for the synoptic rain forecast
BASE_LAT, BASE_LON = 12.9716, 77.5946

ZONES = unique_zones(WeatherService.BANGALORE_MICROCLIMATES)
ZONES_BY_ID = {z["id"]: z for z in ZONES}


@lru_cache()
def get_report_store() -> ReportStore:
    return ReportStore(get_settings().CROWD_DB_PATH)


class ReportIn(BaseModel):
    report_type: Literal["dry", "raining", "heavy_rain", "waterlogged"]
    client_id: str = Field(..., min_length=8, max_length=64)
    zone_id: str | None = Field(None, description="Registry zone id; inferred from coordinates if omitted")
    latitude: float | None = Field(None, ge=-90, le=90)
    longitude: float | None = Field(None, ge=-180, le=180)


@router.get("/twin")
async def get_flood_twin(
    hours: int = Query(6, ge=2, le=24, description="Forecast horizon in hours"),
    scenario_mm: float = Query(0.0, ge=0, le=120, description="What-if cloudburst injected into the next hour (mm)"),
    use_reports: bool = Query(True, description="Assimilate recent crowd reports"),
):
    """
    Waterlogging risk timeline for every Bengaluru microclimate zone.

    Each zone gets, per forecast hour, the probability that road water depth
    exceeds 5 cm (waterlogging) and 15 cm (two-wheeler stall), with a
    p10/p50/p90 depth band from the Monte Carlo rain ensemble. Recent crowd
    reports correct the rain probability and the water already on the ground.
    """
    service = WeatherService()
    try:
        forecast = await service.get_hourly_forecast(BASE_LAT, BASE_LON, hours=hours)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Rain forecast fetch failed: {str(e)}")

    hourly = forecast.get("hourly", [])[:hours]
    if len(hourly) < 2:
        raise HTTPException(status_code=502, detail="Rain forecast returned too few hours")

    corrections: dict[str, dict] = {}
    report_count = 0
    if use_reports:
        reports = get_report_store().recent(time.time() - REPORT_WINDOW_H * 3600)
        report_count = len(reports)
        model_rain_prob = (hourly[0].get("precipitation_probability") or 0) / 100.0
        corrections = learn_corrections(reports, ZONES, model_rain_prob)

    result = run_flood_twin(ZONES, hourly, scenario_mm=scenario_mm, corrections=corrections)
    if corrections:
        # Uncorrected run alongside, so the UI can show what the crowd changed
        baseline = run_flood_twin(ZONES, hourly, scenario_mm=scenario_mm)
        base_by_id = {z["id"]: z for z in baseline["zones"]}
        for zone in result["zones"]:
            base_tl = base_by_id[zone["id"]]["timeline"]
            for t, b in zip(zone["timeline"], base_tl):
                t["p_waterlog_uncorrected"] = b["p_waterlog"]

    return {
        "status": "success",
        "data": {
            **result,
            "is_simulation": scenario_mm > 0,
            "crowd": {
                "reports_in_window": report_count,
                "window_hours": REPORT_WINDOW_H,
                "zones_corrected": len(corrections),
            },
            "source": {
                "rain_forecast": "Open-Meteo hourly NWP (ECMWF/GFS) at Bengaluru CBD",
                "vulnerability": "CAG 2021 Stormwater Performance Audit & KSNDMC Flood Vulnerability Maps",
                "ground_truth": "Crowd-sourced citizen reports (online bias correction + storage assimilation)",
            },
        },
    }


@router.post("/reports", status_code=201)
async def submit_report(report: ReportIn):
    """Submit a ground-truth observation for a Bengaluru zone."""
    if report.zone_id:
        zone = ZONES_BY_ID.get(report.zone_id)
        if zone is None:
            raise HTTPException(status_code=422, detail=f"Unknown zone '{report.zone_id}'")
        lat, lon = zone["latitude"], zone["longitude"]
    elif report.latitude is not None and report.longitude is not None:
        zone, dist = nearest_zone(report.latitude, report.longitude, ZONES)
        if zone is None or dist > MAX_ZONE_DISTANCE_KM:
            raise HTTPException(status_code=422, detail="Location is outside the Bengaluru zone registry")
        lat, lon = report.latitude, report.longitude
    else:
        raise HTTPException(status_code=422, detail="Provide zone_id or latitude/longitude")

    store = get_report_store()
    last = store.last_from_client(report.client_id, zone["id"])
    if last is not None and time.time() - last < RATE_LIMIT_S:
        wait_min = int((RATE_LIMIT_S - (time.time() - last)) // 60) + 1
        raise HTTPException(status_code=429, detail=f"You already reported {zone['name']} recently. Try again in {wait_min} min.")

    row = store.add(zone["id"], report.report_type, lat, lon, report.client_id)
    return {
        "status": "success",
        "report": {
            "id": row["id"],
            "zone_id": zone["id"],
            "zone_name": zone["name"],
            "report_type": row["report_type"],
            "created_at": row["created_at"],
        },
    }


@router.get("/reports")
async def list_reports(hours: float = Query(REPORT_WINDOW_H, gt=0, le=48)):
    """Recent crowd reports, newest first (client ids are not exposed)."""
    rows = get_report_store().recent(time.time() - hours * 3600)
    return {
        "status": "success",
        "reports": [
            {
                "id": r["id"],
                "zone_id": r["zone_id"],
                "zone_name": ZONES_BY_ID.get(r["zone_id"], {}).get("name", r["zone_id"]),
                "report_type": r["report_type"],
                "created_at": r["created_at"],
            }
            for r in reversed(rows)
        ],
    }
