"""User settings and saved locations management API."""
from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_database
from app.db.models import Location, UserSetting
from app.schemas.settings import (
    PlatformSettings,
    UnitSettings,
    SavedLocationItem,
    UpdateSettingsRequest,
)

router = APIRouter()

DEFAULT_ACTIVITIES = [
    "commuting",
    "running",
    "travel",
    "outdoor_event",
    "cycling",
    "hiking",
]


async def _get_or_create_settings(db: AsyncSession) -> UserSetting:
    stmt = select(UserSetting).where(UserSetting.key == "global_preferences")
    res = await db.execute(stmt)
    setting = res.scalars().first()
    if not setting:
        setting = UserSetting(
            key="global_preferences",
            temperature_unit="celsius",
            precipitation_unit="mm",
            activity_type="running",
        )
        db.add(setting)
        await db.commit()
        await db.refresh(setting)
    return setting


@router.get("", response_model=PlatformSettings)
async def get_settings(db: AsyncSession = Depends(get_database)) -> PlatformSettings:
    """Retrieve platform preferences and all saved locations."""
    user_setting = await _get_or_create_settings(db)

    # Fetch saved locations
    loc_stmt = select(Location).order_by(Location.is_favorite.desc(), Location.name.asc())
    loc_res = await db.execute(loc_stmt)
    locations = loc_res.scalars().all()

    saved_items = [
        SavedLocationItem(
            id=loc.id,
            name=loc.name,
            latitude=loc.latitude,
            longitude=loc.longitude,
            timezone=loc.timezone,
            is_favorite=loc.is_favorite,
        )
        for loc in locations
    ]

    return PlatformSettings(
        units=UnitSettings(
            temperature=user_setting.temperature_unit,
            precipitation=user_setting.precipitation_unit,
        ),
        active_activity=user_setting.activity_type,
        available_activities=DEFAULT_ACTIVITIES,
        saved_locations=saved_items,
    )


@router.put("", response_model=PlatformSettings)
async def update_settings(
    payload: UpdateSettingsRequest,
    db: AsyncSession = Depends(get_database),
) -> PlatformSettings:
    """Update user preferences and saved locations."""
    user_setting = await _get_or_create_settings(db)

    if payload.units:
        user_setting.temperature_unit = payload.units.temperature
        user_setting.precipitation_unit = payload.units.precipitation

    if payload.active_activity:
        user_setting.activity_type = payload.active_activity

    if payload.saved_locations is not None:
        # Upsert or sync locations
        existing_locs_stmt = select(Location)
        existing_locs = (await db.execute(existing_locs_stmt)).scalars().all()
        existing_by_coords = {(round(l.latitude, 3), round(l.longitude, 3)): l for l in existing_locs}

        for loc_item in payload.saved_locations:
            coord_key = (round(loc_item.latitude, 3), round(loc_item.longitude, 3))
            if coord_key in existing_by_coords:
                target = existing_by_coords[coord_key]
                target.name = loc_item.name
                target.is_favorite = loc_item.is_favorite
            else:
                new_loc = Location(
                    name=loc_item.name,
                    latitude=loc_item.latitude,
                    longitude=loc_item.longitude,
                    timezone=loc_item.timezone or "UTC",
                    is_favorite=loc_item.is_favorite,
                )
                db.add(new_loc)

    await db.commit()
    return await get_settings(db=db)
