import React, { useMemo, useState } from 'react';
import { Mountain, Droplets, Wind, Umbrella, MapPinned } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { Card } from '../components/ui/Card';
import { StatTile } from '../components/ui/StatTile';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { useMicroclimates } from '../hooks/useWeather';
import { riskColor, severityVariant } from '../lib/severity';
import type { Microclimate } from '../types/extra';

const RISK_ORDER = ['Critical', 'Severe', 'High', 'Moderate', 'Elevated', 'Low', 'Minimal'];
const rank = (r: string) => {
  const i = RISK_ORDER.findIndex((x) => x.toLowerCase() === r.toLowerCase());
  return i === -1 ? RISK_ORDER.length : i;
};

function ZoneMap({ zones, selected, onSelect }: { zones: Microclimate[]; selected: string | null; onSelect: (id: string) => void }) {
  const bounds = useMemo(() => {
    const lats = zones.map((z) => z.latitude);
    const lons = zones.map((z) => z.longitude);
    const pad = 0.015;
    return { minLat: Math.min(...lats) - pad, maxLat: Math.max(...lats) + pad, minLon: Math.min(...lons) - pad, maxLon: Math.max(...lons) + pad };
  }, [zones]);
  const W = 600;
  const H = 480;
  const x = (lon: number) => ((lon - bounds.minLon) / (bounds.maxLon - bounds.minLon)) * W;
  const y = (lat: number) => H - ((lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * H;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full rounded-btn bg-app-subtle" role="img" aria-label="Bengaluru microclimate zones by flood risk">
      {[0.25, 0.5, 0.75].map((f) => (
        <g key={f} stroke="var(--color-border-subtle)" strokeDasharray="3 5">
          <line x1={0} x2={W} y1={H * f} y2={H * f} />
          <line y1={0} y2={H} x1={W * f} x2={W * f} />
        </g>
      ))}
      {zones.map((z) => {
        const active = z.id === selected;
        const r = 7 + Math.min(10, z.rain_probability / 10);
        return (
          <g key={z.id} transform={`translate(${x(z.longitude)},${y(z.latitude)})`} className="cursor-pointer" onClick={() => onSelect(z.id)}>
            <circle r={r + 8} fill={riskColor(z.flood_risk)} opacity={active ? 0.25 : 0.12} />
            <circle r={r} fill={riskColor(z.flood_risk)} stroke="white" strokeWidth={active ? 3 : 1.5} />
            <text y={-r - 6} textAnchor="middle" className="fill-[var(--color-text-secondary)] text-[11px] font-medium" style={{ paintOrder: 'stroke', stroke: 'var(--color-bg-subtle)', strokeWidth: 3 }}>
              {z.name.length > 16 ? `${z.name.slice(0, 15)}…` : z.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export const MicroclimatesPage: React.FC = () => {
  const { data, isLoading, isError, refetch, dataUpdatedAt, isFetching } = useMicroclimates();
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState<string | null>(null);

  const zones = useMemo(() => [...(data ?? [])].sort((a, b) => rank(a.flood_risk) - rank(b.flood_risk)), [data]);
  const shown = zones.filter((z) =>
    filter === 'all' ? true : filter === 'high' ? rank(z.flood_risk) <= 2 : rank(z.flood_risk) > 2
  );
  const sel = zones.find((z) => z.id === selected) ?? zones[0];

  const temps = zones.map((z) => z.temperature);
  const spread = temps.length ? Math.max(...temps) - Math.min(...temps) : 0;
  const highRisk = zones.filter((z) => rank(z.flood_risk) <= 2).length;
  const raincoats = zones.filter((z) => z.raincoat_recommended).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bengaluru Microclimates"
        subtitle="Lapse-rate downscaled conditions per zone, with historical stormwater drainage vulnerability."
        updatedAt={dataUpdatedAt ? new Date(dataUpdatedAt) : null}
        onRefresh={() => refetch()}
        isRefreshing={isFetching}
      />

      {isError && <ErrorState message="Could not load microclimate zones." onRetry={() => refetch()} />}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile loading={isLoading} label="Zones monitored" value={zones.length} icon={<MapPinned className="h-4 w-4" />} trendText="Bengaluru registry" />
        <StatTile loading={isLoading} label="City temp spread" value={spread.toFixed(1)} unit="°C" icon={<Mountain className="h-4 w-4" />} trendText="elevation + urban heat" />
        <StatTile loading={isLoading} label="High flood-risk zones" value={highRisk} icon={<Droplets className="h-4 w-4" />} trendText="critical / severe / high" />
        <StatTile loading={isLoading} label="Raincoat advised" value={raincoats} unit={`of ${zones.length}`} icon={<Umbrella className="h-4 w-4" />} trendText="zones right now" />
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-7" title="Zone map" subtitle="Dot colour = flood vulnerability · dot size = rain probability">
          {isLoading ? <Skeleton className="h-80 w-full" /> : <ZoneMap zones={zones} selected={sel?.id ?? null} onSelect={setSelected} />}
          <div className="mt-3 flex flex-wrap gap-3 text-2xs text-text-muted">
            {['Critical', 'Severe', 'High', 'Moderate', 'Low'].map((r) => (
              <span key={r} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: riskColor(r) }} /> {r}
              </span>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-5" title={sel?.name ?? 'Zone detail'} subtitle={sel?.zone}>
          {sel ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant={severityVariant(sel.flood_risk)}>Flood risk: {sel.flood_risk}</Badge>
                {sel.raincoat_recommended && <Badge variant="info">Raincoat advised</Badge>}
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ['Temperature', `${sel.temperature.toFixed(1)}°C`],
                  ['Humidity', `${sel.humidity}%`],
                  ['Rain chance', `${sel.rain_probability}%`],
                  ['Rain rate', `${sel.precipitation_rate} mm/h`],
                  ['Elevation', `${sel.elevation} m (${sel.elevation_delta_m > 0 ? '+' : ''}${sel.elevation_delta_m})`],
                  ['AQI', String(sel.aqi)],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-btn bg-app-subtle px-3 py-2">
                    <div className="text-2xs text-text-muted">{k}</div>
                    <div className="font-semibold tabular-nums text-text-primary">{v}</div>
                  </div>
                ))}
              </div>
              <div>
                <div className="mb-1 text-xs font-medium text-text-secondary">Drainage chokepoints</div>
                {sel.chokepoints.length === 0 && <p className="text-sm text-text-muted">None recorded for this zone.</p>}
                <ul className="space-y-1 text-sm text-text-secondary">
                  {sel.chokepoints.map((c) => (
                    <li key={c} className="flex items-center gap-2"><Wind className="h-3.5 w-3.5 text-text-muted" />{c}</li>
                  ))}
                </ul>
              </div>
              <p className="text-2xs leading-relaxed text-text-muted">{sel.condition} · {sel.hazard_classification}</p>
            </div>
          ) : (
            <Skeleton className="h-64 w-full" />
          )}
        </Card>
      </div>

      <Card
        title="All zones"
        headerAction={
          <SegmentedControl
            options={[
              { label: 'All', value: 'all' },
              { label: 'High risk', value: 'high' },
              { label: 'Lower risk', value: 'low' },
            ]}
            value={filter}
            onChange={setFilter}
          />
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((z) => (
            <button
              key={z.id}
              type="button"
              onClick={() => setSelected(z.id)}
              className={`rounded-card border p-3 text-left transition-colors hover:border-accent ${z.id === sel?.id ? 'border-accent bg-accent-subtle' : 'border-border-subtle bg-app-subtle'}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-medium text-text-primary">{z.name}</div>
                  <div className="text-2xs text-text-muted">{z.zone}</div>
                </div>
                <Badge size="sm" variant={severityVariant(z.flood_risk)}>{z.flood_risk}</Badge>
              </div>
              <div className="mt-2 flex gap-4 text-xs tabular-nums text-text-secondary">
                <span>{z.temperature.toFixed(1)}°</span>
                <span>{z.rain_probability}% rain</span>
                <span>AQI {z.aqi}</span>
              </div>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
};
