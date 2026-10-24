"""API router registrations."""
from fastapi import APIRouter
from app.api import health, forecast, alerts, chat, settings, admin

api_router = APIRouter()

api_router.include_router(health.router, tags=["health"])
api_router.include_router(forecast.router, prefix="/forecast", tags=["forecast"])
api_router.include_router(alerts.router, prefix="/alerts", tags=["alerts"])
api_router.include_router(chat.router, prefix="/chat", tags=["chat"])
api_router.include_router(settings.router, prefix="/settings", tags=["settings"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
