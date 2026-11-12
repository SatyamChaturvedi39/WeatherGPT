import React from 'react';
import { Target } from 'lucide-react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card } from '../ui/Card';
import { Skeleton } from '../ui/Skeleton';
import { useForecastVerification } from '../../hooks/useWeather';
import { formatNumber } from '../../lib/formatters';
import type { VerificationModelStats } from '../../types/extra';

const MODEL_LABEL: Record<string, string> = {
  xgboost_blend: 'WeatherGPT (XGBoost blend)',
  persistence: 'Persistence (same as now)',
  open_meteo_nwp: 'Open-Meteo forecast',
};

const MODEL_COLOR: Record<string, string> = {
  xgboost_blend: '#2563eb',
  persistence: '#9ca3af',
  open_meteo_nwp: '#f59e0b',
};

const signed = (v: number | null) => (v == null ? '—' : `${v > 0 ? '+' : ''}${formatNumber(v, 2)}`);

export const ForecastVerificationCard: React.FC = () => {
  const { data, isLoading, isError } = useForecastVerification();
  const verified = data?.models.reduce((n, m) => Math.max(n, m.n), 0) ?? 0;
  const best = data?.models
    .filter((m): m is VerificationModelStats & { mae: number } => m.mae != null)
    .sort((a, b) => a.mae - b.mae)[0];
  const chart = (data?.recent ?? []).map((r) => ({
    time: new Date(r.target_time * 1000).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit' }),
    actual: r.actual,
    xgboost_blend: r.xgboost_blend ?? null,
    persistence: r.persistence ?? null,
    open_meteo_nwp: r.open_meteo_nwp ?? null,
  }));

  return (
    <Card
      title="Live forecast accuracy (T+24h)"
      subtitle={`Forecasts issued by this server, scored once the target hour has passed · last ${data?.window_days ?? 30} days`}
      headerAction={<Target className="h-4 w-4 text-text-muted" />}
    >
      {isLoading && <Skeleton className="h-40 w-full" />}
      {isError && <p className="text-sm text-text-muted">Could not load verification data.</p>}
      {data && (
        <div className="space-y-4">
          {verified === 0 ? (
            <p className="rounded-btn bg-app-subtle px-3 py-2.5 text-sm text-text-secondary">
              No forecasts verified yet. Forecasts are logged hourly; the first ones can be scored 24 hours after they are
              issued. {data.pending > 0 && <span className="tabular-nums">{data.pending} waiting.</span>}
            </p>
          ) : (
            best && (
              <p className="text-sm text-text-secondary">
                Most accurate so far: <strong className="text-text-primary">{MODEL_LABEL[best.model] ?? best.model}</strong>{' '}
                ({formatNumber(best.mae, 2)} °C mean error over {best.n} forecasts).
              </p>
            )
          )}

          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-left text-xs" aria-label="Live forecast accuracy by model">
              <thead className="bg-app-subtle border-y border-border-subtle text-text-secondary font-medium">
                <tr>
                  <th className="py-2.5 px-5">Model</th>
                  <th className="py-2.5 px-5 tabular-nums">Verified</th>
                  <th className="py-2.5 px-5 tabular-nums">MAE (°C)</th>
                  <th className="py-2.5 px-5 tabular-nums">RMSE (°C)</th>
                  <th className="py-2.5 px-5 tabular-nums">Bias (°C)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle text-text-primary">
                {data.models.map((m) => (
                  <tr key={m.model}>
                    <td className="py-2.5 px-5 font-medium">
                      <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: MODEL_COLOR[m.model] }} />
                      {MODEL_LABEL[m.model] ?? m.model}
                    </td>
                    <td className="py-2.5 px-5 font-mono tabular-nums">{m.n}</td>
                    <td className="py-2.5 px-5 font-mono tabular-nums">{m.mae == null ? '—' : formatNumber(m.mae, 2)}</td>
                    <td className="py-2.5 px-5 font-mono tabular-nums">{m.rmse == null ? '—' : formatNumber(m.rmse, 2)}</td>
                    <td className="py-2.5 px-5 font-mono tabular-nums">{signed(m.bias)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {chart.length > 1 && (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chart} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid stroke="var(--color-border-subtle)" strokeDasharray="3 4" vertical={false} />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} minTickGap={24} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} unit="°" domain={['auto', 'auto']} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line dataKey="actual" name="Actual" stroke="var(--color-text-primary)" strokeWidth={2} dot={false} />
                {(['xgboost_blend', 'open_meteo_nwp', 'persistence'] as const).map((k) => (
                  <Line key={k} dataKey={k} name={MODEL_LABEL[k]} stroke={MODEL_COLOR[k]} strokeWidth={1.5} dot={false} strokeDasharray={k === 'persistence' ? '4 3' : undefined} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}

          <p className="text-2xs text-text-muted">
            Truth: {data.truth_source}. {data.pending} forecasts waiting for their target hour · {data.locations} location(s).
          </p>
        </div>
      )}
    </Card>
  );
};
