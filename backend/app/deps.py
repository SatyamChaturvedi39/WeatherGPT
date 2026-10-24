"""Dependency injection providers for FastAPI routes."""
from typing import AsyncGenerator
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import Settings, get_settings
from app.db.session import get_db


async def get_database(db: AsyncSession = Depends(get_db)) -> AsyncSession:
    """Provides async database session."""
    return db


def get_current_settings(settings: Settings = Depends(get_settings)) -> Settings:
    """Provides application configuration settings."""
    return settings
