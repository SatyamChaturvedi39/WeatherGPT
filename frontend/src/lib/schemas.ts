import { z } from 'zod';

export const CurrentWeatherSchema = z.object({
  location_name: z.string().default('Unknown Location'),
  latitude: z.coerce.number().default(0),
  longitude: z.coerce.number().default(0),
  timestamp: z.string().default(() => new Date().toISOString()),
  temperature_2m: z.coerce.number().default(0),
  precipitation: z.coerce.number().default(0),
  relative_humidity_2m: z.coerce.number().default(0),
  pressure_msl: z.coerce.number().default(1013),
  wind_speed_10m: z.coerce.number().default(0),
  cloud_cover: z.coerce.number().default(0),
  is_anomaly: z.boolean().default(false),
  source: z.string().default('open-meteo'),
});

export const ForecastIntervalSchema = z.object({
  timestamp: z.string(),
  temp_p10: z.coerce.number(),
  temp_p50: z.coerce.number(),
  temp_p90: z.coerce.number(),
  precip_p10: z.coerce.number().default(0),
  precip_p50: z.coerce.number().default(0),
  precip_p90: z.coerce.number().default(0),
  precip_probability: z.coerce.number().default(0),
  wind_speed_10m: z.coerce.number().default(0),
  relative_humidity_2m: z.coerce.number().default(0),
  pressure_msl: z.coerce.number().default(1013),
});

export const ForecastResponseSchema = z.object({
  location_name: z.string().default(''),
  latitude: z.coerce.number().default(0),
  longitude: z.coerce.number().default(0),
  horizon_hours: z.coerce.number().default(72),
  model_name: z.string().default('Ensemble'),
  generated_at: z.string().default(() => new Date().toISOString()),
  intervals: z.array(ForecastIntervalSchema).default([]),
});

export const FeatureContributionSchema = z.object({
  feature: z.string().default(''),
  display_name: z.string().default(''),
  value: z.coerce.number().default(0),
  shap_value: z.coerce.number().default(0),
  impact: z.string().default('neutral'),
});

export const ExplainForecastResponseSchema = z.object({
  location_name: z.string().default(''),
  latitude: z.coerce.number().default(0),
  longitude: z.coerce.number().default(0),
  variable: z.string().default('temperature_2m'),
  horizon_hours: z.coerce.number().default(24),
  predicted_value: z.coerce.number().default(0),
  base_value: z.coerce.number().default(0),
  explanation_summary: z.string().default(''),
  top_contributions: z.array(FeatureContributionSchema).default([]),
});

export const AlertRiskResponseSchema = z.object({
  location_name: z.string().default(''),
  latitude: z.coerce.number().default(0),
  longitude: z.coerce.number().default(0),
  activity: z.string().default('general'),
  risk_level: z.enum(['Low', 'Moderate', 'High']).catch('Low'),
  risk_score: z.coerce.number().default(0),
  reason: z.string().default('Conditions are normal.'),
  contributing_factors: z.array(z.string()).default([]),
  is_anomaly: z.boolean().default(false),
  precipitation_probability: z.coerce.number().default(0),
  max_wind_speed: z.coerce.number().default(0),
  temp_range: z.array(z.coerce.number()).default([0, 0]),
  caution_widened: z.boolean().default(false),
});

export const SavedLocationSchema = z.object({
  id: z.number().optional(),
  name: z.string().default('Location'),
  latitude: z.coerce.number(),
  longitude: z.coerce.number(),
  timezone: z.string().default('UTC'),
  is_favorite: z.boolean().default(false),
});

export const PlatformSettingsSchema = z.object({
  units: z.object({
    temperature: z.enum(['celsius', 'fahrenheit']).default('celsius'),
    precipitation: z.enum(['mm', 'inch']).default('mm'),
  }).default({ temperature: 'celsius', precipitation: 'mm' }),
  active_activity: z.string().default('running'),
  available_activities: z.array(z.string()).default([
    'commuting', 'running', 'travel', 'outdoor_event', 'cycling', 'hiking'
  ]),
  saved_locations: z.array(SavedLocationSchema).default([]),
});

export const AdminStatusSchema = z.object({
  pipeline_health: z.object({
    status: z.enum(['healthy', 'degraded', 'failing']).catch('degraded'),
    database_connected: z.boolean().default(false),
    open_meteo_reachable: z.boolean().default(false),
    scheduler_active: z.boolean().default(false),
    issues: z.array(z.string()).default([]),
  }),
  ingestion: z.object({
    last_run_time: z.string().nullable().default(null),
    last_run_status: z.string().default('never_run'),
    last_rows_ingested: z.coerce.number().default(0),
    total_locations: z.coerce.number().default(0),
    total_observation_rows: z.coerce.number().default(0),
    scheduler_running: z.boolean().default(false),
  }),
  model_metrics: z.array(
    z.object({
      model_name: z.string().default(''),
      target: z.string().default(''),
      horizons: z.array(
        z.object({
          horizon_hours: z.coerce.number(),
          mae: z.coerce.number(),
          rmse: z.coerce.number(),
          crps: z.coerce.number().nullable().optional(),
          brier_score: z.coerce.number().nullable().optional(),
        })
      ).default([]),
      overall_mae: z.coerce.number().default(0),
      overall_rmse: z.coerce.number().default(0),
    })
  ).default([]),
  system_latency_ms: z.record(z.string(), z.coerce.number()).default({}),
  server_time: z.string().default(() => new Date().toISOString()),
});

export const ChatResponseSchema = z.object({
  session_id: z.string().default(''),
  answer: z.string().default(''),
  sources: z.array(z.string()).default([]),
  confidence: z.coerce.number().default(1),
  is_fallback: z.boolean().default(false),
});
