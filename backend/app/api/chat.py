"""
Chat API endpoints.

RAG-powered conversational weather assistant with live grounding and citations.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Any
from app.services.rag_service import RAGService
from app.services.weather import WeatherService

router = APIRouter()
rag_service = RAGService()
weather_service = WeatherService()


class ChatMessage(BaseModel):
    """A single chat message."""
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    """Incoming chat request with conversation history and optional location."""
    message: str
    history: list[ChatMessage] = []
    location: dict[str, Any] | None = None  # e.g., {"latitude": float, "longitude": float, "name": str}


class ChatResponse(BaseModel):
    """Chat response with source citations, grounding confidence, and location."""
    reply: str
    sources: list[dict[str, Any]] = []
    confidence: float = 1.0
    detected_location: dict[str, Any] | None = None


@router.post("/", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Send a message to the WeatherGPT chat assistant.

    Retrieves live atmospheric data for the active location or dynamic entity, applies RAG grounding,
    and returns a substantiated answer with source citations.
    """
    weather_context = None

    if request.location and "latitude" in request.location and "longitude" in request.location:
        lat = float(request.location["latitude"])
        lon = float(request.location["longitude"])
        try:
            curr = await weather_service.get_current_conditions(lat, lon)
            hourly = await weather_service.get_hourly_forecast(lat, lon, hours=24)
            weather_context = {
                "current": curr.get("current", {}),
                "hourly": hourly.get("hourly", []),
            }
        except Exception:
            pass

    history_payload = [{"role": m.role, "content": m.content} for m in request.history]

    result = await rag_service.answer_query(
        query=request.message,
        weather_context=weather_context,
        location=request.location,
        history=history_payload,
    )

    return ChatResponse(
        reply=result.get("reply", ""),
        sources=result.get("sources", []),
        confidence=result.get("confidence", 0.95),
        detected_location=result.get("detected_location"),
    )
