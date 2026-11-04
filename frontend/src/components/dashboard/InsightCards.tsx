import React from 'react';
import { Leaf, Cpu, AlertCircle } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Skeleton } from '../ui/Skeleton';
import { useAirQuality, useMlPrediction } from '../../hooks/useWeather';
import { severityVariant } from '../../lib/severity';

interface Loc {
  lat: number;
  lon: number;
}

const aqiVariant = (aqi: number) => (aqi <= 50 ? 'risk-low' : aqi <= 100 ? 'risk-moderate' : 'risk-high');

export const AirQualityCard: React.FC<Loc> = ({ lat, lon }) => {
  const { data, isLoading, isError } = useAirQuality(lat, lon);
  return (
    <Card title="Air quality" subtitle="US AQI · Open-Meteo air-quality model" headerAction={<Leaf className="h-4 w-4 text-text-muted" />}>
      {isLoading && <Skeleton className="h-28 w-full" />}
      {isError && <p className="text-sm text-text-muted">Air-quality data unavailable.</p>}
      {data && (
        <div className="space-y-3">
          <div className="flex items-end gap-3">
            <span className="text-stat font-semibold tabular-nums text-text-primary">{data.aqi}</span>
            <Badge variant={aqiVariant(data.aqi)} size="sm">{data.category}</Badge>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gradient-to-r from-emerald-400 via-amber-400 to-red-500">
            <div className="relative h-full" style={{ width: `${Math.min(100, (data.aqi / 300) * 100)}%` }}>
              <span className="absolute -right-1 top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full border-2 border-white bg-text-primary shadow" />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              ['PM2.5', data.pm2_5],
              ['PM10', data.pm10],
              ['NO₂', data.nitrogen_dioxide],
              ['O₃', data.ozone],
            ].map(([k, v]) => (
              <div key={String(k)} className="rounded-btn bg-app-subtle py-1.5">
                <div className="text-2xs text-text-muted">{k}</div>
                <div className="text-sm font-semibold tabular-nums text-text-primary">{Number(v).toFixed(0)}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-text-secondary">{data.health_advisory}</p>
        </div>
      )}
    </Card>
  );
};

export const MlPredictionCard: React.FC<Loc> = ({ lat, lon }) => {
  const { data, isLoading, isError, error } = useMlPrediction(lat, lon);
  return (
    <Card title="XGBoost T+24h prediction" subtitle="WeatherGPT's own trained models, with conformal interval" headerAction={<Cpu className="h-4 w-4 text-text-muted" />}>
      {isLoading && <Skeleton className="h-28 w-full" />}
      {isError && (
        <div className="flex items-start gap-2 rounded-btn bg-app-subtle p-3 text-xs text-text-secondary">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" />
          <span>
            {(error as Error)?.message || 'Model unavailable.'} The backend needs <code>xgboost</code> and <code>shap</code> installed to load
            the trained artifacts.
          </span>
        </div>
      )}
      {data && (
        <div className="space-y-3">
          <div className="flex items-end gap-2">
            <span className="text-stat font-semibold tabular-nums text-text-primary">{data.point_temperature_c.toFixed(1)}</span>
            <span className="pb-1 text-xs text-text-muted">°C tomorrow, this hour</span>
          </div>
          <div className="rounded-btn bg-app-subtle p-3 text-xs text-text-secondary">
            80% interval{' '}
            <strong className="tabular-nums text-text-primary">
              {data.split_conformal_interval_80.calibrated_lower_c.toFixed(1)}° – {data.split_conformal_interval_80.calibrated_upper_c.toFixed(1)}°
            </strong>{' '}
            · {data.split_conformal_interval_80.calibrated_empirical_coverage_pct}% tested coverage
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-secondary">Rain in next 24h</span>
            <span className="flex items-center gap-2">
              <strong className="tabular-nums text-text-primary">{data.precipitation_risk_24h.rain_probability_pct}%</strong>
              <Badge size="sm" variant={severityVariant(data.precipitation_risk_24h.risk_category.split(' ')[0])}>
                {data.precipitation_risk_24h.risk_category}
              </Badge>
            </span>
          </div>
          {data.is_fallback && <p className="text-2xs text-text-muted">Some input lags were imputed (fallback values used).</p>}
        </div>
      )}
    </Card>
  );
};
