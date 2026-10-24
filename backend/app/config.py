"""Application settings and configuration."""
import os
from functools import lru_cache
from typing import List
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """WeatherGPT Settings schema loaded from environment variables."""
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    APP_NAME: str = "WeatherGPT"
    APP_ENV: str = "development"
    DEBUG: bool = True
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = "weathergpt-dev-secret-key-change-in-production-32bytes"
    
    # CORS
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000"
    ]

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./weathergpt.db"

    # External APIs
    OPEN_METEO_BASE_URL: str = "https://api.open-meteo.com/v1"
    OPEN_METEO_ARCHIVE_URL: str = "https://archive-api.open-meteo.com/v1/archive"
    DEFAULT_LAT: float = 40.7128
    DEFAULT_LON: float = -74.0060
    DEFAULT_CITY: str = "New York"
    INGESTION_INTERVAL_HOURS: int = 6
    INGESTION_RETRIES: int = 3

    # LLM & RAG Configuration
    LLM_PROVIDER: str = "ollama"  # ollama | openai | anthropic
    OPENAI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.2"
    CHROMA_PERSIST_DIR: str = "./chroma_db"
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"

    # ML & Storage
    MODEL_DIR: str = "./models_store"
    CACHE_TTL_SECONDS: int = 900


@lru_cache()
def get_settings() -> Settings:
    """Cached settings singleton."""
    return Settings()
