/**
 * API client — adapter layer.
 *
 * The backend (from the `Feats` branch) exposes routes under `/api/*` with its
 * own response shapes. This module calls those routes and maps each response
 * into the shapes the frontend's zod schemas expect, so pages and hooks stay
 * unchanged.
 *
 * Settings (units, active activity, saved locations) are persisted in
 * localStorage, because the backend's `/api/settings` only echoes defaults.
 */
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
import type {
  RouteForecast,
  Microclimate,
  AlertsCenter,
  AlertHistoryItem,
  AirQuality,
  MlPrediction,
  Benchmarks,
  FloodTwin,
  CrowdReport,
  CrowdReportType,
} from '../types/extra';

const API_BASE = '/api';

// ─── helpers ────────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any;

async function getJson(url: string, init?: RequestInit): Promise<Json> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const msg = body?.detail || body?.error?.message || `Request failed (${res.status})`;
    throw new Error(typeof msg === 'string' ? msg : `Request failed (${res.status})`);
  }
  return res.json();
}

function safeParse<T>(schema: { parse: (v: unknown) => T }, value: unknown, label: string): T {
  try {
    return schema.parse(value);
  } catch (err) {
    console.warn(`Validation fallback for ${label}:`, err);
    return schema.parse({});
  }
}

/** Anonymous per-browser id, used only for report rate limiting. */
function crowdClientId(): string {
  const key = 'weathergpt.crowdClientId';
  try {
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(key, id);
    return id;
  } catch {
    return `anon-${Math.random().toString(36).slice(2, 12)}`;
  }
}

const q = (lat: number, lon: number) => `lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`;

// ─── activity mapping ──────────────────────────────────────────────────────
// Backend activity_suitability keys. Frontend activity names that the backend
// does not score fall back to the closest backend profile.
export const BACKEND_ACTIVITIES = ['commuting', 'running', 'aviation_drone', 'construction'] as const;

const ACTIVITY_ALIASES: Record<string, string> = {
  travel: 'commuting',
  cycling: 'running',
  hiking: 'running',
  outdoor_event: 'construction',
  drone: 'aviation_drone',
};

function resolveActivity(activity: string, available: Record<string, unknown>): string {
  if (activity in available) return activity;
  const alias = ACTIVITY_ALIASES[activity];
  if (alias && alias in available) return alias;
  return Object.keys(available)[0] ?? activity;
}

// ─── settings (localStorage) ───────────────────────────────────────────────
const SETTINGS_KEY = 'weathergpt.settings.v1';

function loadSettings(): PlatformSettings {
  let stored: unknown = {};
  try {
    stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
  } catch {
    stored = {};
  }
  const parsed = safeParse(PlatformSettingsSchema, stored, 'settings');
  return { ...parsed, available_activities: [...BACKEND_ACTIVITIES] };
}

function saveSettings(s: PlatformSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable — keep in memory only */
  }
}

