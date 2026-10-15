"""
Weather service — Open-Meteo API integration.

Handles all communication with the Open-Meteo API for:
- Current weather conditions
- Hourly and daily forecasts
- Geocoding (location search)
"""

import httpx
from app.core.config import get_settings

settings = get_settings()


class WeatherService:
    """Service for fetching weather data from Open-Meteo API."""

    def __init__(self):
        self.base_url = settings.OPEN_METEO_BASE_URL
        self.geocoding_url = settings.OPEN_METEO_GEOCODING_URL

    async def get_current_conditions(self, lat: float, lon: float) -> dict:
        """
        Fetch current weather conditions for a location.

        Returns:
            dict with temperature, humidity, wind speed, precipitation,
            weather code, and feels-like temperature.
        """
        params = {
            "latitude": lat,
            "longitude": lon,
            "current": [
                "temperature_2m",
                "relative_humidity_2m",
                "apparent_temperature",
                "precipitation",
                "weather_code",
                "wind_speed_10m",
                "wind_direction_10m",
                "surface_pressure",
                "cloud_cover",
            ],
            "timezone": "auto",
        }

        async with httpx.AsyncClient() as client:
            response = await client.get(f"{self.base_url}/forecast", params=params)
            response.raise_for_status()
            data = response.json()

        current = data.get("current", {})
        units = data.get("current_units", {})

        return {
            "location": {
                "latitude": data.get("latitude"),
                "longitude": data.get("longitude"),
                "timezone": data.get("timezone"),
                "elevation": data.get("elevation"),
            },
            "current": current,
            "units": units,
            "timestamp": current.get("time"),
        }

    async def get_hourly_forecast(self, lat: float, lon: float, hours: int = 48) -> dict:
        """
        Fetch hourly forecast data.

        Args:
            lat: Latitude
            lon: Longitude
            hours: Number of forecast hours (max 168)

        Returns:
            dict with hourly time-series data.
        """
        params = {
            "latitude": lat,
            "longitude": lon,
            "hourly": [
                "temperature_2m",
                "relative_humidity_2m",
                "apparent_temperature",
                "precipitation_probability",
                "precipitation",
                "weather_code",
                "wind_speed_10m",
                "wind_direction_10m",
                "cloud_cover",
                "visibility",
                "uv_index",
            ],
            "forecast_hours": hours,
            "timezone": "auto",
        }

        async with httpx.AsyncClient() as client:
            response = await client.get(f"{self.base_url}/forecast", params=params)
            response.raise_for_status()
            data = response.json()

        hourly = data.get("hourly", {})
        units = data.get("hourly_units", {})

        # Transform into list of time-point objects for easier frontend consumption
        time_points = []
        times = hourly.get("time", [])
        for i, t in enumerate(times):
            point = {"time": t}
            for key in hourly:
                if key != "time":
                    point[key] = hourly[key][i] if i < len(hourly[key]) else None
            time_points.append(point)

        return {
            "location": {
                "latitude": data.get("latitude"),
                "longitude": data.get("longitude"),
                "timezone": data.get("timezone"),
            },
            "hourly": time_points,
            "units": units,
        }

    async def get_daily_forecast(self, lat: float, lon: float, days: int = 7) -> dict:
        """
        Fetch daily forecast data.

        Args:
            lat: Latitude
            lon: Longitude
            days: Number of forecast days (max 16)

        Returns:
            dict with daily forecast data.
        """
        params = {
            "latitude": lat,
            "longitude": lon,
            "daily": [
                "temperature_2m_max",
                "temperature_2m_min",
                "apparent_temperature_max",
                "apparent_temperature_min",
                "precipitation_sum",
                "precipitation_probability_max",
                "weather_code",
                "wind_speed_10m_max",
                "sunrise",
                "sunset",
                "uv_index_max",
            ],
            "forecast_days": days,
            "timezone": "auto",
        }

        async with httpx.AsyncClient() as client:
            response = await client.get(f"{self.base_url}/forecast", params=params)
            response.raise_for_status()
            data = response.json()

        daily = data.get("daily", {})
        units = data.get("daily_units", {})

        # Transform into list of day objects
        day_points = []
        times = daily.get("time", [])
        for i, t in enumerate(times):
            point = {"date": t}
            for key in daily:
                if key != "time":
                    point[key] = daily[key][i] if i < len(daily[key]) else None
            day_points.append(point)

        return {
            "location": {
                "latitude": data.get("latitude"),
                "longitude": data.get("longitude"),
                "timezone": data.get("timezone"),
            },
            "daily": day_points,
            "units": units,
        }

    async def geocode(self, query: str, count: int = 5) -> list[dict]:
        """
        Search for locations by name.

        Args:
            query: Location name to search for.
            count: Maximum number of results.

        Returns:
            List of matching locations with coordinates.
        """
        params = {
            "name": query,
            "count": count,
            "language": "en",
            "format": "json",
        }

        async with httpx.AsyncClient() as client:
            response = await client.get(f"{self.geocoding_url}/search", params=params)
            response.raise_for_status()
            data = response.json()

        results = data.get("results", [])
        return [
            {
                "name": r.get("name"),
                "country": r.get("country"),
                "admin1": r.get("admin1"),  # State/province
                "latitude": r.get("latitude"),
                "longitude": r.get("longitude"),
                "elevation": r.get("elevation"),
                "timezone": r.get("timezone"),
                "population": r.get("population"),
            }
            for r in results
        ]
