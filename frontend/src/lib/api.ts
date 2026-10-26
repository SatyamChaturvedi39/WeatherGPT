import {
  CurrentWeather,
  ForecastResponse,
  ExplainForecastResponse,
  AlertRiskResponse,
  PlatformSettings,
  AdminStatus,
  ChatResponse,
} from '../types';
import {
  CurrentWeatherSchema,
  ForecastResponseSchema,
  ExplainForecastResponseSchema,
  AlertRiskResponseSchema,
  PlatformSettingsSchema,
  AdminStatusSchema,
  ChatResponseSchema,
} from './schemas';

const API_BASE = '/api/v1';

async function fetchAndValidate<T>(
  url: string,
  schema: { parse: (val: unknown) => T },
  init?: RequestInit
): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({
      error: { code: 'HTTP_ERROR', message: `Request failed with status ${res.status}` },
    }));
    throw new Error(errorJson?.error?.message || `Request failed (${res.status})`);
  }
  const json = await res.json();
  try {
    return schema.parse(json);
  } catch (validationErr) {
    console.warn(`Validation fallback for ${url}:`, validationErr);
    // Parse through schema with safe defaults if unexpected shape
    return schema.parse({});
  }
}

export const api = {
  getCurrentWeather: (lat: number, lon: number): Promise<CurrentWeather> =>
    fetchAndValidate(`${API_BASE}/forecast/current?lat=${lat}&lon=${lon}`, CurrentWeatherSchema),

  getForecast: (lat: number, lon: number, horizon: number = 72): Promise<ForecastResponse> =>
    fetchAndValidate(`${API_BASE}/forecast?lat=${lat}&lon=${lon}&horizon=${horizon}`, ForecastResponseSchema),

  getExplainForecast: (
    lat: number,
    lon: number,
    variable: string = 'temperature_2m',
    horizon: number = 24
  ): Promise<ExplainForecastResponse> =>
    fetchAndValidate(
      `${API_BASE}/forecast/explain?lat=${lat}&lon=${lon}&variable=${variable}&horizon=${horizon}`,
      ExplainForecastResponseSchema
    ),

  getAlerts: (lat: number, lon: number, activity: string = 'running'): Promise<AlertRiskResponse> =>
    fetchAndValidate(`${API_BASE}/alerts?lat=${lat}&lon=${lon}&activity=${activity}`, AlertRiskResponseSchema),

  sendChatMessage: (payload: {
    session_id: string;
    message: string;
    lat?: number;
    lon?: number;
    activity?: string;
  }): Promise<ChatResponse> =>
    fetchAndValidate(
      `${API_BASE}/chat`,
      ChatResponseSchema,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    ),

  getSettings: (): Promise<PlatformSettings> =>
    fetchAndValidate(`${API_BASE}/settings`, PlatformSettingsSchema),

  updateSettings: (payload: Partial<PlatformSettings>): Promise<PlatformSettings> =>
    fetchAndValidate(
      `${API_BASE}/settings`,
      PlatformSettingsSchema,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    ),

  getAdminStatus: (): Promise<AdminStatus> =>
    fetchAndValidate(`${API_BASE}/admin/status`, AdminStatusSchema),
};
