"""APScheduler pipeline for automated and idempotent weather ingestion."""
import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, Optional
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select, func
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.config import get_settings
from app.db.session import AsyncSessionLocal
from app.db.models import Location, WeatherObservation, IngestionRun
from app.ingestion.open_meteo import OpenMeteoClient

logger = logging.getLogger("weathergpt.scheduler")
settings = get_settings()

scheduler = AsyncIOScheduler()
open_meteo_client = OpenMeteoClient()

_last_ingestion_summary = {
    "last_run_time": None,
    "last_run_status": "never_run",
    "last_rows_ingested": 0,
}


def get_last_ingestion_summary() -> Dict:
    return _last_ingestion_summary


async def ensure_default_location() -> Location:
    """Ensures at least the default location exists in the database."""
    async with AsyncSessionLocal() as session:
        stmt = select(Location).where(
            func.round(Location.latitude, 2) == round(settings.DEFAULT_LAT, 2),
            func.round(Location.longitude, 2) == round(settings.DEFAULT_LON, 2),
        )
        result = await session.execute(stmt)
        location = result.scalars().first()
        if not location:
            location = Location(
                name=settings.DEFAULT_CITY,
                latitude=settings.DEFAULT_LAT,
                longitude=settings.DEFAULT_LON,
                timezone="UTC",
                is_favorite=True,
            )
            session.add(location)
            await session.commit()
            await session.refresh(location)
            logger.info(f"Initialized default location: {location.name} ({location.latitude}, {location.longitude})")
        return location


async def ingest_location_data(location_id: int) -> int:
    """
    Fetches, cleans, and upserts weather observations for a specific location.
    Logs run status in IngestionRun table.
    """
    started_at = datetime.now(timezone.utc)
    rows_count = 0
    run_record_id = None

    async with AsyncSessionLocal() as session:
        loc = await session.get(Location, location_id)
        if not loc:
            logger.error(f"Location ID {location_id} not found.")
            return 0

        # Create running audit record
        run_record = IngestionRun(
            location_id=loc.id,
            started_at=started_at,
            status="running",
            rows_ingested=0,
        )
        session.add(run_record)
        await session.commit()
        await session.refresh(run_record)
        run_record_id = run_record.id

        try:
            # Fetch 7 days of hourly forecast data
            cleaned_records = await open_meteo_client.get_forecast(
                lat=loc.latitude,
                lon=loc.longitude,
                forecast_days=7,
            )

            if not cleaned_records:
                raise ValueError("No records returned from Open-Meteo client")

            # Upsert records idempotently
            is_sqlite = "sqlite" in settings.DATABASE_URL
            for rec in cleaned_records:
                ts = datetime.fromisoformat(str(rec["timestamp"]))
                
                # Check if observation exists
                obs_stmt = select(WeatherObservation).where(
                    WeatherObservation.location_id == loc.id,
                    WeatherObservation.timestamp == ts,
                )
                existing = (await session.execute(obs_stmt)).scalars().first()

                if existing:
                    existing.temperature_2m = rec["temperature_2m"]
                    existing.precipitation = rec["precipitation"]
                    existing.relative_humidity_2m = rec["relative_humidity_2m"]
                    existing.pressure_msl = rec["pressure_msl"]
                    existing.wind_speed_10m = rec["wind_speed_10m"]
                    existing.cloud_cover = rec["cloud_cover"]
                    existing.is_interpolated = rec.get("is_interpolated", False)
                else:
                    new_obs = WeatherObservation(
                        location_id=loc.id,
                        timestamp=ts,
                        temperature_2m=rec["temperature_2m"],
                        precipitation=rec["precipitation"],
                        relative_humidity_2m=rec["relative_humidity_2m"],
                        pressure_msl=rec["pressure_msl"],
                        wind_speed_10m=rec["wind_speed_10m"],
                        cloud_cover=rec["cloud_cover"],
                        is_interpolated=rec.get("is_interpolated", False),
                        source="open-meteo",
                    )
                    session.add(new_obs)
                rows_count += 1

            # Update audit record
            run_record.status = "completed"
            run_record.completed_at = datetime.now(timezone.utc)
            run_record.rows_ingested = rows_count
            await session.commit()

            _last_ingestion_summary["last_run_time"] = datetime.now(timezone.utc)
            _last_ingestion_summary["last_run_status"] = "completed"
            _last_ingestion_summary["last_rows_ingested"] = rows_count

            logger.info(f"Ingestion successful for {loc.name}: {rows_count} rows upserted.")
            return rows_count

        except Exception as e:
            logger.error(f"Ingestion failed for location {loc.id}: {e}", exc_info=True)
            await session.rollback()
            if run_record_id:
                async with AsyncSessionLocal() as err_session:
                    rec = await err_session.get(IngestionRun, run_record_id)
                    if rec:
                        rec.status = "failed"
                        rec.completed_at = datetime.now(timezone.utc)
                        rec.error_message = str(e)
                        await err_session.commit()

            _last_ingestion_summary["last_run_time"] = datetime.now(timezone.utc)
            _last_ingestion_summary["last_run_status"] = "failed"
            return 0


async def scheduled_ingestion_job():
    """Background job executed periodically by APScheduler."""
    logger.info("Starting scheduled weather ingestion job...")
    async with AsyncSessionLocal() as session:
        stmt = select(Location)
        locations = (await session.execute(stmt)).scalars().all()

    if not locations:
        default_loc = await ensure_default_location()
        locations = [default_loc]

    for loc in locations:
        await ingest_location_data(loc.id)


def start_scheduler():
    """Initializes and starts APScheduler."""
    if not scheduler.running:
        scheduler.add_job(
            scheduled_ingestion_job,
            "interval",
            hours=settings.INGESTION_INTERVAL_HOURS,
            id="weather_ingestion_job",
            replace_existing=True,
        )
        scheduler.start()
        logger.info(f"APScheduler started (interval: {settings.INGESTION_INTERVAL_HOURS}h).")


def shutdown_scheduler():
    """Shuts down scheduler gracefully."""
    if scheduler.running:
        scheduler.shutdown()
        logger.info("APScheduler stopped.")
