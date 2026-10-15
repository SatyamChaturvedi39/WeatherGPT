"""
Tests for the forecast API endpoints.
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


class TestHealthCheck:
    """Tests for system health endpoints."""

    def test_health_check(self):
        """Health endpoint should return 200 with status healthy."""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["service"] == "WeatherGPT"

    def test_root_endpoint(self):
        """Root endpoint should return API info."""
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert "service" in data
        assert "version" in data
        assert "docs" in data


class TestForecastAPI:
    """Tests for forecast endpoints."""

    def test_geocode_search(self):
        """Geocode endpoint should return location results."""
        response = client.get("/api/forecast/geocode", params={"query": "London"})
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert len(data["results"]) > 0
        # First result should contain London
        assert "London" in data["results"][0]["name"]

    def test_current_weather(self):
        """Current weather endpoint should return conditions."""
        response = client.get(
            "/api/forecast/current",
            params={"lat": 51.5074, "lon": -0.1278},  # London
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert "current" in data["data"]
        assert "temperature_2m" in data["data"]["current"]

    def test_hourly_forecast(self):
        """Hourly forecast should return time-series data."""
        response = client.get(
            "/api/forecast/hourly",
            params={"lat": 51.5074, "lon": -0.1278, "hours": 24},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert len(data["data"]["hourly"]) > 0

    def test_daily_forecast(self):
        """Daily forecast should return multi-day data."""
        response = client.get(
            "/api/forecast/daily",
            params={"lat": 51.5074, "lon": -0.1278, "days": 3},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert len(data["data"]["daily"]) > 0

    def test_invalid_coordinates(self):
        """Should reject invalid latitude/longitude values."""
        response = client.get(
            "/api/forecast/current",
            params={"lat": 999, "lon": -0.1278},
        )
        assert response.status_code == 422  # Validation error

    def test_forecast_explain(self):
        """Explain endpoint should return TreeSHAP feature attributions."""
        response = client.get(
            "/api/forecast/explain",
            params={"lat": 51.5074, "lon": -0.1278},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert "features" in data
        assert len(data["features"]) > 0


class TestChatAPI:
    """Tests for chat endpoint."""

    def test_chat_grounded_response(self):
        """Chat endpoint should return a grounded response with confidence."""
        response = client.post(
            "/api/chat/",
            json={
                "message": "Will I need an umbrella today?",
                "location": {"latitude": 51.5074, "longitude": -0.1278, "name": "London"},
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert "reply" in data
        assert len(data["reply"]) > 0
        assert "confidence" in data
        assert data["confidence"] > 0


class TestAlertsAPI:
    """Tests for alerts endpoint."""

    def test_alerts_assessment(self):
        """Alerts endpoint should return evaluated alerts and summary."""
        response = client.get(
            "/api/alerts/",
            params={"lat": 51.5074, "lon": -0.1278},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert isinstance(data["alerts"], list)
        assert "summary" in data


class TestAdminAPI:
    """Tests for admin Data-Ops telemetry."""

    def test_admin_metrics(self):
        """Admin metrics should return operational status and services info."""
        response = client.get("/api/admin/metrics")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "operational"
        assert "services" in data
        assert "open_meteo_api" in data["services"]
        assert "ml_inference_engine" in data["services"]

