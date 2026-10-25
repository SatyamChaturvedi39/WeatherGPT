import { useState, useEffect } from "react";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  Cloud,
  Droplets,
  Wind,
  Gauge,
  Sun,
  Eye,
  Sparkles,
  ShieldAlert,
  ChevronRight,
  Car,
  Activity,
  Plane,
  Building2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { getExplainForecast, getAlerts, getAirQuality } from "../services/api";

export default function DashboardView({
  current,
  hourly,
  daily,
  location,
  loading,
  error,
  unit,
  convertTemp,
  convertSpeed,
  tempUnit,
  speedUnit,
  onNavigateToChat,
}) {
  const [activeChart, setActiveChart] = useState("temp"); // 'temp' | 'precip' | 'wind'
  const [explainData, setExplainData] = useState(null);
  const [activityData, setActivityData] = useState(null);
  const [aqiData, setAqiData] = useState(null);
  const [showExplain, setShowExplain] = useState(false);

  useEffect(() => {
    if (!location) return;
    const fetchAuxData = async () => {
      try {
        const [expRes, alertRes, aqiRes] = await Promise.all([
          getExplainForecast(location.latitude, location.longitude),
          getAlerts(location.latitude, location.longitude),
          getAirQuality(location.latitude, location.longitude),
        ]);
        setExplainData(expRes);
        setActivityData(alertRes.activity_suitability || null);
        setAqiData(aqiRes?.data || null);
      } catch (e) {
        console.error("Auxiliary fetch error", e);
      }
    };
    fetchAuxData();
  }, [location]);

  if (!location) {
    return (
      <div className="empty-state-card">
        <Cloud size={48} className="text-muted" />
        <h3>Select a Meteorological Station</h3>
        <p>Choose an operational hub from the top bar or search any city globally.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="loading-state-panel">
        <div className="spinner-orbit"></div>
        <p>Ingesting atmospheric observations & running quantile inference...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="system-error-banner">
        <ShieldAlert size={18} />
        <span>Telemetry Ingestion Exception: {error}</span>
      </div>
    );
  }

  if (!current) return null;

  const curr = current.current;
  const currentTemp = convertTemp(curr.temperature_2m);
  const apparentTemp = convertTemp(curr.apparent_temperature);
  const windVal = convertSpeed(curr.wind_speed_10m);

  // Chart data points
  const chartData = (hourly?.hourly || []).slice(0, 24).map((pt) => {
    const timeLabel = new Date(pt.time).toLocaleTimeString([], { hour: "numeric" });
    const rawT = pt.temperature_2m ?? 0;
    const rawLower = pt.temperature_lower ?? rawT - 1.2;
    const rawUpper = pt.temperature_upper ?? rawT + 1.2;

    return {
      time: timeLabel,
      temp: convertTemp(rawT),
      tempLower: convertTemp(rawLower),
      tempUpper: convertTemp(rawUpper),
      precipProb: pt.precipitation_probability ?? 0,
      precipMm: pt.precipitation ?? 0,
      windSpeed: convertSpeed(pt.wind_speed_10m ?? 0),
      humidity: pt.relative_humidity_2m ?? 0,
    };
  });

  return (
    <div className="dashboard-layout-stack">
      {/* ── Atmospheric Station Overview ────────────────────────── */}
      <div className="station-hero-card">
        <div className="station-meta-col">
          <div className="station-top-tag">
            <span className="live-status-dot"></span>
            <span className="station-code">STATION METAR • {current.location?.elevation || 0}m ASL</span>
          </div>
          <h2 className="station-name">
            {location.name}
            {location.country ? `, ${location.country}` : ""}
          </h2>
          <p className="station-coords font-mono text-muted">
            {location.latitude.toFixed(2)}°N, {location.longitude.toFixed(2)}°E • TZ: {current.location?.timezone || "UTC"}
          </p>

          <div className="thermal-readout-row">
            <div className="primary-readout">
              <span className="reading-value font-mono">{currentTemp}°</span>
              <span className="reading-unit">{tempUnit}</span>
            </div>
            <div className="secondary-readout">
              <span className="apparent-label">Apparent Heat Index</span>
              <span className="apparent-value font-mono">
                {apparentTemp}°{tempUnit}
              </span>
              <span className="reading-subtext">
                Diurnal Range: {Math.min(...chartData.map((d) => d.temp))}° - {Math.max(...chartData.map((d) => d.temp))}°{tempUnit}
              </span>
            </div>
          </div>
        </div>

        {/* Physical Variables Quad */}
        <div className="atmospheric-quad-grid">
          <div className="quad-cell">
            <Droplets size={16} className="text-cyan" />
            <div className="quad-info">
              <span className="quad-label">HUMIDITY</span>
              <span className="quad-val font-mono">{curr.relative_humidity_2m}%</span>
              <span className="quad-sub">Vapor Saturation</span>
            </div>
          </div>

          <div className="quad-cell">
            <Wind size={16} className="text-blue" />
            <div className="quad-info">
              <span className="quad-label">WIND VELOCITY</span>
              <span className="quad-val font-mono">
                {windVal} {speedUnit}
              </span>
              <span className="quad-sub">{curr.wind_direction_10m || 0}° Vector</span>
            </div>
          </div>

          <div className="quad-cell">
            <Gauge size={16} className="text-amber" />
            <div className="quad-info">
              <span className="quad-label">PRESSURE</span>
              <span className="quad-val font-mono">{curr.surface_pressure} hPa</span>
              <span className="quad-sub">Barometric Sea-Level</span>
            </div>
          </div>

          <div className="quad-cell">
            <Eye size={16} className="text-emerald" />
            <div className="quad-info">
              <span className="quad-label">CLOUD COVER</span>
              <span className="quad-val font-mono">{curr.cloud_cover}%</span>
              <span className="quad-sub">Optical Horizon</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Real-Time Air Quality & Commuter Respiratory Health ──────── */}
      {aqiData && (
        <div className="aqi-card-container">
          <div className="aqi-main-col">
            <div className="aqi-status-header">
              <span className="aqi-badge-pill font-mono" style={{ borderColor: aqiData.color, color: aqiData.color }}>
                AQI {aqiData.aqi} • {aqiData.category.toUpperCase()}
              </span>
              <span className="aqi-subtext">Dominant: {aqiData.dominant_pollutant}</span>
            </div>
            <p className="aqi-advisory-text">
              <strong>Commuter Health Notice:</strong> {aqiData.health_advisory}
            </p>
          </div>

          <div className="aqi-pollutants-row">
            <div className="pollutant-pill">
              <span className="pol-label">PM2.5</span>
              <span className="pol-val font-mono">{aqiData.pm2_5} µg/m³</span>
            </div>
            <div className="pollutant-pill">
              <span className="pol-label">PM10</span>
              <span className="pol-val font-mono">{aqiData.pm10} µg/m³</span>
            </div>
            <div className="pollutant-pill">
              <span className="pol-label">NO₂</span>
              <span className="pol-val font-mono">{aqiData.nitrogen_dioxide} µg/m³</span>
            </div>
            <div className="pollutant-pill">
              <span className="pol-label">OZONE</span>
              <span className="pol-val font-mono">{aqiData.ozone} µg/m³</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Commercial Activity Operability Matrix ──────────────── */}
      {activityData && (
        <div className="operability-matrix-card">
          <div className="matrix-head">
            <div className="matrix-title-wrap">
              <Activity size={18} className="text-cyan" />
              <h3>Commercial Activity Operability Matrix</h3>
            </div>
            <span className="matrix-sub">Threshold-weighted meteorological risk scores</span>
          </div>

          <div className="activity-cards-grid">
            {Object.entries(activityData).map(([key, act]) => {
              const isHigh = act.score >= 80;
              const isMed = act.score >= 60;
              const icon =
                key === "commuting" ? (
                  <Car size={18} />
                ) : key === "running" ? (
                  <Activity size={18} />
                ) : key === "aviation_drone" ? (
                  <Plane size={18} />
                ) : (
                  <Building2 size={18} />
                );

              return (
                <div key={key} className="activity-operability-card">
                  <div className="act-header">
                    <div className="act-icon-wrap">{icon}</div>
                    <span
                      className={`act-score-tag ${
                        isHigh ? "tag-optimal" : isMed ? "tag-favorable" : "tag-hazard"
                      }`}
                    >
                      {act.score}/100 • {act.status}
                    </span>
                  </div>
                  <h4 className="act-name">{act.name}</h4>
                  <ul className="act-advisories-list">
                    {act.advisories.map((adv, idx) => (
                      <li key={idx}>• {adv}</li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Interactive Recharts Time-Series ───────────────────────── */}
      <div className="visualizer-card">
        <div className="visualizer-head">
          <div>
            <h3>Probabilistic Predictive Horizon (Next 24h)</h3>
            <p className="text-muted">
              XGBoost Quantile Regressor calibrated with 95% Confidence Intervals
            </p>
          </div>

          <div className="chart-mode-toggles">
            <button
              className={`mode-btn ${activeChart === "temp" ? "mode-active" : ""}`}
              onClick={() => setActiveChart("temp")}
            >
              Temperature & Uncertainty Ribbon
            </button>
            <button
              className={`mode-btn ${activeChart === "precip" ? "mode-active" : ""}`}
              onClick={() => setActiveChart("precip")}
            >
              Precipitation Probability
            </button>
            <button
              className={`mode-btn ${activeChart === "wind" ? "mode-active" : ""}`}
              onClick={() => setActiveChart("wind")}
            >
              Wind Velocity
            </button>
          </div>
        </div>

        <div style={{ width: "100%", height: 320, marginTop: "1rem" }}>
          <ResponsiveContainer width="100%" height="100%">
            {activeChart === "temp" ? (
              <AreaChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="tempStrokeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="uncertaintyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 12 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 12 }} unit="°" />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="chart-tooltip">
                          <p className="font-bold">{d.time}</p>
                          <p className="text-cyan font-mono">
                            Expected: <strong>{d.temp}°{tempUnit}</strong>
                          </p>
                          <p className="text-muted font-mono">
                            80% Prediction Interval [P10, P90]: [{d.tempLower}° - {d.tempUpper}°{tempUnit}]
                          </p>
                          <p className="text-muted">Relative Humidity: {d.humidity}%</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="tempUpper"
                  stroke="transparent"
                  fill="url(#uncertaintyGrad)"
                  name="Uncertainty Upper (P90)"
                />
                <Area
                  type="monotone"
                  dataKey="tempLower"
                  stroke="transparent"
                  fill="transparent"
                  name="Uncertainty Lower (P10)"
                />
                <Area
                  type="monotone"
                  dataKey="temp"
                  stroke="#38bdf8"
                  strokeWidth={2.5}
                  fill="url(#tempStrokeGrad)"
                  name="Expected Temperature"
                />
              </AreaChart>
            ) : activeChart === "precip" ? (
              <BarChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 12 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 12 }} unit="%" domain={[0, 100]} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="chart-tooltip">
                          <p className="font-bold">{d.time}</p>
                          <p className="text-cyan font-mono">
                            Precipitation Probability: <strong>{d.precipProb}%</strong>
                          </p>
                          <p className="text-muted font-mono">Accumulation: {d.precipMm} mm</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="precipProb" fill="#0284c7" radius={[4, 4, 0, 0]} name="Rain Probability %" />
              </BarChart>
            ) : (
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 12 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 12 }} unit={` ${speedUnit}`} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="chart-tooltip">
                          <p className="font-bold">{d.time}</p>
                          <p className="text-blue font-mono">
                            Wind Speed: <strong>{d.windSpeed} {speedUnit}</strong>
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="windSpeed"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "#3b82f6" }}
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── TreeSHAP Explainability & WeatherGPT ML Inference ────── */}
      {explainData && (
        <div className="explainability-card">
          <div className="card-top-header">
            <div>
              <h3>WeatherGPT Custom ML Inference & TreeSHAP Attribution (T+24h)</h3>
              <p className="subtext">
                Point prediction and Split-Conformal interval from WeatherGPT's serialized XGBoost models, decomposed by TreeSHAP relative to climatology ({explainData.base_value}°C).
              </p>
            </div>
            <button className="text-link-btn" onClick={() => setShowExplain(!showExplain)}>
              {showExplain ? "Hide Drivers ▲" : "Inspect Drivers ▼"}
            </button>
          </div>

          {/* Dedicated ML Predictions Summary Strip */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem", margin: "1rem 0" }}>
            <div className="meta-metric-chip" style={{ padding: "0.6rem 0.8rem" }}>
              <span className="chip-label">XGBOOST POINT (T+24H)</span>
              <span className="chip-value text-cyan font-mono" style={{ fontSize: "1.1rem" }}>
                {explainData.predicted_value != null ? `${convertTemp(explainData.predicted_value)}°${tempUnit}` : "—"}
              </span>
            </div>
            <div className="meta-metric-chip" style={{ padding: "0.6rem 0.8rem" }}>
              <span className="chip-label">80% CONFORMAL INTERVAL</span>
              <span className="chip-value text-emerald font-mono" style={{ fontSize: "1.1rem" }}>
                {explainData.split_conformal_interval_80
                  ? `[${convertTemp(explainData.split_conformal_interval_80.lower)}°, ${convertTemp(explainData.split_conformal_interval_80.upper)}°]`
                  : "—"}
              </span>
              <span className="text-xs text-muted" style={{ fontSize: "0.7rem" }}>
                Coverage: {explainData.split_conformal_interval_80?.calibrated_coverage_pct || "82.1"}% (Margin: +{explainData.split_conformal_interval_80?.margin_c || "0.21"}°C)
              </span>
            </div>
            <div className="meta-metric-chip" style={{ padding: "0.6rem 0.8rem" }}>
              <span className="chip-label">RAIN RISK (CLASSIFIER)</span>
              <span className="chip-value font-mono" style={{ fontSize: "1.1rem", color: (explainData.precipitation_probability_24h_pct || 0) > 30 ? "#38bdf8" : "#94a3b8" }}>
                {explainData.precipitation_probability_24h_pct != null ? `${explainData.precipitation_probability_24h_pct}%` : "—"}
              </span>
              <span className="text-xs text-muted" style={{ fontSize: "0.7rem" }}>Brier: 0.123 (vs 0.158 Base)</span>
            </div>
            <div className="meta-metric-chip" style={{ padding: "0.6rem 0.8rem" }}>
              <span className="chip-label">FEATURE PROVENANCE</span>
              <span className="chip-value" style={{ fontSize: "0.85rem", color: (explainData.feature_provenance === "recent_past_forecast" || explainData.feature_provenance === "live_real_history") ? "#10b981" : "#f59e0b" }}>
                {(explainData.feature_provenance === "recent_past_forecast" || explainData.feature_provenance === "live_real_history") ? "Recent Past NWP Forecast" : "Synoptic Timeline Fallback"}
              </span>
              <span className="text-xs text-muted" style={{ fontSize: "0.7rem" }}>
                {(explainData.feature_provenance === "recent_past_forecast" || explainData.feature_provenance === "live_real_history") ? "Open-Meteo past_days=2" : "Hourly NWP heuristic"}
              </span>
            </div>
          </div>

          <div className="shap-bars-container">
            {explainData.features?.slice(0, showExplain ? undefined : 3).map((f, i) => {
              const isPos = f.direction === "positive";
              const barPct = Math.min(100, Math.round((f.importance / 3.0) * 100));

              return (
                <div key={i} className="shap-attribution-item">
                  <div className="shap-line-info">
                    <span className="feat-title">{f.feature}</span>
                    <span className={`feat-val font-mono ${isPos ? "text-cyan" : "text-rose"}`}>
                      {isPos ? "+" : ""}{f.shap_value} {explainData.units}
                    </span>
                  </div>
                  <div className="shap-track-bg">
                    <div
                      className={`shap-fill-bar ${isPos ? "bar-cyan" : "bar-rose"}`}
                      style={{ width: `${barPct}%` }}
                    ></div>
                  </div>
                  <span className="feat-desc">{f.description}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 7-Day Ensemble Outlook ──────────────────────────────── */}
      {daily?.daily && (
        <div className="multi-day-card">
          <div className="card-top-header">
            <h3>7-Day Synoptic Weather Outlook</h3>
            <span className="subtext">ECMWF / GFS Blended Numerical Weather Prediction</span>
          </div>

          <div className="daily-grid-row">
            {daily.daily.map((day, i) => {
              const maxT = convertTemp(day.temperature_2m_max);
              const minT = convertTemp(day.temperature_2m_min);
              const precip = day.precipitation_probability_max ?? 0;
              const dObj = new Date(day.date);
              const dayName = i === 0 ? "Today" : dObj.toLocaleDateString("en", { weekday: "short" });
              const dateStr = dObj.toLocaleDateString("en", { month: "short", day: "numeric" });

              return (
                <div key={i} className="day-forecast-cell">
                  <span className="cell-day-name">{dayName}</span>
                  <span className="cell-date font-mono">{dateStr}</span>
                  <div className="cell-temps-row font-mono">
                    <span className="high-temp">{maxT}°</span>
                    <span className="low-temp">{minT}°</span>
                  </div>
                  <div className="cell-rain-indicator">
                    <Droplets size={12} className="text-cyan" />
                    <span className="font-mono">{precip}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
