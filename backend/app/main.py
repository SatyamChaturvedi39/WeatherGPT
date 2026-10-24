"""WeatherGPT FastAPI Application entrypoint."""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import get_settings
from app.core.logging import setup_logging
from app.core.errors import (
    AppError,
    app_error_handler,
    http_exception_handler,
    validation_exception_handler,
    unhandled_exception_handler,
)
from app.core.security import SimpleRateLimiterMiddleware
from app.db.session import init_db
from app.ingestion.scheduler import (
    ensure_default_location,
    start_scheduler,
    shutdown_scheduler,
)
from app.api import api_router

settings = get_settings()
logger = setup_logging(debug=settings.DEBUG)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan setup and teardown."""
    logger.info("Initializing WeatherGPT database schema...")
    await init_db()
    logger.info("Ensuring default monitored location exists...")
    await ensure_default_location()
    logger.info("Starting ingestion scheduler...")
    start_scheduler()
    yield
    logger.info("Shutting down WeatherGPT ingestion scheduler...")
    shutdown_scheduler()


app = FastAPI(
    title=settings.APP_NAME,
    version="0.1.0",
    description="Explainable, uncertainty-aware weather intelligence platform API.",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# 1. CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Rate Limiting and Security Headers Middleware
app.add_middleware(SimpleRateLimiterMiddleware, max_requests=180, window_seconds=60)

# 3. Standardized Exception Handlers
app.add_exception_handler(AppError, app_error_handler)
app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, unhandled_exception_handler)

# 4. Include API Router
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/", tags=["root"])
async def root():
    return {
        "message": f"Welcome to {settings.APP_NAME} API v0.1.0",
        "docs": "/docs",
        "health": f"{settings.API_V1_STR}/health",
    }
