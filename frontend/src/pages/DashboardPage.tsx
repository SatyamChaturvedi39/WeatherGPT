import React, { useState } from 'react';
import {
  Thermometer,
  CloudRain,
  Wind,
  Compass,
  AlertTriangle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from 'recharts';
import { useCurrentWeather, useForecast, useRiskAlerts, useForecastExplain } from '../hooks/useWeather';
import { StatTile } from '../components/ui/StatTile';
import { Badge } from '../components/ui/Badge';
import { Tooltip } from '../components/ui/Tooltip';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { Select } from '../components/ui/Select';
import { ErrorState } from '../components/ui/ErrorState';
import { PageHeader } from '../components/layout/PageHeader';
import {
  formatTemperature,
  formatPrecipitation,
  formatWindSpeed,
  formatPressure,
} from '../lib/formatters';

interface DashboardPageProps {
  location: { name: string; lat: number; lon: number };
  activity: string;
  onActivityChange: (activity: string) => void;
  temperatureUnit: 'celsius' | 'fahrenheit';
  precipitationUnit: 'mm' | 'inch';
  availableActivities: string[];
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  location,
  activity,
  onActivityChange,
  temperatureUnit,
  precipitationUnit,
  availableActivities,
}) => {
  const [horizon, setHorizon] = useState<number>(72);
  const [showDataTable, setShowDataTable] = useState<boolean>(false);

  const {
    data: current,
    isLoading: currentLoading,
    isError: currentError,
    refetch: refetchCurrent,
  } = useCurrentWeather(location.lat, location.lon);

  const {
    data: forecast,
    isLoading: forecastLoading,
    isError: forecastError,
    refetch: refetchForecast,
  } = useForecast(location.lat, location.lon, horizon);

  const {
    data: alerts,
    isLoading: alertsLoading,
    isError: alertsError,
    refetch: refetchAlerts,
  } = useRiskAlerts(location.lat, location.lon, activity);

  const {
    data: explain,
    isLoading: explainLoading,
  } = useForecastExplain(location.lat, location.lon, 'temperature_2m', 24);

  const handleRefreshAll = () => {
    refetchCurrent();
    refetchForecast();
    refetchAlerts();
  };

  // Safe metric values
  const tempFormatted = formatTemperature(current?.temperature_2m, temperatureUnit);
  const precipFormatted = formatPrecipitation(current?.precipitation, precipitationUnit);
  const windFormatted = formatWindSpeed(current?.wind_speed_10m, temperatureUnit);
  const pressureFormatted = formatPressure(current?.pressure_msl);

  // Trend vs 3 hours ago calculation (from intervals if available)
  let tempTrendText = 'Stable';
  let tempTrendDir: 'up' | 'down' | 'neutral' = 'neutral';
  if (forecast?.intervals && forecast.intervals.length >= 3 && current?.temperature_2m !== undefined) {
    const diff = forecast.intervals[2].temp_p50 - current.temperature_2m;
    if (Math.abs(diff) >= 0.5) {
      tempTrendText = `${diff > 0 ? '+' : ''}${diff.toFixed(1)}° in 3h`;
      tempTrendDir = diff > 0 ? 'up' : 'down';
    }
  }

  // Chart data mapping
  const chartData = (forecast?.intervals || []).map((interval, index) => {
    const d = new Date(interval.timestamp);
    const timeLabel = isNaN(d.getTime())
      ? `+${index + 1}h`
      : `${d.toLocaleDateString('en-US', { weekday: 'short' })} ${d.getHours()}:00`;

    // Temperature conversions for chart
    const toUserTemp = (val: number) =>
      temperatureUnit === 'fahrenheit' ? Math.round(((val * 9) / 5 + 32) * 10) / 10 : Math.round(val * 10) / 10;

    return {
      time: timeLabel,
      rawTime: interval.timestamp,
      isNow: index === 0,
      temp_p50: toUserTemp(interval.temp_p50),
      temp_p10: toUserTemp(interval.temp_p10),
      temp_p90: toUserTemp(interval.temp_p90),
      precip_amount: interval.precip_p50,
      precip_prob: Math.round(interval.precip_probability * 100),
    };
  });

  const topSHAPDrivers = (explain?.top_contributions || []).slice(0, 3).map((item) => {
    let plainLabel = item.display_name;
    if (item.feature.includes('pressure')) {
      plainLabel = item.value < 1010 ? 'Low pressure raises rain chance' : 'High pressure promotes stable skies';
    } else if (item.feature.includes('lag_24h')) {
      plainLabel = item.shap_value >= 0 ? 'Yesterday warmth carrying over' : 'Prior cool conditions persisting';
    } else if (item.feature.includes('sin_cos') || item.feature.includes('hour')) {
      plainLabel = 'Diurnal solar radiation cycle';
    } else if (item.feature.includes('humidity')) {
      plainLabel = item.value > 70 ? 'High humidity elevating dew point' : 'Dry air limiting cloud density';
    }
    return {
      ...item,
      plainLabel,
    };
  });

  return (
    <div className="space-y-6">
      {/* Page Title & Last Updated */}
      <PageHeader
        title={`Weather Overview — ${location.name}`}
        subtitle="Calibrated uncertainty forecasts and personalized outdoor activity guidance."
        updatedAt={current?.timestamp}
        onRefresh={handleRefreshAll}
        isRefreshing={currentLoading || forecastLoading}
      />

      {/* 1. Risk Summary Strip */}
      <div className="bg-app-surface border border-border-subtle rounded-card p-4 shadow-card">
        {alertsLoading ? (
          <div className="flex items-center justify-between">
            <div className="h-4 w-48 bg-border-subtle/70 animate-pulse rounded" />
            <div className="h-6 w-24 bg-border-subtle/70 animate-pulse rounded" />
          </div>
        ) : alertsError ? (
          <ErrorState compact message="Unable to evaluate activity risk." onRetry={refetchAlerts} />
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3">
              <Badge
                variant={
                  alerts?.risk_level === 'High'
                    ? 'risk-high'
                    : alerts?.risk_level === 'Moderate'
                    ? 'risk-moderate'
                    : 'risk-low'
                }
              >
                {alerts?.risk_level || 'Low'} Risk
              </Badge>

              <span className="text-sm text-text-primary font-medium">
                {alerts?.reason || 'Conditions are stable for outdoor plans.'}
              </span>

              {current?.is_anomaly && (
                <Badge variant="risk-high" icon={<AlertTriangle className="w-3 h-3 stroke-[2]" />}>
                  Atmospheric Anomaly
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-text-muted">Activity:</span>
              <Select
                sizeVariant="sm"
                value={activity}
                onChange={(e) => onActivityChange(e.target.value)}
                aria-label="Select outdoor activity"
              >
                {availableActivities.map((act) => (
                  <option key={act} value={act}>
                    {act.charAt(0).toUpperCase() + act.slice(1).replace('_', ' ')}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        )}
      </div>

      {/* 2. Current Conditions: 4 StatTiles (12-col grid, 3 cols each) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {currentError ? (
          <div className="col-span-full">
            <ErrorState compact message="Could not load current sensor readings." onRetry={refetchCurrent} />
          </div>
        ) : (
          <>
            <StatTile
              label="Temperature"
              value={tempFormatted.value}
              unit={tempFormatted.unit}
              trendText={tempTrendText}
              trendDirection={tempTrendDir}
              icon={<Thermometer className="w-4 h-4 stroke-[1.75]" />}
              loading={currentLoading}
            />
            <StatTile
              label="Precipitation"
              value={precipFormatted.value}
              unit={`${precipFormatted.unit}/h`}
              trendText={current?.precipitation && current.precipitation > 0 ? 'Active rain' : 'Dry'}
              trendDirection={current?.precipitation && current.precipitation > 0 ? 'up' : 'neutral'}
              icon={<CloudRain className="w-4 h-4 stroke-[1.75]" />}
              loading={currentLoading}
            />
            <StatTile
              label="Wind Speed"
              value={windFormatted.value}
              unit={windFormatted.unit}
              trendText="10m surface average"
              icon={<Wind className="w-4 h-4 stroke-[1.75]" />}
              loading={currentLoading}
            />
            <StatTile
              label="Barometric Pressure"
              value={pressureFormatted.value}
              unit={pressureFormatted.unit}
              trendText="Sea-level normalized"
              icon={<Compass className="w-4 h-4 stroke-[1.75]" />}
              loading={currentLoading}
            />
          </>
        )}
      </div>

      {/* 3 & 5. Forecast Chart (8 cols) + "Why this forecast" SHAP Drivers (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Forecast Chart Card (8 cols) */}
        <div className="lg:col-span-8 bg-app-surface border border-border-subtle rounded-card shadow-card p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-base font-semibold text-text-primary">Temperature forecast</h3>
                <Tooltip
                  content={
                    <span>
                      Median prediction (P50) with calibrated 80% likelihood envelope (P10 to P90),
                      computed via isotonic quantile calibration.
                    </span>
                  }
                />
              </div>
              <p className="text-xs text-text-secondary mt-0.5">
                Shaded area = 80% likely range
              </p>
            </div>

            <div className="flex items-center gap-2">
              <SegmentedControl
                size="sm"
                options={[
                  { value: 24, label: '24h' },
                  { value: 48, label: '48h' },
                  { value: 72, label: '72h' },
                ]}
                value={horizon}
                onChange={(val) => setHorizon(val)}
                ariaLabel="Forecast Horizon"
              />
              <button
                type="button"
                onClick={() => setShowDataTable((p) => !p)}
                className="text-2xs text-text-muted hover:text-text-primary underline focus-visible:outline-none ml-1"
                aria-expanded={showDataTable}
              >
                {showDataTable ? 'Hide data table' : 'Data table'}
              </button>
            </div>
          </div>

          {forecastLoading ? (
            <div className="h-64 flex flex-col items-center justify-center text-text-muted text-xs gap-2">
              <div className="h-4 w-48 bg-border-subtle/70 animate-pulse rounded" />
              <span>Calculating calibrated forecast distribution...</span>
            </div>
          ) : forecastError ? (
            <ErrorState message="Could not load forecast intervals." onRetry={refetchForecast} />
          ) : showDataTable ? (
            /* Accessible data-table fallback */
            <div className="max-h-64 overflow-y-auto border border-border-subtle rounded-input text-xs font-mono">
              <table className="w-full text-left" aria-label="Temperature Forecast Data Table">
                <thead className="bg-app-subtle border-b border-border-subtle text-text-secondary">
                  <tr>
                    <th className="py-2 px-3">Time</th>
                    <th className="py-2 px-3">Likely Low (P10)</th>
                    <th className="py-2 px-3">Median (P50)</th>
                    <th className="py-2 px-3">Likely High (P90)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle text-text-primary">
                  {chartData.map((row, i) => (
                    <tr key={i} className="hover:bg-app-subtle/50">
                      <td className="py-1.5 px-3">{row.time}</td>
                      <td className="py-1.5 px-3">{row.temp_p10}°</td>
                      <td className="py-1.5 px-3 font-semibold text-accent">{row.temp_p50}°</td>
                      <td className="py-1.5 px-3">{row.temp_p90}°</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={chartData}
                  margin={{ top: 8, right: 12, left: -16, bottom: 0 }}
                  accessibilityLayer
                >
                  <defs>
                    <linearGradient id="tempBandFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.04} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
                  <XAxis
                    dataKey="time"
                    stroke="var(--color-text-muted)"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--color-border-subtle)' }}
                  />
                  <YAxis
                    stroke="var(--color-text-muted)"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--color-border-subtle)' }}
                    unit={temperatureUnit === 'fahrenheit' ? '°F' : '°C'}
                    domain={['auto', 'auto']}
                  />
                  <RechartsTooltip
                    content={({ payload }) => {
                      if (!payload || !payload.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="floating-layer rounded-btn p-2.5 text-xs shadow-floating">
                          <div className="font-semibold text-text-primary mb-1">{d.time}</div>
                          <div className="text-text-secondary">
                            Median Forecast: <strong className="text-accent">{d.temp_p50}°</strong>
                          </div>
                          <div className="text-text-muted text-2xs mt-0.5">
                            80% range: {d.temp_p10}° to {d.temp_p90}°
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                    iconType="plainline"
                  />
                  <ReferenceLine
                    x={chartData[0]?.time}
                    stroke="var(--color-text-muted)"
                    strokeDasharray="2 2"
                    label={{ value: 'Now', position: 'top', fill: 'var(--color-text-muted)', fontSize: 10 }}
                  />
                  {/* P90 Upper & P10 Lower Bounds */}
                  <Area
                    type="monotone"
                    dataKey="temp_p90"
                    stroke="none"
                    fill="url(#tempBandFill)"
                    name="P90 Upper"
                  />
                  <Area
                    type="monotone"
                    dataKey="temp_p10"
                    stroke="none"
                    fill="var(--color-bg-surface)"
                    name="P10 Lower"
                  />
                  {/* Median P50 Line */}
                  <Line
                    type="monotone"
                    dataKey="temp_p50"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={false}
                    name="Median (P50)"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* 5. "Why this forecast" SHAP Drivers Card (4 cols) */}
        <div className="lg:col-span-4 bg-app-surface border border-border-subtle rounded-card shadow-card p-5">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-base font-semibold text-text-primary">Why this forecast</h3>
            <Tooltip
              content={
                <span>
                  Feature contributions calculated via SHAP TreeExplainer. Explains which factors
                  nudged the forecast above or below seasonal average.
                </span>
              }
            />
          </div>
          <p className="text-xs text-text-secondary mb-4">
            Top drivers influencing the current forecast
          </p>

          {explainLoading ? (
            <div className="space-y-3 py-2">
              <div className="h-8 w-full bg-border-subtle/70 animate-pulse rounded" />
              <div className="h-8 w-full bg-border-subtle/70 animate-pulse rounded" />
              <div className="h-8 w-full bg-border-subtle/70 animate-pulse rounded" />
            </div>
          ) : topSHAPDrivers.length > 0 ? (
            <div className="space-y-3.5">
              {topSHAPDrivers.map((driver, index) => {
                const isPositive = driver.shap_value >= 0;
                return (
                  <div key={index} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-text-primary font-medium truncate mr-2">
                        {driver.plainLabel}
                      </span>
                      <span
                        className={`text-2xs font-mono font-medium shrink-0 ${
                          isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-text-muted'
                        }`}
                      >
                        {isPositive ? `+${driver.shap_value.toFixed(1)}°` : `${driver.shap_value.toFixed(1)}°`}
                      </span>
                    </div>

                    {/* Proportional attribution bar */}
                    <div className="h-1.5 w-full bg-app-subtle rounded-full overflow-hidden flex">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isPositive ? 'bg-emerald-500' : 'bg-slate-400 dark:bg-slate-500'
                        }`}
                        style={{
                          width: `${Math.min(100, Math.max(15, Math.abs(driver.shap_value) * 35))}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}

              <div className="pt-2 mt-4 border-t border-border-subtle text-2xs text-text-muted">
                Observed conditions align with expected atmospheric progression.
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-text-muted">
              Attribution telemetry is updating...
            </div>
          )}
        </div>
      </div>

      {/* 4. Precipitation: probability bars by hour + expected amount */}
      <div className="bg-app-surface border border-border-subtle rounded-card shadow-card p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-base font-semibold text-text-primary">Precipitation probability & rate</h3>
            <p className="text-xs text-text-secondary mt-0.5">
              Hourly rain probability (%) alongside expected precipitation amount ({precipitationUnit}/h)
            </p>
          </div>
        </div>

        {forecastLoading ? (
          <div className="h-44 flex items-center justify-center text-xs text-text-muted">
            Loading precipitation projections...
          </div>
        ) : (
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartData}
                margin={{ top: 8, right: 12, left: -16, bottom: 0 }}
                accessibilityLayer
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
                <XAxis
                  dataKey="time"
                  stroke="var(--color-text-muted)"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--color-border-subtle)' }}
                />
                <YAxis
                  yAxisId="amount"
                  stroke="var(--color-text-muted)"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--color-border-subtle)' }}
                  unit={precipitationUnit}
                />
                <YAxis
                  yAxisId="prob"
                  orientation="right"
                  stroke="var(--color-text-muted)"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--color-border-subtle)' }}
                  unit="%"
                  domain={[0, 100]}
                />
                <RechartsTooltip
                  content={({ payload }) => {
                    if (!payload || !payload.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="floating-layer rounded-btn p-2.5 text-xs shadow-floating">
                        <div className="font-semibold text-text-primary mb-1">{d.time}</div>
                        <div className="text-text-secondary">
                          Rain Probability: <strong>{d.precip_prob}%</strong>
                        </div>
                        <div className="text-text-muted text-2xs mt-0.5">
                          Expected Amount: {d.precip_amount} {precipitationUnit}/h
                        </div>
                      </div>
                    );
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Bar
                  yAxisId="prob"
                  dataKey="precip_prob"
                  fill="var(--color-accent)"
                  opacity={0.35}
                  name="Rain Chance (%)"
                  radius={[4, 4, 0, 0]}
                />
                <Line
                  yAxisId="amount"
                  type="monotone"
                  dataKey="precip_amount"
                  stroke="#0284c7"
                  strokeWidth={2}
                  dot={false}
                  name={`Expected (${precipitationUnit})`}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};
