"""
Settings API endpoints.

User personalization: saved locations, units, activity types.
"""

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class UserSettings(BaseModel):
    """User preferences and personalization."""
    units: str = "metric"  # "metric" or "imperial"
    saved_locations: list[dict] = []  # [{"name": str, "lat": float, "lon": float}]
    activity_types: list[str] = []   # ["commuting", "running", "cycling", etc.]
    theme: str = "dark"              # "dark" or "light"


@router.get("/", response_model=UserSettings)
async def get_settings():
    """
    Get current user settings.
    For MVP, settings are managed client-side (localStorage).
    This endpoint provides defaults.
    """
    return UserSettings()


@router.post("/", response_model=UserSettings)
async def update_settings(settings: UserSettings):
    """
    Update user settings.
    For MVP, this validates and echoes back the settings.
    Full persistence will be added when user accounts are implemented.
    """
    # TODO: Phase 2 — Persist to database when auth is added
    return settings
