"""Pydantic schemas for platform settings and saved locations."""
from typing import List, Optional
from pydantic import BaseModel, Field


class SavedLocationItem(BaseModel):
    id: Optional[int] = None
    name: str
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    timezone: str = "UTC"
    is_favorite: bool = False


class UnitSettings(BaseModel):
    temperature: str = Field("celsius", pattern="^(celsius|fahrenheit)$")
    precipitation: str = Field("mm", pattern="^(mm|inch)$")


class PlatformSettings(BaseModel):
    units: UnitSettings
    active_activity: str = Field("running", description="Current user activity")
    available_activities: List[str] = [
        "commuting",
        "running",
        "travel",
        "outdoor_event",
        "cycling",
        "hiking",
    ]
    saved_locations: List[SavedLocationItem]


class UpdateSettingsRequest(BaseModel):
    units: Optional[UnitSettings] = None
    active_activity: Optional[str] = None
    saved_locations: Optional[List[SavedLocationItem]] = None