// ─── API ────────────────────────────────────────────────────────────────────
export const api = {
  getCurrentWeather: async (lat: number, lon: number): Promise<CurrentWeather> => {
    const json = await getJson(`${API_BASE}/forecast/current?${q(lat, lon)}`);
    const d = json?.data ?? {};
    const c = d.current ?? {};
    return safeParse(
      CurrentWeatherSchema,
      {
        location_name: d.location_name ?? '',
        latitude: d.location?.latitude ?? lat,
        longitude: d.location?.longitude ?? lon,
        timestamp: c.time ?? d.timestamp,
        temperature_2m: c.temperature_2m,
        apparent_temperature: c.apparent_temperature,
        precipitation: c.precipitation,
        relative_humidity_2m: c.relative_humidity_2m,
        pressure_msl: c.pressure_msl ?? c.surface_pressure,
        wind_speed_10m: c.wind_speed_10m,
        cloud_cover: c.cloud_cover,
        weather_code: c.weather_code,
        is_day: c.is_day,
        is_anomaly: false,
        source: 'open-meteo',
      },
      'current'
    );
  },

  getForecast: async (lat: number, lon: number, horizon: number = 72): Promise<ForecastResponse> => {
    const hours = Math.min(Math.max(horizon, 1), 168);
    const json = await getJson(`${API_BASE}/forecast/hourly?${q(lat, lon)}&hours=${hours}`);
    const points: Json[] = json?.data?.hourly ?? [];
    return safeParse(
      ForecastResponseSchema,
      {
        latitude: json?.data?.location?.latitude ?? lat,
        longitude: json?.data?.location?.longitude ?? lon,
        horizon_hours: hours,
        model_name: 'Open-Meteo NWP + calibrated interval',
        generated_at: new Date().toISOString(),
        intervals: points.map((p) => {
          const t = p.temperature_2m ?? 0;
          const precip = p.precipitation ?? 0;
          return {
            timestamp: p.time,
            temp_p10: p.temperature_lower ?? p.temp_lower_80 ?? t,
            temp_p50: t,
            temp_p90: p.temperature_upper ?? p.temp_upper_80 ?? t,
            precip_p10: 0,
            precip_p50: precip,
            precip_p90: precip * 1.5,
            precip_probability: (p.precipitation_probability ?? 0) / 100,
            wind_speed_10m: p.wind_speed_10m ?? 0,
            relative_humidity_2m: p.relative_humidity_2m ?? 0,
            pressure_msl: p.pressure_msl ?? 1013,
          };
        }),
      },
      'forecast'
    );
  },

  getExplainForecast: async (
    lat: number,
    lon: number,
    variable: string = 'temperature_2m',
    horizon: number = 24
  ): Promise<ExplainForecastResponse> => {
    const json = await getJson(`${API_BASE}/forecast/explain?${q(lat, lon)}`);
    const features: Json[] = json?.features ?? [];
    const top = features[0];
    return safeParse(
      ExplainForecastResponseSchema,
      {
        latitude: lat,
        longitude: lon,
        variable,
        horizon_hours: horizon,
        predicted_value: json?.predicted_value,
        base_value: json?.base_value,
        explanation_summary:
          json?.scientific_disclaimer ??
          (top ? `${top.feature} ${top.direction} the forecast most (${json?.model ?? 'model'}).` : ''),
        top_contributions: features.map((f) => ({
          feature: f.feature,
          display_name: f.feature,
          value: f.value ?? f.importance ?? 0,
          shap_value: f.shap_value ?? 0,
          impact: f.direction === 'decreases' ? 'negative' : 'positive',
        })),
      },
      'explain'
    );
  },

  getAlerts: async (lat: number, lon: number, activity: string = 'running'): Promise<AlertRiskResponse> => {
    const [alertsJson, hourlyJson] = await Promise.all([
      getJson(`${API_BASE}/alerts/?${q(lat, lon)}`),
      getJson(`${API_BASE}/forecast/hourly?${q(lat, lon)}&hours=24`).catch(() => null),
    ]);
    const suit: Record<string, Json> = alertsJson?.activity_suitability ?? {};
    const key = resolveActivity(activity, suit);
    const a = suit[key] ?? {};
    const score = Number(a.score ?? 100);
    const riskScore = Math.max(0, Math.min(100, 100 - score));
    const alerts: Json[] = alertsJson?.alerts ?? [];
    const serious = alerts.filter((x) => x.severity && x.severity !== 'LOW');
    const worst = serious.find((x) => x.severity === 'EXTREME' || x.severity === 'HIGH');

    let level: 'Low' | 'Moderate' | 'High' = score >= 70 ? 'Low' : score >= 40 ? 'Moderate' : 'High';
    if (worst) level = 'High';
    else if (serious.length && level === 'Low') level = 'Moderate';

    const hours: Json[] = hourlyJson?.data?.hourly ?? [];
    const temps = hours.map((h) => h.temperature_2m).filter((v) => typeof v === 'number');
    const winds = hours.map((h) => h.wind_speed_10m ?? 0);
    const probs = hours.map((h) => h.precipitation_probability ?? 0);

    return safeParse(
      AlertRiskResponseSchema,
      {
        latitude: lat,
        longitude: lon,
        activity: key,
        risk_level: level,
        risk_score: riskScore,
        reason: worst?.description ?? (a.advisories?.[0] || alerts[0]?.description || 'Conditions are normal.'),
        contributing_factors: [
          ...(a.advisories ?? []),
          ...serious.map((x) => `${x.severity}: ${x.title}`),
        ],
        is_anomaly: alerts.some((x) => (x.anomaly_score ?? 0) > 0.5),
        precipitation_probability: probs.length ? Math.max(...probs) / 100 : 0,
        max_wind_speed: winds.length ? Math.max(...winds) : 0,
        temp_range: temps.length ? [Math.min(...temps), Math.max(...temps)] : [0, 0],
        caution_widened: serious.length > 0,
      },
      'alerts'
    );
  },

  sendChatMessage: async (payload: {
    session_id: string;
    message: string;
    lat?: number;
    lon?: number;
    activity?: string;
    location_name?: string;
  }): Promise<ChatResponse> => {
    const json = await getJson(`${API_BASE}/chat/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: payload.message,
        history: [],
        location:
          payload.lat != null && payload.lon != null
            ? { latitude: payload.lat, longitude: payload.lon, name: payload.location_name }
            : null,
      }),
    });
    const sources: Json[] = json?.sources ?? [];
    return safeParse(
      ChatResponseSchema,
      {
        session_id: payload.session_id,
        answer: json?.reply ?? json?.answer ?? '',
        sources: sources.map((s) => (typeof s === 'string' ? s : s.title || s.source || 'source')),
        confidence: json?.confidence,
        is_fallback: false,
      },
      'chat'
    );
  },

  getSettings: async (): Promise<PlatformSettings> => loadSettings(),

  updateSettings: async (payload: Partial<PlatformSettings>): Promise<PlatformSettings> => {
    const next = { ...loadSettings(), ...payload };
    saveSettings(next);
    return next;
  },

  getAdminStatus: async (): Promise<AdminStatus> => {
    const started = performance.now();
    const json = await getJson(`${API_BASE}/admin/metrics`);
    const totalMs = performance.now() - started;
    const svc = json?.services ?? {};
    const om = svc.open_meteo_api ?? {};
    const db = svc.database ?? {};
    const models: Json[] = svc.ml_inference_engine?.models ?? [];
    const operational = json?.status === 'operational';
    const issues: string[] = [];
    if (db.status !== 'active') issues.push('Database not active');
    if (om.status !== 'healthy') issues.push('Open-Meteo API degraded');
    return safeParse(
      AdminStatusSchema,
      {
        pipeline_health: {
          status: operational && !issues.length ? 'healthy' : operational ? 'degraded' : 'failing',
          database_connected: db.status === 'active',
          open_meteo_reachable: om.status === 'healthy',
          scheduler_active: operational,
          issues,
        },
        ingestion: {
          last_run_time: json?.timestamp ?? null,
          last_run_status: om.status ?? 'unknown',
          last_rows_ingested: om.calls_today ?? 0,
          total_locations: 25,
          total_observation_rows: db.observations_stored ?? 0,
          scheduler_running: operational,
        },
        model_metrics: models
          .filter((m) => m.mae_temperature)
          .map((m) => {
            const mae = parseFloat(String(m.mae_temperature)) || 0;
            return {
              model_name: `${m.name} ${m.version ?? ''}`.trim(),
              target: m.task ?? '',
              horizons: [],
              overall_mae: mae,
              overall_rmse: mae,
            };
          }),
        system_latency_ms: {
          total_admin_ms: Math.round(totalMs * 10) / 10,
          open_meteo_probe_ms: om.avg_latency_ms ?? 0,
          db_query_ms: 0,
        },
        server_time: json?.timestamp,
      },
      'admin'
    );
  },

  // ─── Feats-branch features (passed through with light unwrapping) ──────
  getRoute: async (origin: string, destination: string, mode = 'two_wheeler', steps = 6): Promise<RouteForecast> => {
    const json = await getJson(
      `${API_BASE}/forecast/route?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&steps=${steps}&transit_mode=${encodeURIComponent(mode)}`
    );
    return json.data;
  },

  getMicroclimates: async (): Promise<Microclimate[]> => {
    const json = await getJson(`${API_BASE}/forecast/bangalore/microclimates`);
    return json.data ?? [];
  },

  getAlertsCenter: async (lat: number, lon: number): Promise<AlertsCenter> => {
    const json = await getJson(`${API_BASE}/alerts/?${q(lat, lon)}`);
    return {
      alerts: json.alerts ?? [],
      summary: json.summary ?? { EXTREME: 0, HIGH: 0, MODERATE: 0, LOW: 0 },
      activity_suitability: json.activity_suitability ?? {},
      count: json.count ?? 0,
    };
  },

  getAlertHistory: async (lat: number, lon: number, days = 7): Promise<AlertHistoryItem[]> => {
    const json = await getJson(`${API_BASE}/alerts/history?${q(lat, lon)}&days=${days}`);
    return json.history ?? [];
  },

  getAirQuality: async (lat: number, lon: number): Promise<AirQuality> => {
    const json = await getJson(`${API_BASE}/forecast/aqi?${q(lat, lon)}`);
    return json.data;
  },

  getMlPrediction: async (lat: number, lon: number): Promise<MlPrediction> =>
    getJson(`${API_BASE}/forecast/ml-prediction?${q(lat, lon)}`),

  getBenchmarks: async (): Promise<Benchmarks> => getJson(`${API_BASE}/forecast/benchmarks`),

  getFloodTwin: async (hours = 6, scenarioMm = 0): Promise<FloodTwin> => {
    const json = await getJson(`${API_BASE}/flood/twin?hours=${hours}&scenario_mm=${scenarioMm}`);
    return json.data;
  },

  getFloodReports: async (): Promise<CrowdReport[]> => {
    const json = await getJson(`${API_BASE}/flood/reports`);
    return json.reports ?? [];
  },

  submitFloodReport: async (
    reportType: CrowdReportType,
    where: { zoneId: string } | { lat: number; lon: number }
  ): Promise<CrowdReport> => {
    const body = {
      report_type: reportType,
      client_id: crowdClientId(),
      ...('zoneId' in where ? { zone_id: where.zoneId } : { latitude: where.lat, longitude: where.lon }),
    };
    const json = await getJson(`${API_BASE}/flood/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return json.report;
  },
};
