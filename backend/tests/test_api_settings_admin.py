"""Tests for settings, admin endpoints, and standardized error responses."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_get_and_put_settings(client: AsyncClient):
    # GET settings
    get_res = await client.get("/api/v1/settings")
    assert get_res.status_code == 200
    data = get_res.json()
    assert data["units"]["temperature"] in ["celsius", "fahrenheit"]
    assert "running" in data["available_activities"]

    # PUT settings
    put_res = await client.put(
        "/api/v1/settings",
        json={
            "units": {"temperature": "fahrenheit", "precipitation": "inch"},
            "active_activity": "hiking",
            "saved_locations": [
                {
                    "name": "Denver",
                    "latitude": 39.7392,
                    "longitude": -104.9903,
                    "is_favorite": True,
                }
            ],
        },
    )
    assert put_res.status_code == 200
    updated = put_res.json()
    assert updated["units"]["temperature"] == "fahrenheit"
    assert updated["active_activity"] == "hiking"
    assert len(updated["saved_locations"]) >= 1
    assert any(loc["name"] == "Denver" for loc in updated["saved_locations"])


@pytest.mark.asyncio
async def test_admin_status_endpoint(client: AsyncClient):
    res = await client.get("/api/v1/admin/status")
    assert res.status_code == 200
    data = res.json()
    assert "pipeline_health" in data
    assert "ingestion" in data
    assert "model_metrics" in data
    assert len(data["model_metrics"]) >= 1
    assert "system_latency_ms" in data


@pytest.mark.asyncio
async def test_consistent_validation_error_schema(client: AsyncClient):
    # Pass invalid latitude > 90
    res = await client.get("/api/v1/forecast/current?lat=999.0&lon=0.0")
    assert res.status_code == 422
    err_body = res.json()
    assert "error" in err_body
    assert err_body["error"]["code"] == "VALIDATION_ERROR"
    assert "lat" in err_body["error"]["message"].lower() or "latitude" in err_body["error"]["message"].lower()
