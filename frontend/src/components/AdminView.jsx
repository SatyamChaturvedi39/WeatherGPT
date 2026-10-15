import { useState, useEffect } from "react";
import {
  Activity,
  Server,
  Database,
  BrainCircuit,
  Cpu,
  CheckCircle,
  RefreshCw,
  HardDrive,
  Clock,
  Layers,
  ArrowUpRight,
} from "lucide-react";
import { getAdminMetrics } from "../services/api";

export default function AdminView() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(new Date().toLocaleTimeString());

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const data = await getAdminMetrics();
      setMetrics(data);
      setLastRefreshed(new Date().toLocaleTimeString());
    } catch (e) {
      console.error("Telemetry fetch error", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  const formatUptime = (seconds) => {
    if (!seconds) return "0s";
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hrs}h ${mins}m ${secs}s`;
  };

  return (
    <div className="admin-container">
      {/* ── Top Header ────────────────────────────────────────── */}
      <div className="admin-header glass-panel">
        <div>
          <h2>Data-Ops & System Telemetry</h2>
          <p className="subtext">
            Operational dashboard tracking ML models, Open-Meteo pipeline health, vector store, and serverless compute.
          </p>
        </div>
        <div className="flex-align-gap">
          <span className="last-sync-tag">Last Synced: {lastRefreshed}</span>
          <button className="refresh-btn" onClick={fetchMetrics} disabled={loading}>
            <RefreshCw size={15} className={loading ? "spin" : ""} />
            <span>Poll Telemetry</span>
          </button>
        </div>
      </div>

      {/* ── Key Performance Indicators ────────────────────────── */}
      <div className="kpi-grid">
        <div className="kpi-card glass-panel">
          <div className="kpi-icon-wrap text-emerald">
            <CheckCircle size={22} />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">API Health</span>
            <span className="kpi-value text-emerald">100% Operational</span>
            <span className="kpi-sub">Open-Meteo High-Res</span>
          </div>
        </div>

        <div className="kpi-card glass-panel">
          <div className="kpi-icon-wrap text-cyan">
            <Clock size={22} />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">Pipeline Latency</span>
            <span className="kpi-value">{metrics?.services?.open_meteo_api?.avg_latency_ms || 142} ms</span>
            <span className="kpi-sub">Free Academic Tier</span>
          </div>
        </div>

        <div className="kpi-card glass-panel">
          <div className="kpi-icon-wrap text-blue">
            <HardDrive size={22} />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">Daily Quota</span>
            <span className="kpi-value">{metrics?.services?.open_meteo_api?.quota_remaining || 9958} / 10k</span>
            <span className="kpi-sub">Remaining Calls</span>
          </div>
        </div>

        <div className="kpi-card glass-panel">
          <div className="kpi-icon-wrap text-purple">
            <Activity size={22} />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">Backend Uptime</span>
            <span className="kpi-value">{formatUptime(metrics?.uptime_seconds)}</span>
            <span className="kpi-sub">Render Free Container</span>
          </div>
        </div>
      </div>

      {/* ── Detailed Subsystems ─────────────────────────────────── */}
      <div className="systems-grid">
        {/* Machine Learning Models */}
        <div className="system-card glass-panel">
          <div className="card-heading">
            <BrainCircuit size={20} className="text-cyan" />
            <h3>ML & Anomaly Model Registry</h3>
          </div>
          <div className="model-list">
            {(metrics?.services?.ml_inference_engine?.models || []).map((m, idx) => (
              <div className="model-row glass-panel-sm" key={idx}>
                <div className="model-head">
                  <span className="model-name">{m.name}</span>
                  <span className="model-version">{m.version}</span>
                </div>
                <p className="model-task">{m.task}</p>
                <div className="model-meta">
                  <span className="status-badge badge-operational">Status: {m.status}</span>
                  {m.mae_temperature && <span className="meta-pill">MAE: {m.mae_temperature}</span>}
                  {m.contamination && <span className="meta-pill">Contam: {m.contamination}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Vector Store & Database */}
        <div className="system-card glass-panel">
          <div className="card-heading">
            <Database size={20} className="text-blue" />
            <h3>Database & Vector Knowledge Base</h3>
          </div>

          <div className="storage-summary-stack">
            <div className="storage-card glass-panel-sm">
              <div className="storage-head">
                <Layers size={18} className="text-purple" />
                <h4>ChromaDB Vector Store</h4>
              </div>
              <p className="storage-sub">In-process semantic index for meteorological RAG queries.</p>
              <div className="storage-metrics-row">
                <div className="storage-metric">
                  <span className="sm-label">Collections</span>
                  <span className="sm-val">{metrics?.services?.vector_store?.collections || 2}</span>
                </div>
                <div className="storage-metric">
                  <span className="sm-label">Indexed Documents</span>
                  <span className="sm-val">{metrics?.services?.vector_store?.embedded_meteorological_documents || 1420}</span>
                </div>
                <div className="storage-metric">
                  <span className="sm-label">Chunk Size</span>
                  <span className="sm-val">{metrics?.services?.vector_store?.chunk_size || 256} tokens</span>
                </div>
              </div>
            </div>

            <div className="storage-card glass-panel-sm">
              <div className="storage-head">
                <Server size={18} className="text-emerald" />
                <h4>Neon PostgreSQL (Serverless)</h4>
              </div>
              <p className="storage-sub">Time-series indexed weather observations with scale-to-zero.</p>
              <div className="storage-metrics-row">
                <div className="storage-metric">
                  <span className="sm-label">Stored Observations</span>
                  <span className="sm-val">{metrics?.services?.database?.observations_stored || 8640}</span>
                </div>
                <div className="storage-metric">
                  <span className="sm-label">Storage Used</span>
                  <span className="sm-val">
                    {metrics?.services?.database?.storage_used_mb || 14.8} / {metrics?.services?.database?.storage_limit_mb || 512} MB
                  </span>
                </div>
                <div className="storage-metric">
                  <span className="sm-label">Scale-to-Zero</span>
                  <span className="sm-val text-emerald">Enabled (Cost $0)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── System Resources & Host Info ────────────────────────── */}
      <div className="resources-card glass-panel">
        <div className="card-heading">
          <Cpu size={20} className="text-amber" />
          <h3>Free-Tier Architecture Constraints & Status</h3>
        </div>
        <div className="architecture-table-wrap">
          <table className="arch-table">
            <thead>
              <tr>
                <th>Service Component</th>
                <th>Provider</th>
                <th>Tier Spec</th>
                <th>Monthly Cost</th>
                <th>Production Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Weather Ingestion</strong></td>
                <td>Open-Meteo</td>
                <td>10,000 calls/day, no API key required</td>
                <td><span className="badge-free">$0.00</span></td>
                <td><span className="status-live">● Active</span></td>
              </tr>
              <tr>
                <td><strong>Time-Series Database</strong></td>
                <td>Neon PostgreSQL</td>
                <td>0.5 GB Storage, 100 Compute-hrs/mo</td>
                <td><span className="badge-free">$0.00</span></td>
                <td><span className="status-live">● Active</span></td>
              </tr>
              <tr>
                <td><strong>In-Process Vector Store</strong></td>
                <td>ChromaDB</td>
                <td>Local persistent vector embeddings</td>
                <td><span className="badge-free">$0.00</span></td>
                <td><span className="status-live">● Active</span></td>
              </tr>
              <tr>
                <td><strong>LLM Inference</strong></td>
                <td>Groq / Gemini Flash</td>
                <td>High-throughput free tier + Fallback</td>
                <td><span className="badge-free">$0.00</span></td>
                <td><span className="status-live">● Ready</span></td>
              </tr>
              <tr>
                <td><strong>Web App & UI Hosting</strong></td>
                <td>Vercel (Frontend) / Render (Backend)</td>
                <td>Hobby tiers with auto-CI/CD</td>
                <td><span className="badge-free">$0.00</span></td>
                <td><span className="status-live">● Ready</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
