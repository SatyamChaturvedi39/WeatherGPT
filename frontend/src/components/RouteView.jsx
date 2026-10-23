import { useState, useEffect } from "react";
import {
  Navigation,
  MapPin,
  Clock,
  Gauge,
  AlertTriangle,
  ShieldCheck,
  ArrowRight,
  Droplets,
  Wind,
  Thermometer,
  RotateCcw,
  Compass,
} from "lucide-react";
import { getRouteForecast } from "../services/api";

const PRESET_ROUTES = [
  { origin: "Vimanapura (HAL)", destination: "Koramangala" },
  { origin: "Indiranagar", destination: "Whitefield" },
  { origin: "Electronic City", destination: "Manyata" },
  { origin: "Silk Board", destination: "Bellandur" },
  { origin: "Bengaluru", destination: "Mysuru" },
  { origin: "Mumbai", destination: "Pune" },
  { origin: "Delhi", destination: "Gurugram" },
  { origin: "Bengaluru", destination: "Chennai" },
];

export default function RouteView({ unit, convertTemp, convertSpeed, tempUnit, speedUnit }) {
  const [origin, setOrigin] = useState("Vimanapura");
  const [destination, setDestination] = useState("Koramangala");
  const [transitMode, setTransitMode] = useState("two_wheeler");
  const [routeData, setRouteData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleAnalyzeRoute = async (orig = origin, dest = destination, mode = transitMode) => {
    if (!orig.trim() || !dest.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getRouteForecast(orig.trim(), dest.trim(), 5, mode);
      setRouteData(res.data);
    } catch (err) {
      setError(err.message || "Failed to compute corridor transit weather.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleAnalyzeRoute("Vimanapura", "Koramangala", "two_wheeler");
  }, []);

  return (
    <div className="route-view-container">
      {/* ── Top Header ────────────────────────────────────────── */}
      <div className="section-hero-card">
        <div className="hero-text-col">
          <div className="eyebrow-pill">
            <Compass size={13} />
            <span>COMMERCIAL TRANSIT & LOGISTICS</span>
          </div>
          <h2>Corridor Weather & Travel Hazard Analyzer</h2>
          <p className="hero-subtext">
            Continuous meteorological sampling across transit waypoints to assess crosswind shear,
            wet-asphalt braking penalties, and visibility risks along multi-point transport routes.
          </p>
        </div>

        {/* Route Form */}
        <div className="route-form-card">
          <div className="route-inputs-row">
            <div className="route-input-group">
              <label>
                <MapPin size={14} className="text-emerald" /> ORIGIN
              </label>
              <input
                type="text"
                placeholder="Origin City (e.g. Bangalore)"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAnalyzeRoute()}
              />
            </div>

            <div className="route-arrow-divider">
              <ArrowRight size={18} />
            </div>

            <div className="route-input-group">
              <label>
                <Navigation size={14} className="text-cyan" /> DESTINATION
              </label>
              <input
                type="text"
                placeholder="Destination City (e.g. Chennai)"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAnalyzeRoute()}
              />
            </div>

            <button
              className="primary-action-btn"
              onClick={() => handleAnalyzeRoute(origin, destination, transitMode)}
              disabled={loading}
            >
              {loading ? "Sampling Corridor..." : "Analyze Route"}
            </button>
          </div>

          {/* Transit Mode Selector */}
          <div className="transit-mode-selector-strip">
            <span className="mode-label">Vehicle Mode:</span>
            <div className="mode-pills-wrap">
              {[
                { id: "two_wheeler", label: "🛵 Two-Wheeler / Scooter" },
                { id: "auto_cab", label: "🛺 Auto / Cab" },
                { id: "four_wheeler", label: "🚗 Four-Wheeler / Car" },
                { id: "pedestrian", label: "🚶 Walking" },
              ].map((m) => (
                <button
                  key={m.id}
                  className={`transit-mode-pill ${transitMode === m.id ? "transit-mode-active" : ""}`}
                  onClick={() => {
                    setTransitMode(m.id);
                    handleAnalyzeRoute(origin, destination, m.id);
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Presets */}
          <div className="presets-row">
            <span className="preset-label">Quick Corridors:</span>
            {PRESET_ROUTES.map((p, idx) => (
              <button
                key={idx}
                className="preset-chip"
                onClick={() => {
                  setOrigin(p.origin);
                  setDestination(p.destination);
                  handleAnalyzeRoute(p.origin, p.destination, transitMode);
                }}
              >
                {p.origin} → {p.destination}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="system-error-banner">
          <AlertTriangle size={18} />
          <span>Corridor Calculation Notice: {error}</span>
        </div>
      )}

      {loading && (
        <div className="loading-state-panel">
          <div className="spinner-orbit"></div>
          <p>Interpolating transit waypoints & querying atmospheric models...</p>
        </div>
      )}

      {/* ── Route Result Display ────────────────────────────────── */}
      {routeData && !loading && (
        <div className="route-result-stack">
          {/* Corridor Safety Summary */}
          <div className="corridor-summary-grid">
            <div className="summary-stat-box">
              <span className="stat-label">TOTAL DISTANCE</span>
              <span className="stat-val font-mono">{routeData.total_distance_km} km</span>
              <span className="stat-sub">{routeData.transit_type || "Direct Geodetic Arc"}</span>
            </div>

            <div className="summary-stat-box">
              <span className="stat-label">ESTIMATED TRANSIT</span>
              <span className="stat-val font-mono">
                {routeData.estimated_drive_mins
                  ? `${routeData.estimated_drive_mins} mins`
                  : `${routeData.estimated_drive_hours} hrs`}
              </span>
              <span className="stat-sub">
                {routeData.estimated_drive_mins ? "Bengaluru Traffic Calibrated" : "Highway Speed Calibrated"}
              </span>
            </div>

            <div className="summary-stat-box">
              <span className="stat-label">CORRIDOR SAFETY INDEX</span>
              <div className="safety-score-row">
                <span
                  className={`score-badge ${
                    routeData.safety_score >= 80
                      ? "score-high"
                      : routeData.safety_score >= 60
                      ? "score-med"
                      : "score-low"
                  }`}
                >
                  {routeData.safety_score}/100
                </span>
                <span className="score-desc">{routeData.safety_status}</span>
              </div>
            </div>

            <div className="summary-stat-box">
              <span className="stat-label">ACTIVE HAZARDS</span>
              <span
                className={`stat-val ${
                  routeData.active_hazards.length > 0 ? "text-amber" : "text-emerald"
                }`}
              >
                {routeData.active_hazards.length}
              </span>
              <span className="stat-sub">
                {routeData.active_hazards.length === 0
                  ? "Zero critical atmospheric hazards"
                  : "Cautionary waypoints detected"}
              </span>
            </div>
          </div>

          {/* Raincoat & Commute Advisory Banner */}
          {routeData.raincoat_advisory && (
            <div className={`raincoat-advisory-card ${routeData.raincoat_needed ? "advisory-alert" : "advisory-nominal"}`}>
              <ShieldCheck size={20} className={routeData.raincoat_needed ? "text-amber" : "text-emerald"} />
              <div className="advisory-text-wrap">
                <span className="advisory-title font-bold">
                  {routeData.raincoat_needed ? "RAINCOAT REQUIRED FOR TRANSIT" : "NO RAINCOAT REQUIRED"}
                </span>
                <p className="advisory-body">{routeData.raincoat_advisory}</p>
              </div>
            </div>
          )}

          {/* Vehicle Dynamics & Wet Asphalt Physics */}
          {routeData.mode_guidance && (
            <div className="vehicle-dynamics-card">
              <div className="veh-head">
                <span className="veh-mode-tag font-bold">{routeData.transit_mode || "Multi-Modal Transit"}</span>
                {routeData.stopping_distance_penalty_pct > 0 && (
                  <span className="friction-penalty-badge">
                    Braking Distance: +{routeData.stopping_distance_penalty_pct}% on Wet Asphalt (μ drops to 0.35)
                  </span>
                )}
              </div>
              <p className="veh-guidance-text">{routeData.mode_guidance}</p>
            </div>
          )}

          {/* Active Hazards Notice */}
          {routeData.active_hazards.length > 0 && (
            <div className="hazard-warning-strip">
              <AlertTriangle size={18} className="text-amber" />
              <div className="hazard-list">
                {routeData.active_hazards.map((h, i) => (
                  <span key={i} className="hazard-bullet">
                    • {h}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Waypoint Timeline */}
          <div className="waypoints-timeline-card">
            <div className="timeline-head">
              <h3>Atmospheric Waypoint Telemetry</h3>
              <span className="text-muted">Sampled along origin-destination transit corridor</span>
            </div>

            <div className="waypoints-stepper">
              {routeData.waypoints.map((wp, i) => {
                const tempDisplay = convertTemp(wp.temperature);
                const windDisplay = convertSpeed(wp.wind_speed);

                return (
                  <div
                    key={i}
                    className={`waypoint-node-card ${wp.hazard ? "waypoint-hazard" : ""}`}
                  >
                    <div className="node-step-tag">
                      <span className="step-num">WAYPOINT 0{wp.step}</span>
                      {wp.hazard ? (
                        <span className="hazard-tag-badge">{wp.hazard}</span>
                      ) : (
                        <span className="safe-tag-badge">Clear</span>
                      )}
                    </div>

                    <h4 className="node-name">{wp.name}</h4>
                    <p className="node-coords font-mono">
                      {wp.latitude}°N, {wp.longitude}°E
                    </p>

                    <div className="node-metrics-grid">
                      <div className="node-metric">
                        <Thermometer size={14} className="text-muted" />
                        <span>
                          <strong>{tempDisplay}°</strong>
                          {tempUnit}
                        </span>
                      </div>
                      <div className="node-metric">
                        <Droplets size={14} className="text-cyan" />
                        <span>
                          <strong>{wp.precipitation}</strong> mm
                        </span>
                      </div>
                      <div className="node-metric">
                        <Wind size={14} className="text-blue" />
                        <span>
                          <strong>{windDisplay}</strong> {speedUnit}
                        </span>
                      </div>
                      <div className="node-metric">
                        <Clock size={14} className="text-muted" />
                        <span>+{wp.eta_hours}h ETA</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
