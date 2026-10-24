"""Open-Meteo API ingestion client with retry, backoff, and caching."""
import asyncio
import json
import logging
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
import httpx
from app.config import get_settings
from app.core.errors import IngestionError
from app.ingestion.cleaning import WeatherDataCleaner

logger = logging.getLogger("weathergpt.open_meteo")
settings = get_settings()

HOURLY_VARIABLES = [
    "temperature_2m",
    "precipitation",
    "relative_humidity_2m",
    "pressure_msl",
    "wind_speed_10m",
    "cloud_cover",
]


class OpenMeteoClient:
    """Robust client for Open-Meteo forecast and archive endpoints."""

    def __init__(self, cache_dir: Optional[str] = None):
        self.base_url = settings.OPEN_METEO_BASE_URL
        self.archive_url = settings.OPEN_METEO_ARCHIVE_URL
        self.cleaner = WeatherDataCleaner()
        self.cache_dir = Path(cache_dir or "./cache/open_meteo")
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.retries = settings.INGESTION_RETRIES

    def _get_cache_path(self, endpoint: str, lat: float, lon: float, extra_key: str = "") -> Path:
        sanitized_key = extra_key.replace(":", "_").replace("-", "_")
        filename = f"{endpoint}_{lat:.4f}_{lon:.4f}_{sanitized_key}.json"
        return self.cache_dir / filename

    def _read_cache(self, cache_path: Path, max_age_seconds: int = 3600) -> Optional[Dict[str, Any]]:
        """Read cached JSON if file exists and is not expired."""
        if not cache_path.exists():
            return None
        try:
            mtime = cache_path.stat().st_mtime
            age = (datetime.now(timezone.utc) - datetime.fromtimestamp(mtime, tz=timezone.utc)).total_seconds()
            if age <= max_age_seconds:
                with open(cache_path, "r", encoding="utf-8") as f:
                    return json.load(f)
        except Exception as e:
            logger.warning(f"Error reading cache {cache_path}: {e}")
        return None

    def _write_cache(self, cache_path: Path, data: Dict[str, Any]) -> None:
        """Write JSON data to cache."""
        try:
            with open(cache_path, "w", encoding="utf-8") as f:
                json.dump(data, f)
        except Exception as e:
            logger.warning(f"Failed to write cache {cache_path}: {e}")

    async def _fetch_with_backoff(self, url: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Fetch with exponential backoff retry."""
        last_exception = None
        for attempt in range(1, self.retries + 1):
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.get(url, params=params)
                    if response.status_code == 200:
                        return response.json()
                    elif response.status_code == 429:
                        wait_sec = attempt * 2
                        logger.warning(f"Open-Meteo Rate limit hit, backing off {wait_sec}s...")
                        await asyncio.sleep(wait_sec)
                    else:
                        response.raise_for_status()
            except Exception as exc:
                last_exception = exc
                wait_sec = attempt * 1.5
                logger.warning(f"Fetch attempt {attempt}/{self.retries} failed for {url}: {exc}. Retrying in {wait_sec}s...")
                await asyncio.sleep(wait_sec)

        raise IngestionError(f"Failed to fetch data from Open-Meteo after {self.retries} attempts: {last_exception}")

    async def get_forecast(self, lat: float, lon: float, forecast_days: int = 7) -> List[Dict[str, Any]]:
        """
        Fetch forecast data for a given location.
        Returns cleaned observation/forecast records.
        """
        cache_path = self._get_cache_path("forecast", lat, lon, f"{forecast_days}d")
        cached = self._read_cache(cache_path, max_age_seconds=settings.CACHE_TTL_SECONDS)
        
        raw_data = None
        if cached:
            raw_data = cached
        else:
            params = {
                "latitude": lat,
                "longitude": lon,
                "hourly": ",".join(HOURLY_VARIABLES),
                "forecast_days": forecast_days,
                "timezone": "UTC",
            }
            try:
                raw_data = await self._fetch_with_backoff(f"{self.base_url}/forecast", params)
                self._write_cache(cache_path, raw_data)
            except Exception as e:
                logger.error(f"Failed to fetch live forecast: {e}. Checking stale cache...")
                # Stale cache fallback (any age)
                if cache_path.exists():
                    with open(cache_path, "r", encoding="utf-8") as f:
                        raw_data = json.load(f)
                else:
                    raise

        return self._parse_and_clean_hourly(raw_data)

    async def get_historical(
        self,
        lat: float,
        lon: float,
        start_date: str,
        end_date: str,
    ) -> List[Dict[str, Any]]:
        """
        Fetch historical archive data for dates YYYY-MM-DD.
        Cached permanently because historical data does not change.
        """
        cache_key = f"{start_date}_{end_date}"
        cache_path = self._get_cache_path("archive", lat, lon, cache_key)
        # 365 days max age for historical cache
        cached = self._read_cache(cache_path, max_age_seconds=365 * 86400)
        if cached:
            return self._parse_and_clean_hourly(cached)

        params = {
            "latitude": lat,
            "longitude": lon,
            "start_date": start_date,
            "end_date": end_date,
            "hourly": ",".join(HOURLY_VARIABLES),
            "timezone": "UTC",
        }
        
        try:
            raw_data = await self._fetch_with_backoff(self.archive_url, params)
            self._write_cache(cache_path, raw_data)
            return self._parse_and_clean_hourly(raw_data)
        except Exception as e:
            if cache_path.exists():
                with open(cache_path, "r", encoding="utf-8") as f:
                    return self._parse_and_clean_hourly(json.load(f))
            raise IngestionError(f"Failed to ingest historical data: {e}")

    def _parse_and_clean_hourly(self, raw_json: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Parse Open-Meteo hourly response arrays into row records and run cleaning."""
        hourly = raw_json.get("hourly", {})
        times = hourly.get("time", [])
        if not times:
            return []

        rows: List[Dict[str, Any]] = []
        for i, t in enumerate(times):
            row = {"timestamp": t}
            for var in HOURLY_VARIABLES:
                val_list = hourly.get(var, [])
                row[var] = val_list[i] if i < len(val_list) else None
            rows.append(row)

        cleaned_records, _ = self.cleaner.clean_records(rows)
        return cleaned_records
