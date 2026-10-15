"""
Data ingestion pipeline — Open-Meteo → PostgreSQL.

Fetches historical and real-time weather data from Open-Meteo API
and stores it in the database for ML training and analysis.

Usage:
    python ingestion.py --lat 40.7128 --lon -74.0060 --days 365
    python ingestion.py --lat 40.7128 --lon -74.0060 --mode realtime
"""

import argparse
import asyncio
from datetime import datetime, timedelta

import httpx
import pandas as pd


OPEN_METEO_HISTORICAL_URL = "https://archive-api.open-meteo.com/v1/archive"
OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"

# Variables to fetch (consistent with our schema)
HOURLY_VARIABLES = [
    "temperature_2m",
    "relative_humidity_2m",
    "apparent_temperature",
    "precipitation",
    "weather_code",
    "wind_speed_10m",
    "wind_direction_10m",
    "surface_pressure",
    "cloud_cover",
]


async def fetch_historical_data(
    lat: float,
    lon: float,
    start_date: str,
    end_date: str,
) -> pd.DataFrame:
    """
    Fetch historical hourly weather data from Open-Meteo Archive API.

    Args:
        lat: Latitude of the location.
        lon: Longitude of the location.
        start_date: Start date in YYYY-MM-DD format.
        end_date: End date in YYYY-MM-DD format.

    Returns:
        DataFrame with hourly weather observations.
    """
    params = {
        "latitude": lat,
        "longitude": lon,
        "start_date": start_date,
        "end_date": end_date,
        "hourly": ",".join(HOURLY_VARIABLES),
        "timezone": "UTC",
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        print(f"Fetching historical data from {start_date} to {end_date}...")
        response = await client.get(OPEN_METEO_HISTORICAL_URL, params=params)
        response.raise_for_status()
        data = response.json()

    hourly = data.get("hourly", {})
    df = pd.DataFrame(hourly)
    df["latitude"] = lat
    df["longitude"] = lon
    df["observed_at"] = pd.to_datetime(df["time"])
    df["ingested_at"] = datetime.utcnow()
    df = df.drop(columns=["time"])

    print(f"  → Fetched {len(df)} hourly observations.")
    return df


async def fetch_realtime_data(lat: float, lon: float) -> pd.DataFrame:
    """
    Fetch current + last 24h forecast data from Open-Meteo.

    Args:
        lat: Latitude of the location.
        lon: Longitude of the location.

    Returns:
        DataFrame with recent hourly observations.
    """
    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": ",".join(HOURLY_VARIABLES),
        "past_hours": 24,
        "forecast_hours": 1,
        "timezone": "UTC",
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        print("Fetching realtime data (last 24h)...")
        response = await client.get(OPEN_METEO_FORECAST_URL, params=params)
        response.raise_for_status()
        data = response.json()

    hourly = data.get("hourly", {})
    df = pd.DataFrame(hourly)
    df["latitude"] = lat
    df["longitude"] = lon
    df["observed_at"] = pd.to_datetime(df["time"])
    df["ingested_at"] = datetime.utcnow()
    df = df.drop(columns=["time"])

    print(f"  → Fetched {len(df)} hourly data points.")
    return df


def save_to_csv(df: pd.DataFrame, filepath: str):
    """Save DataFrame to CSV for inspection or backup."""
    df.to_csv(filepath, index=False)
    print(f"  → Saved to {filepath}")


async def main():
    parser = argparse.ArgumentParser(description="WeatherGPT Data Ingestion")
    parser.add_argument("--lat", type=float, required=True, help="Latitude")
    parser.add_argument("--lon", type=float, required=True, help="Longitude")
    parser.add_argument("--days", type=int, default=365, help="Days of historical data")
    parser.add_argument("--mode", choices=["historical", "realtime"], default="historical")
    parser.add_argument("--output", type=str, default=None, help="Output CSV path")
    args = parser.parse_args()

    if args.mode == "historical":
        end_date = datetime.utcnow().strftime("%Y-%m-%d")
        start_date = (datetime.utcnow() - timedelta(days=args.days)).strftime("%Y-%m-%d")
        df = await fetch_historical_data(args.lat, args.lon, start_date, end_date)
    else:
        df = await fetch_realtime_data(args.lat, args.lon)

    # Save to CSV (DB insertion will be added in Phase 1, Week 2)
    output_path = args.output or f"weather_data_{args.lat}_{args.lon}.csv"
    save_to_csv(df, output_path)

    # Summary stats
    print("\n📊 Data Summary:")
    print(f"   Records: {len(df)}")
    print(f"   Date range: {df['observed_at'].min()} → {df['observed_at'].max()}")
    print(f"   Temp range: {df['temperature_2m'].min():.1f}°C → {df['temperature_2m'].max():.1f}°C")
    print(f"   Missing values:\n{df.isnull().sum().to_string()}")


if __name__ == "__main__":
    asyncio.run(main())
