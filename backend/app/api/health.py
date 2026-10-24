"""Health check endpoint."""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import Settings, get_settings
from app.db.session import get_db
from app.schemas.common import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health_check(
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> HealthResponse:
    """Comprehensive system health status check."""
    db_status = "connected"
    try:
        await db.execute(text("SELECT 1"))
    except Exception as exc:
        db_status = f"error: {str(exc)}"

    return HealthResponse(
        status="ok" if db_status == "connected" else "degraded",
        app=settings.APP_NAME,
        version="0.1.0",
        environment=settings.APP_ENV,
        database=db_status,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )
