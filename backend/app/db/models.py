"""SQLAlchemy models for WeatherGPT."""
from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    Integer,
    Float,
    String,
    Boolean,
    DateTime,
    ForeignKey,
    Text,
    UniqueConstraint,
    Index,
)
from sqlalchemy.orm import relationship
from app.db.session import Base


def utc_now():
    return datetime.now(timezone.utc)


class Location(Base):
    """Geographic location monitored by the platform."""
    __tablename__ = "locations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    elevation = Column(Float, nullable=True)
    timezone = Column(String(50), default="UTC", nullable=False)
    is_favorite = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    observations = relationship("WeatherObservation", back_populates="location", cascade="all, delete-orphan")
    ingestion_runs = relationship("IngestionRun", back_populates="location", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("latitude", "longitude", name="uq_location_coordinates"),
        Index("idx_location_lat_lon", "latitude", "longitude"),
    )


class WeatherObservation(Base):
    """Cleaned historical or current hourly weather observation."""
    __tablename__ = "weather_observations"

    id = Column(Integer, primary_key=True, index=True)
    location_id = Column(Integer, ForeignKey("locations.id", ondelete="CASCADE"), nullable=False, index=True)
    timestamp = Column(DateTime(timezone=True), nullable=False, index=True)
    
    temperature_2m = Column(Float, nullable=False)       # °C
    precipitation = Column(Float, nullable=False)        # mm
    relative_humidity_2m = Column(Float, nullable=False) # %
    pressure_msl = Column(Float, nullable=False)         # hPa
    wind_speed_10m = Column(Float, nullable=False)       # km/h
    cloud_cover = Column(Float, nullable=False)          # %

    source = Column(String(50), default="open-meteo", nullable=False)
    is_interpolated = Column(Boolean, default=False, nullable=False)
    is_anomaly = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    location = relationship("Location", back_populates="observations")

    __table_args__ = (
        UniqueConstraint("location_id", "timestamp", name="uq_location_timestamp"),
        Index("idx_obs_loc_time", "location_id", "timestamp"),
    )


class IngestionRun(Base):
    """Audit log of scheduled and ad-hoc ingestion executions."""
    __tablename__ = "ingestion_runs"

    id = Column(Integer, primary_key=True, index=True)
    location_id = Column(Integer, ForeignKey("locations.id", ondelete="SET NULL"), nullable=True)
    started_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(20), default="running", nullable=False)  # running, completed, failed
    rows_ingested = Column(Integer, default=0, nullable=False)
    error_message = Column(Text, nullable=True)

    location = relationship("Location", back_populates="ingestion_runs")


class UserSetting(Base):
    """User preferences stored in the platform."""
    __tablename__ = "user_settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(50), unique=True, nullable=False, index=True)
    temperature_unit = Column(String(20), default="celsius", nullable=False)  # celsius, fahrenheit
    precipitation_unit = Column(String(20), default="mm", nullable=False)     # mm, inch
    activity_type = Column(String(50), default="running", nullable=False)     # commuting, running, travel, outdoor_event
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)


class ModelMetricRecord(Base):
    """Historical model benchmark and evaluation records."""
    __tablename__ = "model_metric_records"

    id = Column(Integer, primary_key=True, index=True)
    model_name = Column(String(50), nullable=False, index=True)  # xgboost, lstm, persistence, climatology, ensemble
    horizon_hours = Column(Integer, nullable=False)              # 1, 6, 12, 24, 48, 72
    mae = Column(Float, nullable=False)
    rmse = Column(Float, nullable=False)
    crps = Column(Float, nullable=True)
    brier_score = Column(Float, nullable=True)
    recorded_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
