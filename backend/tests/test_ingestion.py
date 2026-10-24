"""Tests for Open-Meteo ingestion and caching mechanism."""
import pytest
from unittest.mock import patch, MagicMock
from app.ingestion.open_meteo import OpenMeteoClient


@pytest.mark.asyncio
async def test_open_meteo_client_parses_and_cleans():
    client = OpenMeteoClient(cache_dir="./tests/test_cache")
    mock_payload = {
        "latitude": 40.71,
        "longitude": -74.0,
        "hourly": {
            "time": ["2025-06-01T00:00", "2025-06-01T01:00"],
            "temperature_2m": [22.5, 21.8],
            "precipitation": [0.0, 0.2],
            "relative_humidity_2m": [65.0, 68.0],
            "pressure_msl": [1015.2, 1014.8],
            "wind_speed_10m": [12.0, 10.5],
            "cloud_cover": [20.0, 30.0],
        }
    }

    with patch.object(client, "_fetch_with_backoff", return_value=mock_payload):
        records = await client.get_forecast(40.71, -74.0, forecast_days=1)
        assert len(records) == 2
        assert records[0]["temperature_2m"] == 22.5
        assert records[1]["precipitation"] == 0.2
        assert "is_interpolated" in records[0]


@pytest.mark.asyncio
async def test_open_meteo_client_cache_fallback(tmp_path):
    client = OpenMeteoClient(cache_dir=str(tmp_path))
    cache_file = tmp_path / "forecast_40.7128_-74.0060_1d.json"
    cache_file.write_text(
        '{"hourly": {"time": ["2025-06-01T00:00"], "temperature_2m": [25.0], "precipitation": [0.0], "relative_humidity_2m": [50.0], "pressure_msl": [1013.0], "wind_speed_10m": [15.0], "cloud_cover": [10.0]}}'
    )

    # When fetch fails, it reads cached fallback
    with patch.object(client, "_fetch_with_backoff", side_effect=Exception("API Down")):
        records = await client.get_forecast(40.7128, -74.0060, forecast_days=1)
        assert len(records) == 1
        assert records[0]["temperature_2m"] == 25.0
