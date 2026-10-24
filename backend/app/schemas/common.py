"""Common Pydantic models and validation helpers."""
from typing import Generic, Optional, TypeVar, Any
from pydantic import BaseModel, Field

T = TypeVar("T")


class ErrorDetail(BaseModel):
    code: str
    message: str
    details: Optional[Any] = None


class ErrorResponse(BaseModel):
    error: ErrorDetail


class CoordinatesQuery(BaseModel):
    lat: float = Field(..., ge=-90.0, le=90.0, description="Latitude in decimal degrees")
    lon: float = Field(..., ge=-180.0, le=180.0, description="Longitude in decimal degrees")


class HealthResponse(BaseModel):
    status: str = "ok"
    app: str = "WeatherGPT"
    version: str = "0.1.0"
    environment: str
    database: str
    timestamp: str
