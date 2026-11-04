"""
Application configuration loaded from environment variables.
Uses pydantic-settings for validation and type coercion.
"""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Central configuration for the WeatherGPT backend."""

    # ── Application ──────────────────────────────────────────────
    APP_NAME: str = "WeatherGPT"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = True

    # ── Database (Neon PostgreSQL) ───────────────────────────────
    DATABASE_URL: str = "postgresql://localhost:5432/weathergpt"

    # ── Open-Meteo API ───────────────────────────────────────────
    OPEN_METEO_BASE_URL: str = "https://api.open-meteo.com/v1"
    OPEN_METEO_GEOCODING_URL: str = "https://geocoding-api.open-meteo.com/v1"

    # ── LLM APIs ─────────────────────────────────────────────────
    # Primary: Groq (Llama 3)
    GROQ_API_KEY: str = ""
    GROQ_BASE_URL: str = "https://api.groq.com/openai/v1"
    GROQ_MODEL: str = "llama-3.3-70b-versatile"

    # Fallback: Google Gemini Flash
    GEMINI_API_KEY: str = ""

    # ── ChromaDB (Vector Store) ──────────────────────────────────
    CHROMA_PERSIST_DIR: str = "./chroma_data"

    # ── CORS ─────────────────────────────────────────────────────
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",   # Vite dev server
        "http://localhost:3000",   # Alternate dev port
    ]

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": True,
    }


@lru_cache()
def get_settings() -> Settings:
    """Cached settings singleton."""
    return Settings()
