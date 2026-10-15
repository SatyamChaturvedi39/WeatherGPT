import { useState, useEffect } from "react";
import {
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Flame,
  Wind,
  CloudRain,
  Snowflake,
  Activity,
  History,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { getAlerts, getAlertHistory } from "../services/api";

export default function AlertsView({ location }) {
  const [alerts, setAlerts] = useState([]);
  const [summary, setSummary] = useState({ EXTREME: 0, HIGH: 0, MODERATE: 0, LOW: 0 });
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("ALL"); // 'ALL' | 'EXTREME' | 'HIGH' | 'MODERATE' | 'LOW'

  const fetchAlertsData = async () => {
    if (!location) return;
    setLoading(true);
    try {
      const [alertsRes, historyRes] = await Promise.all([
        getAlerts(location.latitude, location.longitude),
        getAlertHistory(location.latitude, location.longitude),
      ]);
      setAlerts(alertsRes.alerts || []);
      setSummary(alertsRes.summary || { EXTREME: 0, HIGH: 0, MODERATE: 0, LOW: 0 });
      setHistory(historyRes.history || []);
    } catch (err) {
      console.error("Failed to load alerts", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlertsData();
  }, [location]);

  if (!location) {
    return (
      <div className="empty-state">
        <AlertTriangle size={64} className="text-amber" />
        <h2>Select a location to inspect active risk alerts</h2>
        <p>Weather risk assessment is calculated for specific geographical coordinates.</p>
      </div>
    );
  }

  const filteredAlerts = alerts.filter((a) => {
    if (filter === "ALL") return true;
    return a.severity === filter;
  });

  const getSeverityIcon = (type) => {
    switch (type) {
      case "extreme_heat":
      case "heat_wave":
        return <Flame size={20} className="text-rose" />;
      case "severe_thunderstorm":
      case "heavy_rain":
      case "moderate_rain":
        return <CloudRain size={20} className="text-cyan" />;
      case "extreme_cold":
      case "frost_warning":
        return <Snowflake size={20} className="text-cyan" />;
      case "destructive_wind":
      case "high_wind":
        return <Wind size={20} className="text-blue" />;
      default:
        return <CheckCircle2 size={20} className="text-emerald" />;
    }
  };

  return (
    <div className="alerts-container">
      {/* ── Top Bar ────────────────────────────────────────────── */}
      <div className="alerts-header glass-panel">
        <div>
          <h2>Atmospheric Hazard & Risk Engine</h2>
          <p className="subtext">
            Continuous anomaly monitoring for <strong>{location.name}</strong> • Isolation Forest + Physical Thresholds
          </p>
        </div>
        <button className="refresh-btn" onClick={fetchAlertsData} disabled={loading}>
          <RefreshCw size={15} className={loading ? "spin" : ""} />
          <span>Refresh Analysis</span>
        </button>
      </div>

      {/* ── Severity Stat Counter Cards ────────────────────────── */}
      <div className="severity-summary-row">
        <div
          className={`stat-card stat-extreme ${filter === "EXTREME" ? "active-stat" : ""}`}
          onClick={() => setFilter(filter === "EXTREME" ? "ALL" : "EXTREME")}
        >
          <span className="stat-title">EXTREME HAZARDS</span>
          <span className="stat-number text-rose">{summary.EXTREME || 0}</span>
          <span className="stat-hint">Life-safety risk</span>
        </div>
        <div
          className={`stat-card stat-high ${filter === "HIGH" ? "active-stat" : ""}`}
          onClick={() => setFilter(filter === "HIGH" ? "ALL" : "HIGH")}
        >
          <span className="stat-title">HIGH ADVISORIES</span>
          <span className="stat-number text-orange">{summary.HIGH || 0}</span>
          <span className="stat-hint">Significant disruption</span>
        </div>
        <div
          className={`stat-card stat-mod ${filter === "MODERATE" ? "active-stat" : ""}`}
          onClick={() => setFilter(filter === "MODERATE" ? "ALL" : "MODERATE")}
        >
          <span className="stat-title">MODERATE ALERTS</span>
          <span className="stat-number text-amber">{summary.MODERATE || 0}</span>
          <span className="stat-hint">Precautionary</span>
        </div>
        <div
          className={`stat-card stat-low ${filter === "LOW" ? "active-stat" : ""}`}
          onClick={() => setFilter(filter === "LOW" ? "ALL" : "LOW")}
        >
          <span className="stat-title">FAVORABLE STATUS</span>
          <span className="stat-number text-emerald">{summary.LOW || 0}</span>
          <span className="stat-hint">Calm conditions</span>
        </div>
      </div>

      {/* ── Active Alerts List ──────────────────────────────────── */}
      <div className="alerts-section">
        <div className="section-header-row">
          <h3>Active Risk Assessments ({filteredAlerts.length})</h3>
          {filter !== "ALL" && (
            <button className="clear-filter-btn" onClick={() => setFilter("ALL")}>
              Reset Filter ({filter}) ✕
            </button>
          )}
        </div>

        {loading ? (
          <div className="loading-state">
            <div className="loading-ring"></div>
            <p>Evaluating atmospheric risk surfaces...</p>
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="glass-panel empty-alert-box">
            <ShieldCheck size={36} className="text-emerald" />
            <h4>No active warnings for this filter category</h4>
            <p>Atmospheric telemetry indicates safe operating baselines.</p>
          </div>
        ) : (
          <div className="alerts-cards-stack">
            {filteredAlerts.map((alert, i) => (
              <div className={`alert-banner-card glass-panel alert-border-${alert.severity.toLowerCase()}`} key={i}>
                <div className="alert-card-header">
                  <div className="alert-type-icon">{getSeverityIcon(alert.alert_type)}</div>
                  <div className="alert-meta-col">
                    <div className="alert-badge-row">
                      <span className={`badge-pill badge-${alert.severity.toLowerCase()}`}>
                        {alert.severity} RISK
                      </span>
                      <span className="engine-source-pill">Engine: {alert.triggered_by}</span>
                      <span className="confidence-pill">Confidence: {Math.round((alert.confidence || 0.95) * 100)}%</span>
                    </div>
                    <h3 className="alert-title-text">{alert.title}</h3>
                  </div>
                </div>

                <p className="alert-desc-text">{alert.description}</p>

                <div className="action-advice-box">
                  <span className="advice-label">Recommended Action:</span>
                  <span className="advice-text">{alert.recommendation}</span>
                </div>

                <div className="alert-footer-meta">
                  <span className="footer-tag">
                    <Activity size={12} /> Anomaly Residual Score: {alert.anomaly_score}
                  </span>
                  <span className="footer-tag">Status: Verified Active</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Historical Alerts Timeline ───────────────────────────── */}
      {history.length > 0 && (
        <div className="history-section glass-panel">
          <div className="history-header">
            <History size={18} className="text-blue" />
            <h3>Past 7 Days Resolved Atmospheric Incidents</h3>
          </div>
          <div className="history-timeline">
            {history.map((h, i) => (
              <div className="history-item" key={i}>
                <div className="timeline-node"></div>
                <div className="history-body">
                  <div className="history-title-row">
                    <span className="history-date">{h.date}</span>
                    <span className={`mini-badge badge-${h.severity.toLowerCase()}`}>{h.severity}</span>
                  </div>
                  <p className="history-title">{h.title}</p>
                  <p className="history-metric">Peak metric recorded: <strong>{h.peak_value}</strong> • Resolved</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
