"""Weather and forecast Pydantic models."""
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class WeatherPoint(BaseModel):
    """Hourly observation or forecast point."""
    timestamp: datetime
    temperature_2m: float
    precipitation: float
    relative_humidity_2m: float
    pressure_msl: float
    wind_speed_10m: float
    cloud_cover: float


class CurrentWeatherResponse(BaseModel):
    location_name: str
    latitude: float
    longitude: float
    timestamp: datetime
    temperature_2m: float
    precipitation: float
    relative_humidity_2m: float
    pressure_msl: float
    wind_speed_10m: float
    cloud_cover: float
    is_anomaly: bool = False
    source: str = "open-meteo"


class ForecastInterval(BaseModel):
    timestamp: datetime
    # Temperature quantile bands
    temp_p10: float
    temp_p50: float
    temp_p90: float
    # Precipitation quantile bands and probability
    precip_p10: float
    precip_p50: float
    precip_p90: float
    precip_probability: float = Field(..., ge=0.0, le=1.0)
    # Additional context
    wind_speed_10m: float
    relative_humidity_2m: float
    pressure_msl: float


class ForecastResponse(BaseModel):
    location_name: str
    latitude: float
    longitude: float
    horizon_hours: int
    model_name: str
    generated_at: datetime
    intervals: List[ForecastInterval]


class FeatureContribution(BaseModel):
    feature: str
    display_name: str
    value: float
    shap_value: float
    impact: str  # "increases_temp", "decreases_temp", etc.


class ExplainForecastResponse(BaseModel):
    location_name: str
    latitude: float
    longitude: float
    variable: str
    horizon_hours: int
    predicted_value: float
    base_value: float
    explanation_summary: str
    top_contributions: List[FeatureContribution]


class AlertRiskResponse(BaseModel):
    location_name: str
    latitude: float
    longitude: float
    activity: str
    risk_level: str  # "Low", "Moderate", "High"
    risk_score: float = Field(..., ge=0.0, le=100.0)
    reason: str
    contributing_factors: List[str]
    is_anomaly: bool
    precipitation_probability: float
    max_wind_speed: float
    temp_range: List[float]  # [min_temp, max_temp]
    caution_widened: bool = False


class ChatMessageRequest(BaseModel):
    session_id: str
    message: str = Field(..., min_length=1, max_length=1000)
    lat: Optional[float] = Field(None, ge=-90.0, le=90.0)
    lon: Optional[float] = Field(None, ge=-180.0, le=180.0)
    activity: Optional[str] = "general"


class ChatMessageResponse(BaseModel):
    session_id: str
    answer: str
    sources: List[str]
    confidence: float = Field(..., ge=0.0, le=1.0)
    is_fallback: bool = False
