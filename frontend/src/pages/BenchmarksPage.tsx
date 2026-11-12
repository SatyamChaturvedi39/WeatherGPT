import React from 'react';
import { Database, Target, CloudRain, Sigma } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  LineChart,
  Line,
} from 'recharts';
import { PageHeader } from '../components/layout/PageHeader';
import { Card } from '../components/ui/Card';
import { StatTile } from '../components/ui/StatTile';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';
import { useBenchmarks } from '../hooks/useWeather';

const axis = { stroke: 'var(--color-text-muted)', tick: { fontSize: 11 }, tickLine: false, axisLine: false } as const;
const tooltipStyle = {
  contentStyle: {
    background: 'var(--color-bg-elevated)',
    border: '1px solid var(--color-border-default)',
    borderRadius: 8,
    fontSize: 12,
  },
};

const fmt = (n: unknown, d = 2) => (typeof n === 'number' ? n.toFixed(d) : String(n ?? '—'));
const num = (n: unknown) => (typeof n === 'number' ? n.toLocaleString() : String(n ?? '—'));

export const BenchmarksPage: React.FC = () => {
  const { data, isLoading, isError, refetch } = useBenchmarks();

  if (isError) {
    return (
      <div className="space-y-6">
        <PageHeader title="Model Benchmarks" />
        <ErrorState message="Could not load benchmark results." onRetry={() => refetch()} />
      </div>
    );
  }

  const ds = data?.dataset_summary ?? {};
  const precip = data?.precipitation_classification_benchmark ?? {};
  const uq = data?.uncertainty_quantification;
  const temp = data?.temperature_forecasting_benchmark ?? [];
  const shap = (data?.top_shap_features ?? []).slice(0, 8);
  const maxShap = Math.max(0.001, ...shap.map((s) => s.mean_abs_shap));
  const calib = (data?.calibration_curve ?? []).map((c) => ({
    nominal: c.nominal_quantile,
    empirical: c.empirical_coverage,
    ideal: c.nominal_quantile,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Model Benchmarks"
        subtitle="Reproducible chronological hold-out evaluation of XGBoost against persistence and climatology baselines."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile loading={isLoading} label="Training records" value={num(ds.total_supervised_records)} icon={<Database className="h-4 w-4" />} trendText={ds.observation_period} />
        <StatTile loading={isLoading} label="T+1h MAE (XGBoost)" value={fmt(temp[0]?.xgboost_mae)} unit="°C" icon={<Target className="h-4 w-4" />} trendText={`${fmt(temp[0]?.xgboost_gain_vs_persistence_pct, 1)}% better than persistence`} />
        <StatTile loading={isLoading} label="Rain Brier score" value={fmt(precip.xgboost_brier_score, 3)} icon={<CloudRain className="h-4 w-4" />} trendText={`${fmt(precip.brier_score_improvement_pct, 1)}% vs climatology · AUC ${fmt(precip.xgboost_roc_auc, 3)}`} />
        <StatTile loading={isLoading} label="Conformal coverage" value={fmt(uq?.split_conformal_calibration.calibrated_coverage_pct, 1)} unit="%" icon={<Sigma className="h-4 w-4" />} trendText={`target ${fmt(uq?.split_conformal_calibration.nominal_coverage_target_pct, 0)}% · width ${fmt(uq?.split_conformal_calibration.calibrated_mean_interval_width_c)}°C`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-7" title="Temperature MAE by horizon" subtitle="Lower is better (°C)">
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={temp} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
                  <XAxis dataKey="horizon" {...axis} />
                  <YAxis {...axis} />
                  <RechartsTooltip {...tooltipStyle} cursor={{ fill: 'var(--color-bg-subtle)' }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="persistence_mae" name="Persistence" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="climatology_mae" name="Climatology" fill="#93c5fd" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="xgboost_mae" name="XGBoost" fill="#3563f0" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card className="lg:col-span-5" title="Quantile calibration" subtitle="Empirical vs nominal coverage — closer to the diagonal is better">
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={calib} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" />
                  <XAxis dataKey="nominal" {...axis} type="number" domain={[0, 1]} />
                  <YAxis {...axis} domain={[0, 1]} />
                  <RechartsTooltip {...tooltipStyle} />
                  <Line dataKey="ideal" name="Ideal" stroke="var(--color-text-muted)" strokeDasharray="4 4" dot={false} />
                  <Line dataKey="empirical" name="Empirical" stroke="#3563f0" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-7" title="Model comparison">
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-subtle text-left text-2xs uppercase tracking-wide text-text-muted">
                    <th className="py-2 pr-3 font-medium">Model</th>
                    <th className="py-2 pr-3 text-right font-medium">MAE 1h</th>
                    <th className="py-2 pr-3 text-right font-medium">MAE 6h</th>
                    <th className="py-2 pr-3 text-right font-medium">MAE 24h</th>
                    <th className="py-2 text-right font-medium">Brier</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {(data?.model_comparison ?? []).map((m) => (
                    <tr key={String(m.model)} className="border-b border-border-subtle last:border-0">
                      <td className="py-2 pr-3 text-text-primary">{String(m.model)}</td>
                      <td className="py-2 pr-3 text-right text-text-secondary">{fmt(m.mae_1h)}</td>
                      <td className="py-2 pr-3 text-right text-text-secondary">{fmt(m.mae_6h)}</td>
                      <td className="py-2 pr-3 text-right text-text-secondary">{fmt(m.mae_24h)}</td>
                      <td className="py-2 text-right text-text-secondary">{fmt(m.brier_score_rain, 3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="lg:col-span-5" title="Top SHAP features" subtitle="Mean |φ| across the test set">
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <div className="space-y-2.5">
              {shap.map((s) => (
                <div key={s.feature}>
                  <div className="mb-0.5 flex justify-between text-xs">
                    <span className="font-mono text-text-secondary">{s.feature}</span>
                    <span className="tabular-nums text-text-primary">{s.mean_abs_shap.toFixed(3)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-app-subtle">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${(s.mean_abs_shap / maxShap) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card title="Feature ablation study" subtitle="How each feature layer changes MAE">
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-subtle text-left text-2xs uppercase tracking-wide text-text-muted">
                  <th className="py-2 pr-3 font-medium">Configuration</th>
                  <th className="py-2 pr-3 text-right font-medium">Features</th>
                  <th className="py-2 pr-3 text-right font-medium">MAE 1h</th>
                  <th className="py-2 pr-3 text-right font-medium">MAE 6h</th>
                  <th className="py-2 pr-3 text-right font-medium">MAE 24h</th>
                  <th className="py-2 font-medium">Result</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {(data?.ablation_study ?? []).map((a) => (
                  <tr key={a.configuration} className="border-b border-border-subtle last:border-0">
                    <td className="py-2 pr-3 text-text-primary">{a.configuration}</td>
                    <td className="py-2 pr-3 text-right text-text-secondary">{a.features_count}</td>
                    <td className="py-2 pr-3 text-right text-text-secondary">{fmt(a.mae_1h)}</td>
                    <td className="py-2 pr-3 text-right text-text-secondary">{fmt(a.mae_6h)}</td>
                    <td className="py-2 pr-3 text-right text-text-secondary">{fmt(a.mae_24h)}</td>
                    <td className="py-2"><Badge size="sm">{a.improvement}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {ds.evaluation_methodology && (
        <p className="text-2xs leading-relaxed text-text-muted">
          {ds.evaluation_methodology} · Split {ds.train_val_test_split} · Source: {ds.source}
        </p>
      )}
    </div>
  );
};
