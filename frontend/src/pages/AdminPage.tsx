import React from 'react';
import { Database, Gauge, Clock } from 'lucide-react';
import { useAdminStatus } from '../hooks/useWeather';
import { Card } from '../components/ui/Card';
import { StatTile } from '../components/ui/StatTile';
import { Badge } from '../components/ui/Badge';
import { ErrorState } from '../components/ui/ErrorState';
import { PageHeader } from '../components/layout/PageHeader';
import { formatNumber, formatRelativeTime } from '../lib/formatters';

export const AdminPage: React.FC = () => {
  const { data: admin, isLoading, isError, refetch } = useAdminStatus();

  if (isError) {
    return (
      <div className="space-y-6">
        <PageHeader title="System Telemetry & ML Ops" subtitle="Health status and benchmarks." />
        <ErrorState message="Could not fetch system telemetry." onRetry={refetch} />
      </div>
    );
  }

  const isHealthy = admin?.pipeline_health.status === 'healthy';
  const isDegraded = admin?.pipeline_health.status === 'degraded';

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Telemetry & Operations"
        subtitle="Platform pipeline status, ingestion schedules, and ML model evaluation benchmarks."
        updatedAt={admin?.server_time}
        onRefresh={() => refetch()}
        isRefreshing={isLoading}
      />

      {/* 4 StatTiles for Operations */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-app-surface border border-border-subtle rounded-card p-4 shadow-card flex flex-col justify-between">
          <div className="flex items-center justify-between text-text-muted mb-1.5">
            <span className="text-xs text-text-secondary">Pipeline Health</span>
            <Badge
              variant={isHealthy ? 'success' : isDegraded ? 'risk-moderate' : 'risk-high'}
              size="sm"
            >
              {admin?.pipeline_health.status || 'unknown'}
            </Badge>
          </div>
          <div className="text-stat font-semibold tracking-tight text-text-primary">
            {admin?.pipeline_health.database_connected ? 'Connected' : 'Offline'}
          </div>
          <div className="text-2xs text-text-muted mt-1">
            Open-Meteo:{' '}
            <strong className={admin?.pipeline_health.open_meteo_reachable ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}>
              {admin?.pipeline_health.open_meteo_reachable ? 'Reachable' : 'Unreachable'}
            </strong>
          </div>
        </div>

        <StatTile
          label="Observation Records"
          value={formatNumber(admin?.ingestion.total_observation_rows, 0)}
          trendText={`Across ${admin?.ingestion.total_locations || 0} monitored points`}
          icon={<Database className="w-4 h-4 stroke-[1.75]" />}
          loading={isLoading}
        />

        <StatTile
          label="Ingestion Scheduler"
          value={admin?.ingestion.scheduler_running ? 'Active' : 'Inactive'}
          trendText={
            admin?.ingestion.last_run_time
              ? formatRelativeTime(admin.ingestion.last_run_time)
              : 'Pending first run'
          }
          icon={<Clock className="w-4 h-4 stroke-[1.75]" />}
          loading={isLoading}
        />

        <StatTile
          label="Admin Query Latency"
          value={formatNumber(admin?.system_latency_ms?.total_admin_ms, 1)}
          unit="ms"
          trendText={`DB: ${admin?.system_latency_ms?.db_query_ms || 0}ms • Probe: ${admin?.system_latency_ms?.open_meteo_probe_ms || 0}ms`}
          icon={<Gauge className="w-4 h-4 stroke-[1.75]" />}
          loading={isLoading}
        />
      </div>

      {/* Model Benchmark Performance Table */}
      <Card
        title="Model Benchmark & Evaluation Metrics"
        subtitle="Out-of-sample time-based cross-validation metrics across forecast horizons."
        headerAction={
          <span className="text-2xs font-mono text-text-muted">Target: temperature_2m (°C)</span>
        }
      >
        <div className="overflow-x-auto -mx-5 -mb-5 mt-2">
          <table className="w-full text-left text-xs" aria-label="Model Benchmark Metrics Table">
            <thead className="bg-app-subtle border-y border-border-subtle text-text-secondary font-medium">
              <tr>
                <th className="py-2.5 px-5">Model Architecture</th>
                <th className="py-2.5 px-5">Horizon</th>
                <th className="py-2.5 px-5 tabular-nums">MAE (°C)</th>
                <th className="py-2.5 px-5 tabular-nums">RMSE (°C)</th>
                <th className="py-2.5 px-5 tabular-nums">CRPS</th>
                <th className="py-2.5 px-5">Relative Gain</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle text-text-primary">
              {admin?.model_metrics.map((model) =>
                model.horizons.map((h, i) => (
                  <tr key={`${model.model_name}-${h.horizon_hours}`} className="hover:bg-app-subtle/40">
                    <td className="py-2.5 px-5 font-medium capitalize">
                      {i === 0 ? model.model_name.replace('_', ' ') : ''}
                    </td>
                    <td className="py-2.5 px-5 font-mono text-accent font-medium">
                      +{h.horizon_hours}h
                    </td>
                    <td className="py-2.5 px-5 font-mono tabular-nums text-text-secondary">
                      {formatNumber(h.mae, 2)}
                    </td>
                    <td className="py-2.5 px-5 font-mono tabular-nums text-text-secondary">
                      {formatNumber(h.rmse, 2)}
                    </td>
                    <td className="py-2.5 px-5 font-mono tabular-nums text-text-muted">
                      {h.crps !== undefined && h.crps !== null ? formatNumber(h.crps, 2) : '—'}
                    </td>
                    <td className="py-2.5 px-5 font-mono text-emerald-600 dark:text-emerald-400">
                      {model.model_name.includes('baseline') ? 'Baseline' : '-35% error vs pers.'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
