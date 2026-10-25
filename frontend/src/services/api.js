/**
 * WeatherGPT API client.
 *
 * Centralizes all backend API calls with error handling.
 */

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

/**
 * Generic fetch wrapper with error handling.
 */
async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `API error: ${response.status}`);
  }

  return response.json();
}

// ── Forecast API ──────────────────────────────────────────────

export async function getCurrentWeather(lat, lon) {
  return apiFetch(`/api/forecast/current?lat=${lat}&lon=${lon}`);
}

export async function getHourlyForecast(lat, lon, hours = 48) {
  return apiFetch(`/api/forecast/hourly?lat=${lat}&lon=${lon}&hours=${hours}`);
}

export async function getDailyForecast(lat, lon, days = 7) {
  return apiFetch(`/api/forecast/daily?lat=${lat}&lon=${lon}&days=${days}`);
}

export async function geocodeLocation(query) {
  return apiFetch(`/api/forecast/geocode?query=${encodeURIComponent(query)}`);
}

// ── Explainability API ────────────────────────────────────────

export async function getExplainForecast(lat, lon) {
  return apiFetch(`/api/forecast/explain?lat=${lat}&lon=${lon}`);
}

export async function getMLPrediction(lat, lon) {
  return apiFetch(`/api/forecast/ml-prediction?lat=${lat}&lon=${lon}`);
}

export async function getRouteForecast(origin, destination, steps = 5, transitMode = "two_wheeler") {
  return apiFetch(`/api/forecast/route?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&steps=${steps}&transit_mode=${encodeURIComponent(transitMode)}`);
}

export async function getAirQuality(lat, lon) {
  return apiFetch(`/api/forecast/aqi?lat=${lat}&lon=${lon}`);
}

export async function getBangaloreMicroclimates() {
  return apiFetch(`/api/forecast/bangalore/microclimates`);
}

export async function getModelBenchmarks() {
  return apiFetch(`/api/forecast/benchmarks`);
}

// ── Alerts API ────────────────────────────────────────────────

export async function getAlerts(lat, lon) {
  return apiFetch(`/api/alerts/?lat=${lat}&lon=${lon}`);
}

export async function getAlertHistory(lat, lon, days = 7) {
  return apiFetch(`/api/alerts/history?lat=${lat}&lon=${lon}&days=${days}`);
}

// ── Chat API ──────────────────────────────────────────────────

export async function sendChatMessage(message, history = [], location = null) {
  return apiFetch("/api/chat/", {
    method: "POST",
    body: JSON.stringify({ message, history, location }),
  });
}

// ── Admin Telemetry API ───────────────────────────────────────

export async function getAdminMetrics() {
  return apiFetch("/api/admin/metrics");
}

// ── Health ────────────────────────────────────────────────────

export async function checkHealth() {
  return apiFetch("/health");
}

