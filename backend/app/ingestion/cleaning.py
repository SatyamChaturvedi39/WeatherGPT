"""Weather data validation, outlier detection, and interpolation cleaning."""
import logging
from typing import Dict, List, Optional, Tuple
import numpy as np
import pandas as pd

logger = logging.getLogger("weathergpt.cleaning")

# Physical meteorological bounds
BOUNDS = {
    "temperature_2m": (-90.0, 60.0),      # Celsius
    "precipitation": (0.0, 300.0),         # mm/hour
    "relative_humidity_2m": (0.0, 100.0),  # %
    "pressure_msl": (870.0, 1085.0),       # hPa
    "wind_speed_10m": (0.0, 350.0),        # km/h
    "cloud_cover": (0.0, 100.0),           # %
}


class WeatherDataCleaner:
    """Cleans raw hourly meteorological observations."""

    def __init__(self, z_score_threshold: float = 4.5):
        self.z_score_threshold = z_score_threshold

    def clean_dataframe(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict[str, int]]:
        """
        Cleans a pandas DataFrame with raw weather data.
        Returns: (cleaned_df, cleaning_stats)
        """
        if df.empty:
            return df, {"rows_processed": 0, "missing_imputed": 0, "outliers_clipped": 0}

        stats = {
            "rows_processed": len(df),
            "missing_imputed": 0,
            "outliers_clipped": 0,
        }

        cleaned = df.copy()

        # 1. Ensure timestamp is datetime and sort chronologically
        if "timestamp" in cleaned.columns:
            cleaned["timestamp"] = pd.to_datetime(cleaned["timestamp"])
            cleaned = cleaned.sort_values("timestamp").reset_index(drop=True)
            # Remove duplicate timestamps keeping the latest
            cleaned = cleaned.drop_duplicates(subset=["timestamp"], keep="last")

        if "is_interpolated" not in cleaned.columns:
            cleaned["is_interpolated"] = False

        # 2. Check each meteorological variable against physical bounds
        for col, (min_val, max_val) in BOUNDS.items():
            if col not in cleaned.columns:
                continue

            # Identify invalid physical values
            invalid_mask = (cleaned[col] < min_val) | (cleaned[col] > max_val)
            invalid_count = int(invalid_mask.sum())
            if invalid_count > 0:
                stats["outliers_clipped"] += invalid_count
                cleaned.loc[invalid_mask, col] = np.nan

            # Count initial missing
            col_missing = cleaned[col].isna()
            missing_count = int(col_missing.sum())
            if missing_count > 0:
                stats["missing_imputed"] += missing_count
                cleaned.loc[col_missing, "is_interpolated"] = True

            # Interpolate: linear for continuous, 0 for precipitation
            if col == "precipitation":
                cleaned[col] = cleaned[col].fillna(0.0)
            else:
                # Time-based or linear interpolation
                cleaned[col] = cleaned[col].interpolate(method="linear", limit_direction="both")
                # Fallback to ffill/bfill if edges are NaN
                cleaned[col] = cleaned[col].ffill().bfill()

            # Final clip to strictly guarantee physical bounds
            cleaned[col] = cleaned[col].clip(lower=min_val, upper=max_val)

        # 3. Detect extreme statistical anomalies using rolling Z-Score for temp and pressure
        for col in ["temperature_2m", "pressure_msl"]:
            if col in cleaned.columns and len(cleaned) > 24:
                rolling_mean = cleaned[col].rolling(window=24, min_periods=3, center=True).mean()
                rolling_std = cleaned[col].rolling(window=24, min_periods=3, center=True).std().replace(0, 1e-6)
                z_scores = ((cleaned[col] - rolling_mean) / rolling_std).abs()
                statistical_outliers = z_scores > self.z_score_threshold
                if statistical_outliers.any():
                    stats["outliers_clipped"] += int(statistical_outliers.sum())
                    cleaned.loc[statistical_outliers, "is_interpolated"] = True
                    cleaned.loc[statistical_outliers, col] = rolling_mean[statistical_outliers]

        logger.debug(f"Cleaned {len(cleaned)} rows. Stats: {stats}")
        return cleaned, stats

    def clean_records(self, raw_records: List[Dict]) -> Tuple[List[Dict], Dict[str, int]]:
        """Converts raw dictionary records to DataFrame, cleans them, and outputs dicts."""
        if not raw_records:
            return [], {"rows_processed": 0, "missing_imputed": 0, "outliers_clipped": 0}
        df = pd.DataFrame(raw_records)
        cleaned_df, stats = self.clean_dataframe(df)
        return cleaned_df.to_dict(orient="records"), stats
