"""
Feature engineering pipeline for weather forecasting.

Transforms raw weather observations into ML-ready features:
- Lag features (t-1, t-3, t-6, t-12, t-24 hours)
- Rolling statistics (mean, std, min, max over various windows)
- Calendar/temporal features (hour, day-of-week, month, season)
- Cyclical encoding (sin/cos transforms for periodic features)
"""

import numpy as np
import pandas as pd


def add_lag_features(df: pd.DataFrame, target_col: str, lags: list[int]) -> pd.DataFrame:
    """
    Add lagged versions of a target column.

    Args:
        df: Input DataFrame sorted by time.
        target_col: Column to create lags for.
        lags: List of lag periods (in hours).

    Returns:
        DataFrame with new lag columns.
    """
    for lag in lags:
        df[f"{target_col}_lag_{lag}h"] = df[target_col].shift(lag)
    return df


def add_rolling_features(
    df: pd.DataFrame,
    target_col: str,
    windows: list[int],
    stats: list[str] = ["mean", "std", "min", "max"],
) -> pd.DataFrame:
    """
    Add rolling window statistics.

    Args:
        df: Input DataFrame sorted by time.
        target_col: Column to compute rolling stats for.
        windows: List of window sizes (in hours).
        stats: List of statistics to compute.

    Returns:
        DataFrame with new rolling feature columns.
    """
    for window in windows:
        rolling = df[target_col].rolling(window=window, min_periods=1)
        for stat in stats:
            df[f"{target_col}_roll_{window}h_{stat}"] = getattr(rolling, stat)()
    return df


def add_temporal_features(df: pd.DataFrame, time_col: str = "observed_at") -> pd.DataFrame:
    """
    Add calendar and temporal features from a datetime column.

    Features added:
        - hour, day_of_week, day_of_year, month, week_of_year
        - is_weekend, season
        - sin/cos encoded hour and month (cyclical)
    """
    dt = pd.to_datetime(df[time_col])

    df["hour"] = dt.dt.hour
    df["day_of_week"] = dt.dt.dayofweek
    df["day_of_year"] = dt.dt.dayofyear
    df["month"] = dt.dt.month
    df["week_of_year"] = dt.dt.isocalendar().week.astype(int)
    df["is_weekend"] = (dt.dt.dayofweek >= 5).astype(int)

    # Season (Northern Hemisphere)
    df["season"] = df["month"].map({
        12: 0, 1: 0, 2: 0,   # Winter
        3: 1, 4: 1, 5: 1,    # Spring
        6: 2, 7: 2, 8: 2,    # Summer
        9: 3, 10: 3, 11: 3,  # Fall
    })

    # Cyclical encoding (preserves periodicity for ML models)
    df["hour_sin"] = np.sin(2 * np.pi * df["hour"] / 24)
    df["hour_cos"] = np.cos(2 * np.pi * df["hour"] / 24)
    df["month_sin"] = np.sin(2 * np.pi * df["month"] / 12)
    df["month_cos"] = np.cos(2 * np.pi * df["month"] / 12)
    df["day_of_year_sin"] = np.sin(2 * np.pi * df["day_of_year"] / 365)
    df["day_of_year_cos"] = np.cos(2 * np.pi * df["day_of_year"] / 365)

    return df


def add_rate_of_change(df: pd.DataFrame, target_col: str, periods: list[int] = [1, 3, 6]) -> pd.DataFrame:
    """
    Add rate-of-change (derivative) features.

    Args:
        df: Input DataFrame sorted by time.
        target_col: Column to compute rate of change for.
        periods: List of periods to compute diffs over.
    """
    for period in periods:
        df[f"{target_col}_diff_{period}h"] = df[target_col].diff(periods=period)
    return df


def build_feature_matrix(
    df: pd.DataFrame,
    target_col: str = "temperature_2m",
    time_col: str = "observed_at",
) -> pd.DataFrame:
    """
    Full feature engineering pipeline.

    Applies all transformations and drops rows with NaN values
    created by lagging and rolling operations.

    Args:
        df: Raw weather observations DataFrame.
        target_col: Primary prediction target.
        time_col: Datetime column name.

    Returns:
        Feature-engineered DataFrame ready for ML training.
    """
    df = df.sort_values(time_col).copy()

    # Temporal features
    df = add_temporal_features(df, time_col)

    # Lag features for key variables
    lag_hours = [1, 3, 6, 12, 24]
    for col in ["temperature_2m", "relative_humidity_2m", "precipitation", "wind_speed_10m", "surface_pressure"]:
        if col in df.columns:
            df = add_lag_features(df, col, lag_hours)

    # Rolling statistics
    windows = [6, 12, 24, 48]
    for col in ["temperature_2m", "precipitation", "wind_speed_10m"]:
        if col in df.columns:
            df = add_rolling_features(df, col, windows)

    # Rate of change
    for col in ["temperature_2m", "surface_pressure"]:
        if col in df.columns:
            df = add_rate_of_change(df, col)

    # Drop rows with NaN from lag/rolling operations
    initial_len = len(df)
    df = df.dropna()
    print(f"Feature engineering: {initial_len} → {len(df)} rows (dropped {initial_len - len(df)} with NaN)")

    return df
