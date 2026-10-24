import React, { useState } from 'react';
import { Info, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Cell,
  ReferenceLine,
} from 'recharts';
import { useForecastExplain } from '../hooks/useWeather';
import { Card } from '../components/ui/Card';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { Select } from '../components/ui/Select';
import { Tooltip } from '../components/ui/Tooltip';
import { ErrorState } from '../components/ui/ErrorState';
import { Skeleton } from '../components/ui/Skeleton';
import { PageHeader } from '../components/layout/PageHeader';

interface ExplainabilityPageProps {
  location: { name: string; lat: number; lon: number };
}

export const ExplainabilityPage: React.FC<ExplainabilityPageProps> = ({ location }) => {
  const [variable, setVariable] = useState<string>('temperature_2m');
  const [horizon, setHorizon] = useState<number>(24);

  const {
    data: explain,
    isLoading,
    isError,
    refetch,
  } = useForecastExplain(location.lat, location.lon, variable, horizon);

  const chartData = (explain?.top_contributions || []).map((c) => ({
    name: c.display_name,
    shap: c.shap_value,
    featureValue: c.value,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Forecast Explainability — ${location.name}`}
        subtitle="Transparent machine learning attributions using SHAP TreeExplainer on atmospheric models."
        onRefresh={() => refetch()}
        isRefreshing={isLoading}
      />

      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-app-surface border border-border-subtle rounded-card p-4 shadow-card">
        <div className="flex items-center gap-3">
          <Select
            label="Target variable:"
            sizeVariant="sm"
            value={variable}
            onChange={(e) => setVariable(e.target.value)}
          >
            <option value="temperature_2m">Temperature (°C)</option>
            <option value="precipitation">Precipitation (mm)</option>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted">Prediction horizon:</span>
          <SegmentedControl
            size="sm"
            options={[
              { value: 6, label: '+6h' },
              { value: 24, label: '+24h' },
              { value: 48, label: '+48h' },
            ]}
            value={horizon}
            onChange={(h) => setHorizon(h)}
          />
        </div>
      </div>

      {isError ? (
        <ErrorState
          title="Could not calculate feature attributions"
          message="Failed to generate SHAP explanation values for this location."
          onRetry={refetch}
        />
      ) : (
        <>
          {/* Plain language summary card */}
          <div className="bg-app-surface border-l-4 border-l-accent border-y border-r border-border-subtle rounded-card p-4 shadow-card">
            <div className="flex items-start gap-3">
              <Info className="w-4 h-4 text-accent shrink-0 mt-0.5 stroke-[1.75]" />
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm text-text-primary">
                    Why this forecast? (+{horizon}h {variable === 'temperature_2m' ? 'Temperature' : 'Precipitation'})
                  </h3>
                  <Tooltip
                    content={
                      <span>
                        Calculated by computing Shapley values comparing the local ensemble prediction
                        against the seasonal climatology baseline.
                      </span>
                    }
                  />
                </div>
                {isLoading ? (
                  <Skeleton className="h-4 w-3/4" />
                ) : (
                  <p className="text-xs text-text-secondary leading-relaxed">
                    {explain?.explanation_summary || 'Local weather persistence drives the primary forecast trend.'}
                  </p>
                )}
                {explain && (
                  <div className="flex items-center gap-4 text-2xs font-mono text-text-muted pt-2 border-t border-border-subtle mt-2">
                    <span>Base Value: <strong className="text-text-primary">{explain.base_value}°C</strong></span>
                    <span>Prediction: <strong className="text-accent">{explain.predicted_value}°C</strong></span>
                    <span>
                      Net Impact: <strong className={explain.predicted_value >= explain.base_value ? 'text-emerald-600 dark:text-emerald-400' : 'text-text-muted'}>
                        {(explain.predicted_value - explain.base_value).toFixed(2)}
                      </strong>
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Attribution Chart */}
          <Card
            title="Feature Attribution Breakdown"
            subtitle="Positive values push the forecast higher than seasonal baseline; negative values lower it."
          >
            {isLoading ? (
              <div className="h-64 flex flex-col items-center justify-center text-xs text-text-muted gap-2">
                <div className="h-4 w-40 bg-border-subtle/70 animate-pulse rounded" />
                <span>Computing SHAP Shapley values...</span>
              </div>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={chartData}
                    margin={{ top: 8, right: 24, left: 90, bottom: 0 }}
                  >
                    <XAxis
                      type="number"
                      stroke="var(--color-text-muted)"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: 'var(--color-border-subtle)' }}
                    />
                    <YAxis
                      dataKey="name"
                      type="category"
                      stroke="var(--color-text-secondary)"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: 'var(--color-border-subtle)' }}
                      width={130}
                    />
                    <RechartsTooltip
                      content={({ payload }) => {
                        if (!payload || !payload.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div className="floating-layer rounded-btn p-2.5 text-xs shadow-floating">
                            <div className="font-semibold text-text-primary mb-1">{d.name}</div>
                            <div className="text-text-secondary">
                              Observed Input: <span className="font-mono text-text-primary">{d.featureValue}</span>
                            </div>
                            <div className="text-text-muted text-2xs mt-0.5">
                              SHAP Impact:{' '}
                              <strong className={d.shap >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-text-secondary'}>
                                {d.shap > 0 ? `+${d.shap}` : d.shap}
                              </strong>
                            </div>
                          </div>
                        );
                      }}
                    />
                    <ReferenceLine x={0} stroke="var(--color-border-default)" strokeDasharray="2 2" />
                    <Bar dataKey="shap" radius={[0, 4, 4, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.shap >= 0 ? '#10b981' : '#64748b'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          {/* Feature Contribution Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {explain?.top_contributions.map((c, i) => (
              <div
                key={i}
                className="bg-app-surface border border-border-subtle rounded-card p-4 shadow-card flex items-center justify-between"
              >
                <div>
                  <div className="text-sm font-medium text-text-primary">{c.display_name}</div>
                  <div className="text-2xs text-text-muted mt-0.5 font-mono">
                    Key: {c.feature} • Value: {c.value}
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={`flex items-center justify-end gap-0.5 font-mono font-semibold text-sm ${
                      c.shap_value >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-text-muted'
                    }`}
                  >
                    {c.shap_value >= 0 ? (
                      <ArrowUpRight className="w-3.5 h-3.5 stroke-[2]" />
                    ) : (
                      <ArrowDownRight className="w-3.5 h-3.5 stroke-[2]" />
                    )}
                    {c.shap_value > 0 ? `+${c.shap_value.toFixed(2)}` : c.shap_value.toFixed(2)}
                  </div>
                  <span className="text-2xs text-text-muted capitalize">
                    {c.impact.replace('_', ' ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
