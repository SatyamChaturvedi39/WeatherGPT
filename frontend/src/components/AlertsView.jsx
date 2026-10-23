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
  Car,
  Plane,
  Building2,
  SlidersHorizontal,
} from "lucide-react";
import { getAlerts, getAlertHistory } from "../services/api";

export default function AlertsView({ location }) {
  const [alerts, setAlerts] = useState([]);
  const [summary, setSummary] = useState({ EXTREME: 0, HIGH: 0, MODERATE: 0, LOW: 0 });
  const [activities, setActivities] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [severityFilter, setSeverityFilter] = useState("ALL"); // 'ALL' | 'EXTREME' | 'HIGH' | 'MODERATE' | 'LOW'

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
      setActivities(alertsRes.activity_suitability || null);
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
      <div className="empty-state-card">
        <AlertTriangle size={48} className="text-amber" />
        <h3>Select a Station to Evaluate Risk</h3>
        <p>Atmospheric hazard assessments require geographical coordinates.</p>
      </div>
    );
  }

  const filteredAlerts = alerts.filter((a) => {
    if (severityFilter === "ALL") return true;
    return a.severity === severityFilter;
  });

  return (
    <div className="alerts-layout-stack">
      {/* ── Top Bar ────────────────────────────────────────────── */}
      <div className="section-hero-card">
        <div className="hero-text-col">
          <div className="eyebrow-pill">
            <ShieldAlert size={13} />
            <span>MEMBER 1 & 2 DELIVERABLE: RISK & ANOMALY ENGINE</span>
          </div>
          <h2>Atmospheric Hazard & Anomaly Alert Center</h2>
          <p className="hero-subtext">
            Continuous surveillance combining meteorological threshold models with Isolation Forest
            residual anomaly scoring for <strong>{location.name}</strong>.
          </p>
        </div>

        <button className="primary-action-btn" onClick={fetchAlertsData} disabled={loading}>
          <RefreshCw size={15} className={loading ? "spin" : ""} />
          <span>Poll Live Sensors</span>
        </button>
      </div>

      {/* ── Severity Count Strip ─────────────────────────────────── */}
      <div className="severity-metric-row">
        <div
          className={`severity-box ${severityFilter === "EXTREME" ? "severity-selected" : ""}`}
          onClick={() => setSeverityFilter(severityFilter === "EXTREME" ? "ALL" : "EXTREME")}
        >
          <span className="sev-title">EXTREME HAZARDS</span>
          <span className="sev-num text-rose font-mono">{summary.EXTREME || 0}</span>
          <span className="sev-desc">Immediate life-safety risk</span>
        </div>

        <div
          className={`severity-box ${severityFilter === "HIGH" ? "severity-selected" : ""}`}
          onClick={() => setSeverityFilter(severityFilter === "HIGH" ? "ALL" : "HIGH")}
        >
          <span className="sev-title">HIGH ADVISORIES</span>
          <span className="sev-num text-orange font-mono">{summary.HIGH || 0}</span>
          <span className="sev-desc">Operational disruption</span>
        </div>

        <div
          className={`severity-box ${severityFilter === "MODERATE" ? "severity-selected" : ""}`}
          onClick={() => setSeverityFilter(severityFilter === "MODERATE" ? "ALL" : "MODERATE")}
        >
          <span className="sev-title">MODERATE ADVISORIES</span>
          <span className="sev-num text-amber font-mono">{summary.MODERATE || 0}</span>
          <span className="sev-desc">Precautionary measures</span>
        </div>

        <div
          className={`severity-box ${severityFilter === "LOW" ? "severity-selected" : ""}`}
          onClick={() => setSeverityFilter(severityFilter === "LOW" ? "ALL" : "LOW")}
        >
          <span className="sev-title">FAVORABLE BASELINE</span>
          <span className="sev-num text-emerald font-mono">{summary.LOW || 0}</span>
          <span className="sev-desc">Normal meteorological limits</span>
        </div>
      </div>

      {/* ── Active Risk Banner Stack ─────────────────────────────── */}
      <div className="active-alerts-section">
        <div className="card-top-header">
          <div>
            <h3>Active Sensor Risk Evaluations ({filteredAlerts.length})</h3>
            <span className="subtext">Threshold-triggered and anomaly-residual flagged events</span>
          </div>

          {severityFilter !== "ALL" && (
            <button className="subtle-btn" onClick={() => setSeverityFilter("ALL")}>
              Reset Filter ({severityFilter}) ✕
            </button>
          )}
        </div>

        {loading ? (
          <div className="loading-state-panel">
            <div className="spinner-orbit"></div>
            <p>Evaluating atmospheric risk surfaces...</p>
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="all-clear-banner">
            <CheckCircle2 size={24} className="text-emerald" />
            <div>
              <h4>All Atmospheric Parameters Within Standard Operating Envelopes</h4>
              <p className="text-muted">No anomalies detected for the selected severity criteria.</p>
            </div>
          </div>
        ) : (
          <div className="alerts-cards-list">
            {filteredAlerts.map((alert, i) => (
              <div key={i} className={`alert-record-card card-${alert.severity.toLowerCase()}`}>
                <div className="alert-meta-top">
                  <div className="alert-badges-row">
                    <span className={`sev-tag tag-${alert.severity.toLowerCase()}`}>
                      {alert.severity} RISK
                    </span>
                    <span className="engine-tag font-mono">Engine: {alert.triggered_by}</span>
                    <span className="conf-tag font-mono">Confidence: {Math.round((alert.confidence || 0.95) * 100)}%</span>
                  </div>
                  <span className="anomaly-z-tag font-mono">
                    Residual Anomaly Score: {alert.anomaly_score}
                  </span>
                </div>

                <h4 className="alert-title">{alert.title}</h4>
                <p className="alert-narrative">{alert.description}</p>

                <div className="actionable-checklist-box">
                  <span className="chk-label">OPERATIONAL MITIGATION PROTOCOL:</span>
                  <p className="chk-text">{alert.recommendation}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Commercial Sector Operability Summary ───────────────── */}
      {activities && (
        <div className="commercial-operability-card">
          <div className="card-top-header">
            <h3>Commercial Sector Impact Matrix</h3>
            <span className="subtext">Automated threshold assessment by industry application</span>
          </div>

          <div className="activity-cards-grid">
            {Object.entries(activities).map(([key, act]) => (
              <div key={key} className="activity-operability-card">
                <div className="act-header">
                  <span className="font-mono text-cyan">{act.name}</span>
                  <span className="act-score-tag tag-optimal font-mono">{act.score}/100 • {act.status}</span>
                </div>
                <ul className="act-advisories-list">
                  {act.advisories.map((a, idx) => (
                    <li key={idx}>• {a}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Historical Events ───────────────────────────────────── */}
      {history.length > 0 && (
        <div className="historical-events-card">
          <div className="card-top-header">
            <div className="flex-align-gap">
              <History size={16} className="text-muted" />
              <h3>Resolved Incident History (Past 7 Days)</h3>
            </div>
            <span className="subtext">Post-event resolution telemetry</span>
          </div>

          <div className="history-table-wrap">
            <table className="benchmark-table">
              <thead>
                <tr>
                  <th>Event Date</th>
                  <th>Severity</th>
                  <th>Atmospheric Incident</th>
                  <th>Peak Metric</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => (
                  <tr key={i}>
                    <td className="font-mono">{h.date}</td>
                    <td>
                      <span className={`sev-tag tag-${h.severity.toLowerCase()}`}>{h.severity}</span>
                    </td>
                    <td><strong>{h.title}</strong></td>
                    <td className="font-mono">{h.peak_value}</td>
                    <td className="text-emerald">Resolved & Logged</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
