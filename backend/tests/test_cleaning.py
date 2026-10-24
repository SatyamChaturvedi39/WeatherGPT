"""Tests for data validation and cleaning logic."""
import numpy as np
import pandas as pd
from app.ingestion.cleaning import WeatherDataCleaner, BOUNDS


def test_cleaner_handles_empty_dataframe():
    cleaner = WeatherDataCleaner()
    df = pd.DataFrame()
    cleaned, stats = cleaner.clean_dataframe(df)
    assert cleaned.empty
    assert stats["rows_processed"] == 0


def test_cleaner_interpolates_missing_and_clips_physical_bounds():
    cleaner = WeatherDataCleaner()
    raw_data = {
        "timestamp": [
            "2025-01-01 00:00:00",
            "2025-01-01 01:00:00",
            "2025-01-01 02:00:00",
            "2025-01-01 03:00:00",
        ],
        "temperature_2m": [15.0, np.nan, 25.0, 100.0],  # 100°C is an impossible outlier
        "precipitation": [0.0, np.nan, 2.5, -5.0],       # Negative rain is invalid
        "relative_humidity_2m": [50.0, 60.0, 150.0, 70.0], # 150% is invalid
        "pressure_msl": [1013.0, 1014.0, 1015.0, 1016.0],
        "wind_speed_10m": [10.0, 15.0, 20.0, 25.0],
        "cloud_cover": [0.0, 50.0, 80.0, 100.0],
    }
    df = pd.DataFrame(raw_data)
    cleaned, stats = cleaner.clean_dataframe(df)

    assert stats["rows_processed"] == 4
    assert stats["missing_imputed"] >= 1
    assert stats["outliers_clipped"] >= 2

    # Check bounds
    assert cleaned["temperature_2m"].max() <= BOUNDS["temperature_2m"][1]
    assert cleaned["precipitation"].min() >= 0.0
    assert cleaned["relative_humidity_2m"].max() <= 100.0

    # Row 1 (index 1) should be interpolated to 20.0
    assert abs(cleaned.loc[1, "temperature_2m"] - 20.0) < 1e-4
    assert cleaned.loc[1, "is_interpolated"] == True


def test_cleaner_records_interface():
    cleaner = WeatherDataCleaner()
    records = [
        {"timestamp": "2025-01-01 00:00:00", "temperature_2m": 18.0, "precipitation": 0.0, "relative_humidity_2m": 55.0, "pressure_msl": 1012.0, "wind_speed_10m": 12.0, "cloud_cover": 20.0},
        {"timestamp": "2025-01-01 01:00:00", "temperature_2m": 19.0, "precipitation": 0.1, "relative_humidity_2m": 58.0, "pressure_msl": 1012.0, "wind_speed_10m": 11.0, "cloud_cover": 25.0},
    ]
    cleaned, stats = cleaner.clean_records(records)
    assert len(cleaned) == 2
    assert stats["rows_processed"] == 2
