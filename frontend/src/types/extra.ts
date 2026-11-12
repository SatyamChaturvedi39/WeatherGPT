/** Response types for the Feats-branch endpoints used by Route, Microclimates, Alerts, Benchmarks, AQI and ML pages. */

export interface RouteWaypoint {
  step: number;
  name: string;
  latitude: number;
  longitude: number;
  distance_km: number;
  temperature: number;
  precipitation: number;
  wind_speed: number;
  weather_code: number;
  hazard: string | null;
  eta_mins: number;
}

export interface RouteForecast {
  origin: string;
  destination: string;
  transit_type: string;
  transit_mode: string;
  total_distance_km: number;
  estimated_drive_mins: number;
  estimated_drive_hours: number;
  safety_score: number;
  safety_status: string;
  raincoat_needed: boolean;
  raincoat_advisory: string;
  stopping_distance_penalty_pct: number;
  mode_guidance: string;
  active_hazards: Array<Record<string, unknown> | string>;
  waypoints: RouteWaypoint[];
  contact_physics?: {
    dry_stopping_distance_m: number;
    wet_stopping_distance_m: number;
    increase_percentage: number;
    friction_dry: number;
    friction_wet: number;
    assumed_speed_kmh: number;
    reaction_time_seconds: number;
    reaction_distance_m: number;
    dry_braking_distance_m: number;
    wet_braking_distance_m: number;
    disclaimer: string;
  };
}

export interface Microclimate {
  id: string;
  name: string;
  zone: string;
  elevation: number;
  elevation_delta_m: number;
  temperature: number;
  humidity: number;
  precipitation_rate: number;
  rain_probability: number;
  condition: string;
  flood_risk: string;
  hazard_classification: string;
  chokepoints: string[];
  aqi: number;
  latitude: number;
  longitude: number;
  raincoat_recommended: boolean;
  scientific_provenance?: Record<string, unknown>;
}

export type Severity = 'EXTREME' | 'HIGH' | 'MODERATE' | 'LOW';

export interface WeatherAlert {
  id: string;
  severity: Severity;
  alert_type: string;
  title: string;
  description: string;
  recommendation: string;
  triggered_by: string;
  confidence: number;
  anomaly_score?: number;
}

export interface ActivitySuitability {
  name: string;
  score: number;
  status: string;
  advisories: string[];
}

export interface AlertsCenter {
  alerts: WeatherAlert[];
  summary: Record<Severity, number>;
  activity_suitability: Record<string, ActivitySuitability>;
  count: number;
}

export interface AlertHistoryItem {
  id: string;
  date: string;
  severity: Severity;
  title: string;
  description: string;
  last_seen: string;
  /** null while the alert is still active */
  resolved_at: string | null;
}

export interface AirQuality {
  aqi: number;
  category: string;
  color: string;
  pm2_5: number;
  pm10: number;
  nitrogen_dioxide: number;
  ozone: number;
  health_advisory: string;
  dominant_pollutant: string;
}

export interface MlPrediction {
  forecast_horizon: string;
  point_temperature_c: number;
  quantile_forecast_c: { p10: number; p50_median: number; p90: number; raw_interval_width_c: number };
  split_conformal_interval_80: {
    calibrated_lower_c: number;
    calibrated_upper_c: number;
    calibrated_empirical_coverage_pct: number;
    calibrated_interval_width_c: number;
  };
  precipitation_risk_24h: { rain_probability_pct: number; risk_category: string };
  is_fallback: boolean;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface Benchmarks {
  dataset_summary: Record<string, any>;
  temperature_forecasting_benchmark: Array<{
    horizon: string;
    persistence_mae: number;
    climatology_mae: number;
    xgboost_mae: number;
    persistence_rmse: number;
    climatology_rmse: number;
    xgboost_rmse: number;
    xgboost_gain_vs_persistence_pct: number;
    xgboost_gain_vs_climatology_pct: number;
  }>;
  precipitation_classification_benchmark: Record<string, any>;
  uncertainty_quantification: {
    nominal_interval: string;
    raw_quantile_regression: { empirical_coverage_pct: number; mean_interval_width_c: number };
    split_conformal_calibration: {
      calibrated_coverage_pct: number;
      calibrated_mean_interval_width_c: number;
      conformal_adjustment_margin_c: number;
      nominal_coverage_target_pct: number;
    };
  };
  calibration_curve: Array<{ nominal_quantile: number; empirical_coverage: number; pinball_loss: number }>;
  ablation_study: Array<{ configuration: string; features_count: number; mae_1h: number; mae_6h: number; mae_24h: number; improvement: string }>;
  top_shap_features: Array<{ feature: string; mean_abs_shap: number }>;
  model_comparison: Array<Record<string, any>>;
  scientific_notes?: Record<string, string>;
}

export type FloodLevel = 'Clear' | 'Watch' | 'Warning' | 'Severe';

export interface FloodTimelinePoint {
  time: string;
  rain_forecast_mm: number;
  rain_probability: number;
  rain_sampled_mean_mm: number;
  p_waterlog: number;
  p_severe: number;
  depth_cm: { p10: number; p50: number; p90: number };
  level: FloodLevel;
  p_waterlog_uncorrected?: number;
}

export interface FloodZone {
  id: string;
  name: string;
  zone: string;
  latitude: number;
  longitude: number;
  elevation: number;
  vulnerability: string;
  hydrology: { drain_capacity_mm_h: number; runoff_coefficient: number; basin_inflow_factor: number };
  correction: { rain_bias: number; initial_storage_mm: number; n_reports: number };
  timeline: FloodTimelinePoint[];
  peak: { time: string; p_waterlog: number; level: FloodLevel };
}

export interface FloodTwin {
  zones: FloodZone[];
  city_timeline: Array<{ time: string; zones_watch: number; zones_warning: number; zones_severe: number }>;
  parameters: Record<string, any>;
  is_simulation: boolean;
  crowd: { reports_in_window: number; window_hours: number; zones_corrected: number };
  source: Record<string, string>;
}

export type CrowdReportType = 'dry' | 'raining' | 'heavy_rain' | 'waterlogged';

export interface CrowdReport {
  id: string;
  zone_id: string;
  zone_name: string;
  report_type: CrowdReportType;
  created_at: number;
}
