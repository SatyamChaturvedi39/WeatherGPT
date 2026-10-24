"""Optional NOAA GHCN (Global Historical Climatology Network) ingestion client."""
import logging
from typing import Any, Dict, List, Optional
from datetime import datetime
import httpx
from app.ingestion.cleaning import WeatherDataCleaner

logger = logging.getLogger("weathergpt.noaa")


class NOAAClient:
    """NOAA GHCN-Daily / ISD client for supplementary climate baseline checks."""

    def __init__(self, token: Optional[str] = None):
        self.token = token
        self.base_url = "https://www.ncei.noaa.gov/cdo-web/api/v2"
        self.cleaner = WeatherDataCleaner()

    async def fetch_station_data(
        self,
        station_id: str,
        start_date: str,
        end_date: str,
    ) -> List[Dict[str, Any]]:
        """Fetch daily summaries from NOAA CDO API if token configured."""
        if not self.token:
            logger.info("NOAA API token not configured; skipping NOAA ingestion.")
            return []

        headers = {"token": self.token}
        params = {
            "datasetid": "GHCND",
            "stationid": station_id,
            "startdate": start_date,
            "enddate": end_date,
            "limit": 1000,
        }

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                res = await client.get(f"{self.base_url}/data", headers=headers, params=params)
                if res.status_code == 200:
                    data = res.json().get("results", [])
                    return data
                logger.warning(f"NOAA request returned status {res.status_code}")
                return []
        except Exception as e:
            logger.warning(f"NOAA ingestion failed: {e}")
            return []
