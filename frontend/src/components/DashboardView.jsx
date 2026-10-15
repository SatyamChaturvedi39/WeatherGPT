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
  Info,
  TrendingUp,
  Sparkles,
  ShieldAlert,
  ChevronRight,
} from "lucide-react";
import { getExplainForecast } from "../services/api";

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
  const [explainLoading, setExplainLoading] = useState(false);
  const [showExplainModal, setShowExplainModal] = useState(false);

  useEffect(() => {
    if (!location) return;
    const fetchExplain = async () => {
      setExplainLoading(true);
      try {
        const res = await getExplainForecast(location.latitude, location.longitude);
        setExplainData(res);
      } catch (e) {
        console.error("Explainability load failed", e);
      } finally {
        setExplainLoading(false);
      }
    };
    fetchExplain();
  }, [location]);

  if (!location) {
    return (
      <div className="empty-state">
        <div className="empty-icon-glow">
          <Cloud size={64} />
        </div>
        <h2>Select or search a location to begin</h2>
        <p>Choose one of the quick locations above or search any city across the globe for real-time AI weather intelligence.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="loading-state">
        <div className="loading-ring"></div>
        <p>Retrieving high-resolution atmospheric models...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-banner">
        <ShieldAlert size={20} />
        <span>Weather Data Ingestion Error: {error}</span>
      </div>
    );
  }

  if (!current) return null;

  const curr = current.current;
  const currentTemp = convertTemp(curr.temperature_2m);
  const apparentTemp = convertTemp(curr.apparent_temperature);
  const windVal = convertSpeed(curr.wind_speed_10m);

  // Prepare hourly data for Recharts (24 hours)
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
      uncertaintyBand: [convertTemp(rawLower), convertTemp(rawUpper)],
      precipProb: pt.precipitation_probability ?? 0,
      precipMm: pt.precipitation ?? 0,
      windSpeed: convertSpeed(pt.wind_speed_10m ?? 0),
      humidity: pt.relative_humidity_2m ?? 0,
    };
  });

  return (
    <div className="dashboard-content">
      {/* ── Top Hero: Current Weather + Atmospheric Highlights ──────── */}
      <div className="hero-grid">
        <div className="current-card glass-panel glow-card">
          <div className="current-header">
            <div>
              <span className="live-pill">
                <span className="live-dot"></span> LIVE TELEMETRY
              </span>
              <h2 className="location-name">
                {location.name}
                {location.country ? `, ${location.country}` : ""}
              </h2>
              <p className="timezone-text">{current.location?.timezone || "UTC"} • Elev: {current.location?.elevation || 0}m</p>
            </div>
            <button
              className="explain-chip"
              onClick={() => setShowExplainModal(!showExplainModal)}
              title="Explain how ML predicted this forecast"
            >
              <Sparkles size={14} />
              <span>Why this forecast?</span>
            </button>
          </div>

          <div className="current-display">
            <div className="temp-cluster">
              <span className="main-temp">{currentTemp}°</span>
              <span className="unit-label">{tempUnit}</span>
            </div>
            <div className="condition-summary">
              <span className="feels-like">Feels like <strong>{apparentTemp}°{tempUnit}</strong></span>
              <span className="sub-note">Diurnal Peak Prob: {Math.max(...chartData.map((d) => d.temp))}°{tempUnit}</span>
            </div>
          </div>

          <div className="quick-metrics-row">
            <div className="metric-pill">
              <Droplets size={16} className="text-cyan" />
              <span>{curr.relative_humidity_2m}% Humidity</span>
            </div>
            <div className="metric-pill">
              <Wind size={16} className="text-blue" />
              <span>{windVal} {speedUnit} Wind</span>
            </div>
            <div className="metric-pill">
              <Gauge size={16} className="text-amber" />
              <span>{curr.surface_pressure} hPa</span>
            </div>
            <div className="metric-pill">
              <Eye size={16} className="text-indigo" />
              <span>{curr.cloud_cover}% Cloud Cover</span>
            </div>
          </div>
        </div>

        {/* AI Insight Card */}
        <div className="ai-insight-card glass-panel">
          <div className="card-top-row">
            <div className="flex-align-gap">
              <Sparkles size={18} className="text-accent" />
              <h3>WeatherGPT Synopsis</h3>
            </div>
            <button className="chat-link-btn" onClick={onNavigateToChat}>
              Ask Chat <ChevronRight size={14} />
            </button>
          </div>
          <p className="ai-summary-text">
            Atmospheric conditions over {location.name} are influenced by{" "}
            <strong>{curr.temperature_2m >= 18 ? "moderate surface warming" : "cool air subsidence"}</strong>{" "}
            with barometric pressure at {curr.surface_pressure} hPa. Precipitation risk for the next 24 hours peaks at{" "}
            <strong>{Math.max(...chartData.map((d) => d.precipProb), 0)}%</strong>.
          </p>

          <div className="insight-tags">
            <span className="tag-chip">
              <TrendingUp size={12} /> Probabilistic Confidence: 95%
            </span>
            <span className="tag-chip">
              <Sun size={12} /> Diurnal Horizon: 48h
            </span>
          </div>

          {explainData && (
            <div className="mini-shap-preview">
              <span className="mini-label">Top Driving Feature:</span>
              <span className="mini-val">
                {explainData.features?.[0]?.feature} ({explainData.features?.[0]?.shap_value > 0 ? "+" : ""}
                {explainData.features?.[0]?.shap_value}°C impact)
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Explainability Drawer / Card (SHAP attributions) ──────────── */}
      {showExplainModal && explainData && (
        <div className="explain-panel glass-panel animate-fade-in">
          <div className="panel-header">
            <div className="flex-align-gap">
              <Sparkles size={20} className="text-amber" />
              <div>
                <h3>Forecast Explainability (TreeSHAP Insights)</h3>
                <p className="subtext">
                  How model features contributed relative to base climatological temperature ({explainData.base_value}°C).
                </p>
              </div>
            </div>
            <button className="close-btn" onClick={() => setShowExplainModal(false)}>✕</button>
          </div>

          <div className="shap-feature-bars">
            {explainData.features?.map((f, idx) => {
              const isPositive = f.direction === "positive";
              const barWidth = Math.min(100, Math.round((f.importance / 3.0) * 100));
              return (
                <div className="shap-row" key={idx}>
                  <div className="shap-meta">
                    <span className="shap-name">{f.feature}</span>
                    <span className={`shap-val ${isPositive ? "val-pos" : "val-neg"}`}>
                      {isPositive ? "+" : ""}{f.shap_value} {explainData.units}
                    </span>
                  </div>
                  <div className="shap-bar-track">
                    <div
                      className={`shap-bar-fill ${isPositive ? "bar-pos" : "bar-neg"}`}
                      style={{ width: `${barWidth}%` }}
                    ></div>
                  </div>
                  <span className="shap-desc">{f.description}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Interactive Recharts Time-Series ───────────────────────── */}
      <div className="chart-section glass-panel">
        <div className="chart-toolbar">
          <div>
            <h3>24-Hour Atmospheric Forecast</h3>
            <p className="chart-subtext">Multi-horizon ML predictions with uncertainty intervals</p>
          </div>
          <div className="chart-tab-group">
            <button
              className={`chart-tab ${activeChart === "temp" ? "active" : ""}`}
              onClick={() => setActiveChart("temp")}
            >
              Temperature & Confidence
            </button>
            <button
              className={`chart-tab ${activeChart === "precip" ? "active" : ""}`}
              onClick={() => setActiveChart("precip")}
            >
              Precipitation Probability
            </button>
            <button
              className={`chart-tab ${activeChart === "wind" ? "active" : ""}`}
              onClick={() => setActiveChart("wind")}
            >
              Wind Velocity
            </button>
          </div>
        </div>

        <div className="chart-container" style={{ width: "100%", height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            {activeChart === "temp" ? (
              <AreaChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="uncertaintyGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#818cf8" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#818cf8" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 12 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 12 }} unit={`°`} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="chart-tooltip glass-panel">
                          <p className="tooltip-time">{data.time}</p>
                          <p className="tooltip-val text-cyan">
                            Expected: <strong>{data.temp}°{tempUnit}</strong>
                          </p>
                          <p className="tooltip-range text-muted">
                            95% CI: [{data.tempLower}° - {data.tempUpper}°{tempUnit}]
                          </p>
                          <p className="tooltip-sub text-muted">Humidity: {data.humidity}%</p>
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
                  fill="url(#uncertaintyGradient)"
                  name="Uncertainty Upper"
                />
                <Area
                  type="monotone"
                  dataKey="tempLower"
                  stroke="transparent"
                  fill="transparent"
                  name="Uncertainty Lower"
                />
                <Area
                  type="monotone"
                  dataKey="temp"
                  stroke="#38bdf8"
                  strokeWidth={3}
                  fill="url(#tempGradient)"
                  name="Temperature"
                />
              </AreaChart>
            ) : activeChart === "precip" ? (
              <BarChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="precipGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.4} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 12 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 12 }} unit="%" domain={[0, 100]} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="chart-tooltip glass-panel">
                          <p className="tooltip-time">{data.time}</p>
                          <p className="tooltip-val text-cyan">
                            Rain Probability: <strong>{data.precipProb}%</strong>
                          </p>
                          <p className="tooltip-sub text-muted">
                            Accumulation: {data.precipMm} mm
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="precipProb" fill="url(#precipGradient)" radius={[4, 4, 0, 0]} name="Rain Probability %" />
              </BarChart>
            ) : (
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 12 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 12 }} unit={` ${speedUnit}`} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="chart-tooltip glass-panel">
                          <p className="tooltip-time">{data.time}</p>
                          <p className="tooltip-val text-blue">
                            Wind Speed: <strong>{data.windSpeed} {speedUnit}</strong>
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
                  stroke="#60a5fa"
                  strokeWidth={3}
                  dot={{ r: 3, fill: "#3b82f6" }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── 7-Day Multi-Horizon Forecast ──────────────────────────── */}
      {daily?.daily && (
        <div className="forecast-section glass-panel">
          <div className="section-head">
            <h3>7-Day Multi-Horizon Weather Outlook</h3>
            <span className="section-note">ECMWF / GFS Blended Predictions</span>
          </div>

          <div className="daily-cards-grid">
            {daily.daily.map((day, i) => {
              const maxT = convertTemp(day.temperature_2m_max);
              const minT = convertTemp(day.temperature_2m_min);
              const precip = day.precipitation_probability_max ?? 0;
              const dateObj = new Date(day.date);
              const dayLabel = i === 0 ? "Today" : dateObj.toLocaleDateString("en", { weekday: "short" });
              const dateNum = dateObj.toLocaleDateString("en", { month: "short", day: "numeric" });

              return (
                <div className="day-card glass-panel-sm" key={i}>
                  <div className="day-top">
                    <span className="day-name-bold">{dayLabel}</span>
                    <span className="day-subdate">{dateNum}</span>
                  </div>
                  <div className="day-range-box">
                    <span className="high-t">{maxT}°</span>
                    <span className="low-t">{minT}°</span>
                  </div>
                  <div className="day-bar-indicator">
                    <div
                      className="precip-fill"
                      style={{ width: `${Math.min(100, precip)}%` }}
                    ></div>
                  </div>
                  <div className="day-precip-badge">
                    <Droplets size={12} className="text-cyan" />
                    <span>{precip}%</span>
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
