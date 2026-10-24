"""Grounded weather conversational assistant — RAG via Ollama (local LLM)."""
import json
import httpx
from datetime import datetime, timezone
from fastapi import APIRouter
from app.schemas.weather import ChatMessageRequest, ChatMessageResponse
from app.ingestion.open_meteo import OpenMeteoClient
from app.core.logging import setup_logging

router = APIRouter()
open_meteo_client = OpenMeteoClient()
logger = setup_logging()

# Ollama REST endpoint — runs locally, no API key required
OLLAMA_BASE = "http://localhost:11434"
DEFAULT_MODEL = "llama3.1:latest"


def _build_weather_context(lat: float, lon: float, records: list[dict]) -> str:
    """Turn raw forecast records into a structured plain-text context block."""
    if not records:
        return "No forecast data available for this location."

    current = records[0]
    lines = [
        f"=== LIVE WEATHER DATA (Lat {lat:.4f}, Lon {lon:.4f}) ===",
        f"Fetched at: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}",
        "",
        "--- CURRENT CONDITIONS ---",
        f"Temperature:        {current.get('temperature_2m', 'N/A')} °C",
        f"Precipitation:      {current.get('precipitation', 0)} mm/h",
        f"Wind speed:         {current.get('wind_speed_10m', 'N/A')} km/h",
        f"Relative humidity:  {current.get('relative_humidity_2m', 'N/A')} %",
        f"Pressure (MSL):     {current.get('pressure_msl', 'N/A')} hPa",
        f"Cloud cover:        {current.get('cloud_cover', 'N/A')} %",
        "",
        "--- NEXT 12-HOUR HOURLY FORECAST ---",
    ]

    for i, rec in enumerate(records[1:13], start=1):
        ts = rec.get("timestamp", "")
        try:
            label = datetime.fromisoformat(str(ts)).strftime("%H:%M")
        except Exception:
            label = f"+{i}h"
        lines.append(
            f"  {label}  temp={rec.get('temperature_2m','?')}°C  "
            f"precip={rec.get('precipitation', 0)}mm  "
            f"wind={rec.get('wind_speed_10m','?')}km/h  "
            f"humidity={rec.get('relative_humidity_2m','?')}%"
        )

    return "\n".join(lines)


def _build_system_prompt(context: str) -> str:
    return f"""You are WeatherGPT, a concise and trustworthy weather assistant.

RULES — follow these STRICTLY:
1. Answer ONLY using the weather data provided below. Do NOT use any prior knowledge or training data about weather.
2. If the data does not contain enough information to answer, say so clearly. Do NOT fabricate values.
3. Keep answers short (2–4 sentences max). Be direct and specific — cite real numbers from the data.
4. Never say "I don't have real-time data" — you DO have real-time data (provided below).
5. If asked about activities (running, cycling, travel, etc.) use the data to give a concrete recommendation.

{context}

Answer the user's question using ONLY the data above."""


async def _call_ollama(system: str, user_message: str, model: str = DEFAULT_MODEL) -> str:
    """Call Ollama's local /api/chat endpoint and return the assistant reply."""
    payload = {
        "model": model,
        "stream": False,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user_message},
        ],
        "options": {
            "temperature": 0.2,   # low temperature = more factual
            "num_predict": 256,   # keep answers concise
        },
    }
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(f"{OLLAMA_BASE}/api/chat", json=payload)
        resp.raise_for_status()
        data = resp.json()
        return data["message"]["content"].strip()


async def _check_ollama_available(model: str = DEFAULT_MODEL) -> bool:
    """Check that Ollama is running and the model is loaded."""
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(f"{OLLAMA_BASE}/api/tags")
            if resp.status_code != 200:
                return False
            tags = resp.json().get("models", [])
            return any(m.get("name", "").startswith(model.split(":")[0]) for m in tags)
    except Exception:
        return False


@router.post("", response_model=ChatMessageResponse)
async def chat_interaction(payload: ChatMessageRequest) -> ChatMessageResponse:
    """RAG-grounded conversational weather assistant powered by Ollama (local LLM)."""
    lat = payload.lat or 40.7128
    lon = payload.lon or -74.0060

    # 1. RETRIEVE — fetch live forecast data
    try:
        records = await open_meteo_client.get_forecast(lat, lon, forecast_days=2)
    except Exception as exc:
        logger.error(f"Open-Meteo fetch failed: {exc}")
        records = []

    sources = [f"Open-Meteo Ensemble NWP · Lat {lat:.4f}, Lon {lon:.4f}"]

    # 2. AUGMENT — build the weather context block
    context = _build_weather_context(lat, lon, records)

    # 3. GENERATE — call Ollama with grounding prompt
    ollama_ok = await _check_ollama_available()

    if not ollama_ok:
        # Graceful fallback: keyword matching if Ollama is down
        logger.warning("Ollama unavailable — using keyword fallback")
        current = records[0] if records else {}
        temp = current.get("temperature_2m", "?")
        precip = current.get("precipitation", 0)
        wind = current.get("wind_speed_10m", "?")
        humidity = current.get("relative_humidity_2m", "?")
        q = payload.message.lower()
        if any(k in q for k in ["rain", "precip", "umbrella"]):
            answer = (f"Precipitation is {precip} mm/h. "
                      + ("Rain is detected — carry an umbrella." if precip > 0
                         else "No significant rain is currently forecast."))
        elif any(k in q for k in ["temp", "cold", "hot", "warm", "degree"]):
            answer = f"The temperature is {temp}°C with {humidity}% relative humidity."
        elif any(k in q for k in ["wind", "breeze", "gust"]):
            answer = f"Wind speed is {wind} km/h."
        else:
            answer = (f"Current conditions: {temp}°C, wind {wind} km/h, "
                      f"precipitation {precip} mm/h, humidity {humidity}%. "
                      f"(⚠ Ollama is not running — start it with `ollama serve` for full AI responses.)")
        return ChatMessageResponse(
            session_id=payload.session_id,
            answer=answer,
            sources=sources,
            confidence=0.75,
            is_fallback=True,
        )

    try:
        system_prompt = _build_system_prompt(context)
        answer = await _call_ollama(system_prompt, payload.message)
        return ChatMessageResponse(
            session_id=payload.session_id,
            answer=answer,
            sources=sources,
            confidence=0.95,
            is_fallback=False,
        )
    except Exception as exc:
        logger.error(f"Ollama call failed: {exc}")
        return ChatMessageResponse(
            session_id=payload.session_id,
            answer="I encountered an error querying the local AI model. Please ensure Ollama is running (`ollama serve`) and try again.",
            sources=[],
            confidence=0.0,
            is_fallback=True,
        )
