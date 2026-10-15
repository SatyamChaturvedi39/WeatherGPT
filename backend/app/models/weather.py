"""
SQLAlchemy models for weather data storage.
"""

from datetime import datetime

from sqlalchemy import Column, Integer, Float, String, DateTime, Index
from app.core.database import Base


class WeatherObservation(Base):
    """
    Stores ingested weather observations from Open-Meteo.
    Uses standard B-tree indexes on timestamp and location for
    efficient time-series queries (TimescaleDB substitute).
    """
    __tablename__ = "weather_observations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    location_name = Column(String(255), nullable=True)

    # Timestamp
    observed_at = Column(DateTime, nullable=False, index=True)
    ingested_at = Column(DateTime, default=datetime.utcnow)

    # Weather variables
    temperature_2m = Column(Float)
    relative_humidity_2m = Column(Float)
    apparent_temperature = Column(Float)
    precipitation = Column(Float)
    weather_code = Column(Integer)
    wind_speed_10m = Column(Float)
    wind_direction_10m = Column(Float)
    surface_pressure = Column(Float)
    cloud_cover = Column(Float)

    # Composite index for efficient location + time queries
    __table_args__ = (
        Index("idx_location_time", "latitude", "longitude", "observed_at"),
    )


class ForecastPrediction(Base):
    """
    Stores ML model predictions for future weather.
    Includes confidence intervals for probabilistic forecasting.
    """
    __tablename__ = "forecast_predictions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)

    # When the prediction was made and what it predicts
    predicted_at = Column(DateTime, default=datetime.utcnow)
    target_time = Column(DateTime, nullable=False, index=True)

    # Model info
    model_name = Column(String(100), nullable=False)  # "xgboost", "lstm", "ensemble"
    model_version = Column(String(50))

    # Predictions with uncertainty
    temperature_predicted = Column(Float)
    temperature_lower = Column(Float)  # Lower confidence bound
    temperature_upper = Column(Float)  # Upper confidence bound
    precipitation_probability = Column(Float)

    # Composite index
    __table_args__ = (
        Index("idx_forecast_location_target", "latitude", "longitude", "target_time"),
    )


class AlertRecord(Base):
    """
    Stores generated weather alerts.
    """
    __tablename__ = "alert_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    location_name = Column(String(255), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)

    severity = Column(String(20), nullable=False)  # LOW, MODERATE, HIGH, EXTREME
    alert_type = Column(String(100), nullable=False)  # "heavy_rain", "extreme_heat", etc.
    title = Column(String(255), nullable=False)
    description = Column(String(1000))

    # Source
    triggered_by = Column(String(100))  # "threshold", "anomaly_detection", "manual"

    __table_args__ = (
        Index("idx_alert_location", "latitude", "longitude", "created_at"),
    )
