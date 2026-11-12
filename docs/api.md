# WeatherGPT API Reference

All endpoints are hosted under `/api/v1` and auto-documented via Swagger UI at `/docs`.

## Endpoints

### 1. Health
`GET /api/v1/health`
Returns system status, active database state, and environment details.

### 2. Current Conditions
`GET /api/v1/forecast/current?lat={lat}&lon={lon}`
Returns observed temperature, precipitation, pressure, wind, and anomaly flags.

### 3. Forecast
`GET /api/v1/forecast?lat={lat}&lon={lon}&horizon={hours}`
Returns hourly forecast intervals with P10, P50, and P90 uncertainty bands and precipitation probability.

### 4. Forecast Explainability
`GET /api/v1/forecast/explain?lat={lat}&lon={lon}&variable={var}&horizon={hours}`
Returns top SHAP feature attributions and a natural-language explanation.

### 5. Risk Alerts
`GET /api/v1/alerts?lat={lat}&lon={lon}&activity={activity}`
Calculates 0-100 risk score, level (Low, Moderate, High), and contributing weather factors.

### 6. Grounded Chat
`POST /api/v1/chat`
Payload:
```json
{
  "session_id": "session-123",
  "message": "Is it safe to run outside?",
  "lat": 40.7128,
  "lon": -74.0060,
  "activity": "running"
}
```

### 7. Settings
- `GET /api/v1/settings`: Fetch user units, active activity, and saved locations.
- `PUT /api/v1/settings`: Update settings and synchronize locations.

### 8. Admin & Ops Status
`GET /api/v1/admin/status`
Returns ingestion logs, observation row counts, pipeline status, and model cross-validation benchmarks.
