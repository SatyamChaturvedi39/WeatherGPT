import React from 'react';
import { Database, Gauge, Cpu } from 'lucide-react';
import { useAdminStatus } from '../hooks/useWeather';
import { Card } from '../components/ui/Card';
import { StatTile } from '../components/ui/StatTile';
import { Badge } from '../components/ui/Badge';
import { ErrorState } from '../components/ui/ErrorState';
import { PageHeader } from '../components/layout/PageHeader';
import { formatNumber } from '../lib/formatters';
import { ForecastVerificationCard } from '../components/admin/ForecastVerificationCard';

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
        subtitle="Platform service status, stored records, and held-out ML model benchmarks."
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
          label="Stored Records"
          value={formatNumber((admin?.records.crowd_reports ?? 0) + (admin?.records.alert_events ?? 0), 0)}
          trendText={`${admin?.records.crowd_reports ?? '—'} crowd reports · ${admin?.records.alert_events ?? '—'} alert events`}
          icon={<Database className="w-4 h-4 stroke-[1.75]" />}
          loading={isLoading}
        />

        <StatTile
          label="ML Models Loaded"
          value={`${admin?.models_loaded ?? 0}`}
          unit={`of ${admin?.models_total ?? 0}`}
          trendText={admin && admin.models_loaded < admin.models_total ? 'Some artifacts missing' : 'All artifacts loaded'}
          icon={<Cpu className="w-4 h-4 stroke-[1.75]" />}
          loading={isLoading}
        />

        <StatTile
          label="Admin Query Latency"
          value={formatNumber(admin?.system_latency_ms?.total_admin_ms, 1)}
          unit="ms"
          trendText={
            admin?.system_latency_ms?.open_meteo_last_call_ms != null
              ? `Last Open-Meteo call: ${admin.system_latency_ms.open_meteo_last_call_ms}ms`
              : 'No Open-Meteo call yet'
          }
          icon={<Gauge className="w-4 h-4 stroke-[1.75]" />}
          loading={isLoading}
        />
      </div>

      <ForecastVerificationCard />

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
                    <td
                      className={`py-2.5 px-5 font-mono ${
                        h.gain_vs_persistence_pct == null
                          ? 'text-text-muted'
                          : h.gain_vs_persistence_pct >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {h.gain_vs_persistence_pct == null
                        ? '—'
                        : `${h.gain_vs_persistence_pct >= 0 ? '−' : '+'}${formatNumber(Math.abs(h.gain_vs_persistence_pct), 1)}% error vs pers.`}
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
