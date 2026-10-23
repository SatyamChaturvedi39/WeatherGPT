import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Layers,
  MapPin,
  Compass,
  AlertTriangle,
  Droplets,
  Thermometer,
  ShieldCheck,
  Search,
  Filter,
  ArrowRight,
  TrendingUp,
  Activity,
  Wind,
} from "lucide-react";
import { getBangaloreMicroclimates } from "../services/api";

export default function MicroclimatesView({ onSelectLocation, convertTemp, tempUnit }) {
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterSeverity, setFilterSeverity] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const fetchMicroclimates = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getBangaloreMicroclimates();
        setZones(res.data || []);
      } catch (err) {
        setError(err.message || "Failed to load Bengaluru microclimates.");
      } finally {
        setLoading(false);
      }
    };
    fetchMicroclimates();
  }, []);

  const filteredZones = zones.filter((z) => {
    const matchSearch =
      z.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      z.zone.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchSearch) return false;

    if (filterSeverity === "all") return true;
    if (filterSeverity === "critical") return z.flood_risk === "Critical" || z.flood_risk === "Severe";
    if (filterSeverity === "high") return z.flood_risk === "High";
    if (filterSeverity === "moderate") return z.flood_risk === "Moderate";
    if (filterSeverity === "low") return z.flood_risk === "Low";
    return true;
  });

  const handleLaunchCommute = (zone) => {
    navigate("/chat");
  };

  const handleInspectStation = (zone) => {
    if (onSelectLocation) {
      onSelectLocation({
        name: zone.name,
        country: "India",
        latitude: zone.latitude,
        longitude: zone.longitude,
        admin1: "Karnataka",
      });
    }
    navigate("/");
  };

  const criticalCount = zones.filter((z) => z.flood_risk === "Critical" || z.flood_risk === "Severe").length;
  const highRainCount = zones.filter((z) => z.rain_probability >= 35).length;

  return (
    <div className="microclimates-view-container">
      {/* ── Hero Banner ────────────────────────────────────────── */}
      <div className="section-hero-card">
        <div className="hero-text-col">
          <div className="eyebrow-pill">
            <Layers size={13} />
            <span>HYPER-LOCAL METEOROLOGICAL MATRIX</span>
          </div>
          <h2>Bengaluru 25-Zone Microclimate Mission Board</h2>
          <p className="hero-subtext">
            Downscaled Topographic Hypsometric Lapse Rate (6.5°C/km), Urban Heat Island (UHI) Thermal Trapping,
            and Convective Rain Risk across 25+ Metropolitan Localities.
          </p>
        </div>

        {/* Macro Telemetry Bar */}
        <div className="macro-kpi-bar">
          <div className="macro-kpi-cell">
            <span className="macro-kpi-val font-mono">{zones.length}</span>
            <span className="macro-kpi-label">Indexed Wards</span>
          </div>
          <div className="macro-kpi-cell">
            <span className="macro-kpi-val font-mono text-amber">{highRainCount}</span>
            <span className="macro-kpi-label">Convective Risk Zones</span>
          </div>
          <div className="macro-kpi-cell">
            <span className="macro-kpi-val font-mono text-rose">{criticalCount}</span>
            <span className="macro-kpi-label">Drainage Chokepoints</span>
          </div>
          <div className="macro-kpi-cell">
            <span className="macro-kpi-val font-mono text-emerald">832m - 960m</span>
            <span className="macro-kpi-label">Plateau Elevation Range</span>
          </div>
        </div>
      </div>

      {/* ── Filters & Search Toolbar ───────────────────────────── */}
      <div className="micro-toolbar-strip">
        <div className="toolbar-search-box">
          <Search size={15} className="text-muted" />
          <input
            type="text"
            placeholder="Search locality (e.g. Koramangala, Whitefield, HAL, Indiranagar)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="toolbar-filter-group">
          <span className="filter-label">Drainage Vulnerability:</span>
          {[
            { id: "all", label: "All Localities" },
            { id: "critical", label: "Critical / Severe" },
            { id: "high", label: "High Risk" },
            { id: "moderate", label: "Moderate" },
            { id: "low", label: "Low Risk" },
          ].map((f) => (
            <button
              key={f.id}
              className={`filter-pill-btn ${filterSeverity === f.id ? "filter-active" : ""}`}
              onClick={() => setFilterSeverity(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="loading-state-panel">
          <div className="spinner-orbit"></div>
          <p>Compiling 25-zone microclimatic telemetry and hypsometric elevation gradients...</p>
        </div>
      )}

      {error && (
        <div className="system-error-banner">
          <AlertTriangle size={18} />
          <span>Microclimate Telemetry Exception: {error}</span>
        </div>
      )}

      {/* ── 25-Zone Grid ────────────────────────────────────────── */}
      {!loading && (
        <div className="micro-zones-grid">
          {filteredZones.map((z) => {
            const tempVal = convertTemp ? convertTemp(z.temperature) : z.temperature;
            const isCritical = z.flood_risk === "Critical" || z.flood_risk === "Severe";
            const isHigh = z.flood_risk === "High";
            const isRain = z.rain_probability >= 35;

            return (
              <div
                key={z.id}
                className={`micro-zone-card ${isCritical ? "zone-critical" : isHigh ? "zone-high" : ""}`}
              >
                <div className="zone-card-header">
                  <div className="zone-title-block">
                    <h4>{z.name}</h4>
                    <span className="zone-region-tag">{z.zone}</span>
                  </div>
                  <span
                    className={`flood-risk-tag ${
                      z.flood_risk === "Critical"
                        ? "flood-critical"
                        : z.flood_risk === "Severe"
                        ? "flood-severe"
                        : z.flood_risk === "High"
                        ? "flood-high"
                        : z.flood_risk === "Moderate"
                        ? "flood-moderate"
                        : "flood-low"
                    }`}
                  >
                    {z.flood_risk} Drainage Risk
                  </span>
                </div>

                <div className="zone-metrics-row">
                  <div className="metric-col">
                    <span className="metric-label">TEMPERATURE</span>
                    <span className="metric-val font-mono">
                      {tempVal}°{tempUnit || "C"}
                    </span>
                    <span className="metric-sub">
                      {z.elevation_delta_m >= 0 ? `+${z.elevation_delta_m}m` : `${z.elevation_delta_m}m`} vs CBD
                    </span>
                  </div>

                  <div className="metric-col">
                    <span className="metric-label">RAIN RISK</span>
                    <span className={`metric-val font-mono ${isRain ? "text-amber" : "text-emerald"}`}>
                      {z.rain_probability}%
                    </span>
                    <span className="metric-sub">{z.precipitation_rate > 0 ? `${z.precipitation_rate} mm/h` : "Dry"}</span>
                  </div>

                  <div className="metric-col">
                    <span className="metric-label">AIR QUALITY</span>
                    <span className="metric-val font-mono">
                      AQI {z.aqi}
                    </span>
                    <span className="metric-sub">{z.aqi > 100 ? "Unhealthy" : "Acceptable"}</span>
                  </div>

                  <div className="metric-col">
                    <span className="metric-label">ELEVATION</span>
                    <span className="metric-val font-mono">{z.elevation}m</span>
                    <span className="metric-sub">Above Sea Level</span>
                  </div>
                </div>

                {/* Rain probability bar */}
                <div className="zone-rain-bar-wrap">
                  <div
                    className={`zone-rain-bar-fill ${isRain ? "bar-rain-active" : ""}`}
                    style={{ width: `${Math.min(100, Math.max(8, z.rain_probability))}%` }}
                  ></div>
                </div>

                {/* Chokepoints */}
                {z.chokepoints && z.chokepoints.length > 0 && (
                  <div className="chokepoints-wrap">
                    <span className="chokepoints-label">Hazard Watchpoints:</span>
                    <div className="chokepoints-list">
                      {z.chokepoints.map((cp, idx) => (
                        <span key={idx} className="chokepoint-pill">
                          ⚠️ {cp}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Card Actions */}
                <div className="zone-card-footer">
                  <button
                    className="zone-action-btn commute-btn"
                    onClick={() => handleLaunchCommute(z)}
                    title="Check Commute Rain Shield to/from this zone"
                  >
                    <Compass size={13} />
                    <span>Commute Query</span>
                  </button>

                  <button
                    className="zone-action-btn inspect-btn"
                    onClick={() => handleInspectStation(z)}
                    title="View full telemetry on Mission Control dashboard"
                  >
                    <MapPin size={13} />
                    <span>Inspect Station</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
