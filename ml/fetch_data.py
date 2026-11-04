"""
Historical weather data fetcher for WeatherGPT.

Fetches real hourly observations from Open-Meteo Archive API for Bengaluru
(Latitude: 12.9716, Longitude: 77.5946) across 2021-01-01 to 2023-12-31 (3 full years = 26,280 hours).
"""

import os
import sys
import httpx
import pandas as pd

OPEN_METEO_ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"

VARIABLES = [
    "temperature_2m",
    "relative_humidity_2m",
    "apparent_temperature",
    "precipitation",
    "weather_code",
    "surface_pressure",
    "wind_speed_10m",
    "wind_direction_10m",
    "cloud_cover",
]


def fetch_bengaluru_historical_data(
    start_date: str = "2021-01-01",
    end_date: str = "2023-12-31",
    lat: float = 12.9716,
    lon: float = 77.5946,
    output_path: str = "data/bengaluru_hourly_2021_2023.csv",
) -> pd.DataFrame:
    """Fetch hourly weather records from Open-Meteo Archive API and save to CSV."""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    # Check if target or legacy path exists
    if os.path.exists(output_path):
        print(f"Dataset already exists at {output_path}. Loading existing file...")
        df = pd.read_csv(output_path)
        print(f"Loaded {len(df)} rows from {output_path}.")
        return df
    elif os.path.exists("data/bengaluru_hourly_2021_2024.csv"):
        print("Legacy dataset found at data/bengaluru_hourly_2021_2024.csv. Loading and mirroring to 2021_2023...")
        df = pd.read_csv("data/bengaluru_hourly_2021_2024.csv")
        df.to_csv(output_path, index=False)
        return df

    params = {
        "latitude": lat,
        "longitude": lon,
        "start_date": start_date,
        "end_date": end_date,
        "hourly": ",".join(VARIABLES),
        "timezone": "UTC",
    }

    print(f"Querying Open-Meteo Archive API for Bengaluru ({lat}, {lon}) from {start_date} to {end_date}...")
    with httpx.Client(timeout=60.0) as client:
        response = client.get(OPEN_METEO_ARCHIVE_URL, params=params)
        response.raise_for_status()
        data = response.json()

    hourly = data.get("hourly", {})
    df = pd.DataFrame(hourly)
    df["latitude"] = lat
    df["longitude"] = lon
    df["time"] = pd.to_datetime(df["time"])
    
    # Sort chronologically
    df = df.sort_values("time").reset_index(drop=True)
    df.to_csv(output_path, index=False)
    print(f"Successfully saved {len(df)} hourly observations to {output_path}.")
    return df


if __name__ == "__main__":
    fetch_bengaluru_historical_data()
