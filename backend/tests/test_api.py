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

    def test_route_corridor(self):
        """Route endpoint should interpolate and sample transit waypoints."""
        response = client.get(
            "/api/forecast/route",
            params={"origin": "London", "destination": "Oxford", "steps": 3},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert "data" in data
        assert "waypoints" in data["data"]
        assert len(data["data"]["waypoints"]) == 3

    def test_model_benchmarks(self):
        """Benchmarks endpoint should return model comparison and ablation metrics."""
        response = client.get("/api/forecast/benchmarks")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert "model_comparison" in data
        assert len(data["model_comparison"]) >= 4

    def test_route_corridor_with_transit_mode(self):
        """Route endpoint should support transit_mode and compute vehicle physics."""
        response = client.get(
            "/api/forecast/route",
            params={
                "origin": "Vimanapura",
                "destination": "Koramangala",
                "steps": 4,
                "transit_mode": "two_wheeler",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        r_data = data["data"]
        assert "transit_mode" in r_data
        assert "mode_guidance" in r_data
        assert "stopping_distance_penalty_pct" in r_data

    def test_air_quality_telemetry(self):
        """AQI endpoint should return PM2.5, PM10, AQI index, and health advisory."""
        response = client.get(
            "/api/forecast/aqi",
            params={"lat": 12.9716, "lon": 77.5946},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        aqi = data["data"]
        assert "aqi" in aqi
        assert "category" in aqi
        assert "pm2_5" in aqi
        assert "health_advisory" in aqi

    def test_bangalore_microclimates(self):
        """Bangalore microclimates endpoint should return all indexed zones with elevation & flood risk."""
        response = client.get("/api/forecast/bangalore/microclimates")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["count"] >= 20
        first = data["data"][0]
        assert "name" in first
        assert "elevation" in first
        assert "flood_risk" in first
        assert "aqi" in first


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

