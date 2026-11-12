import React from 'react';
import { Siren, AlertTriangle, AlertCircle, Info, ShieldCheck, History, Gauge } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';
import { EmptyState } from '../components/ui/EmptyState';
import { useAlertsCenter, useAlertHistory } from '../hooks/useWeather';
import { severityVariant, scoreVariant, humanize } from '../lib/severity';
import type { Severity } from '../types/extra';

interface Props {
  location: { name: string; lat: number; lon: number };
}

const SEVERITIES: Array<{ key: Severity; label: string; icon: React.ReactNode; tone: string }> = [
  { key: 'EXTREME', label: 'Extreme', icon: <Siren className="h-4 w-4" />, tone: 'text-risk-high' },
  { key: 'HIGH', label: 'High', icon: <AlertTriangle className="h-4 w-4" />, tone: 'text-risk-high' },
  { key: 'MODERATE', label: 'Moderate', icon: <AlertCircle className="h-4 w-4" />, tone: 'text-risk-moderate' },
  { key: 'LOW', label: 'Low', icon: <Info className="h-4 w-4" />, tone: 'text-risk-low' },
];

const scoreBar = (score: number) => (score >= 70 ? 'bg-emerald-500' : score >= 40 ? 'bg-amber-500' : 'bg-red-500');

export const AlertsPage: React.FC<Props> = ({ location }) => {
  const center = useAlertsCenter(location.lat, location.lon);
  const history = useAlertHistory(location.lat, location.lon, 7);
  const data = center.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Alerts — ${location.name}`}
        subtitle="Live hazard assessment from the risk engine, activity suitability and recent alert history."
        updatedAt={center.dataUpdatedAt ? new Date(center.dataUpdatedAt) : null}
        onRefresh={() => {
          center.refetch();
          history.refetch();
        }}
        isRefreshing={center.isFetching}
      />

      {center.isError && <ErrorState message="Could not load alerts." onRetry={() => center.refetch()} />}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {SEVERITIES.map((s) => (
          <div key={s.key} className="rounded-card border border-border-subtle bg-app-surface p-4 shadow-card">
            <div className="flex items-center justify-between text-xs text-text-secondary">
              {s.label}
              <span className={s.tone}>{s.icon}</span>
            </div>
            {center.isLoading ? (
              <Skeleton className="mt-2 h-7 w-10" />
            ) : (
              <div className="mt-1 text-stat font-semibold tabular-nums text-text-primary">{data?.summary?.[s.key] ?? 0}</div>
            )}
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-7">
          <h2 className="text-sm font-semibold text-text-primary">Active alerts</h2>
          {center.isLoading && [0, 1].map((i) => <Skeleton key={i} className="h-28 w-full rounded-card" />)}
          {data && data.alerts.length === 0 && (
            <EmptyState icon={<ShieldCheck className="h-6 w-6" />} title="No active alerts" description="Conditions are within normal thresholds." />
          )}
          {data?.alerts.map((a) => (
            <Card key={a.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Badge variant={severityVariant(a.severity)} size="sm">{a.severity}</Badge>
                  <h3 className="text-sm font-semibold text-text-primary">{a.title}</h3>
                </div>
                <span className="text-2xs tabular-nums text-text-muted">
                  confidence {Math.round((a.confidence ?? 0) * 100)}%
                </span>
              </div>
              <p className="mt-2 text-sm text-text-secondary">{a.description}</p>
              <div className="mt-3 rounded-btn bg-app-subtle px-3 py-2 text-xs text-text-secondary">
                <span className="font-medium text-text-primary">Recommendation: </span>
                {a.recommendation}
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-2xs text-text-muted">
                <span>Type: {humanize(a.alert_type)}</span>
                <span>Source: {humanize(a.triggered_by)}</span>
                {typeof a.anomaly_score === 'number' && <span>Anomaly score: {a.anomaly_score.toFixed(2)}</span>}
              </div>
            </Card>
          ))}
        </div>

        <div className="space-y-6 lg:col-span-5">
          <Card title="Activity suitability" subtitle="Scored 0–100 from current conditions and the next 24h" headerAction={<Gauge className="h-4 w-4 text-text-muted" />}>
            {center.isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <div className="space-y-4">
                {Object.entries(data?.activity_suitability ?? {}).map(([key, a]) => (
                  <div key={key}>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-text-primary">{a.name}</span>
                      <Badge variant={scoreVariant(a.score)} size="sm">{a.score} · {a.status}</Badge>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-app-subtle">
                      <div className={`h-full rounded-full ${scoreBar(a.score)} transition-all duration-700`} style={{ width: `${a.score}%` }} />
                    </div>
                    {a.advisories?.[0] && <p className="mt-1 text-2xs text-text-muted">{a.advisories.join(' · ')}</p>}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="Last 7 days" subtitle="Resolved alerts" headerAction={<History className="h-4 w-4 text-text-muted" />}>
            {history.isLoading && <Skeleton className="h-24 w-full" />}
            {history.data && history.data.length === 0 && <p className="text-sm text-text-muted">No alerts in this period.</p>}
            <ul className="divide-y divide-border-subtle">
              {history.data?.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div>
                    <div className="text-sm text-text-primary">{h.title}</div>
                    <div className="text-2xs tabular-nums text-text-muted">
                      {new Date(h.date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })} · peak {h.peak_value}
                    </div>
                  </div>
                  <Badge variant={severityVariant(h.severity)} size="sm">{h.severity}</Badge>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
};
