import React, { useEffect, useMemo, useState } from 'react';
import { Waves, Clock, Layers, FlaskConical, Users } from 'lucide-react';
import { Area, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import { PageHeader } from '../components/layout/PageHeader';
import { Card } from '../components/ui/Card';
import { StatTile } from '../components/ui/StatTile';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { useFloodTwin } from '../hooks/useWeather';
import { CrowdReportPanel } from '../components/flood/CrowdReportPanel';
import type { BadgeVariant } from '../components/ui/Badge';
import type { FloodLevel, FloodZone } from '../types/extra';

const HORIZON = 6;

const SCENARIOS = [
  { label: 'Live forecast', value: 0 },
  { label: '+15 mm', value: 15 },
  { label: '+30 mm', value: 30 },
  { label: '+60 mm', value: 60 },
];

const LEVEL_VARIANT: Record<FloodLevel, BadgeVariant> = {
  Clear: 'risk-low',
  Watch: 'risk-moderate',
  Warning: 'risk-high',
  Severe: 'risk-high',
};

/** Waterlogging probability -> heat colour (green → amber → red → deep red). */
function heat(p: number): string {
  const stops: [number, [number, number, number]][] = [
    [0, [16, 185, 129]],
    [0.2, [245, 158, 11]],
    [0.5, [249, 115, 22]],
    [0.8, [220, 38, 38]],
    [1, [127, 29, 29]],
  ];
  for (let i = 1; i < stops.length; i++) {
    const [p1, c1] = stops[i];
    const [p0, c0] = stops[i - 1];
    if (p <= p1) {
      const t = (p - p0) / (p1 - p0);
      const c = c0.map((v, k) => Math.round(v + (c1[k] - v) * t));
      return `rgb(${c[0]},${c[1]},${c[2]})`;
    }
  }
  return 'rgb(127,29,29)';
}

const hourLabel = (iso?: string) => (iso ? iso.split('T')[1]?.slice(0, 5) ?? iso : '');
const pct = (p: number) => `${Math.round(p * 100)}%`;

function FloodMap({ zones, hour, selected, onSelect }: { zones: FloodZone[]; hour: number; selected: string | null; onSelect: (id: string) => void }) {
  const bounds = useMemo(() => {
    const lats = zones.map((z) => z.latitude);
    const lons = zones.map((z) => z.longitude);
    const pad = 0.02;
    return { minLat: Math.min(...lats) - pad, maxLat: Math.max(...lats) + pad, minLon: Math.min(...lons) - pad, maxLon: Math.max(...lons) + pad };
  }, [zones]);
  const W = 600;
  const H = 480;
  const x = (lon: number) => ((lon - bounds.minLon) / (bounds.maxLon - bounds.minLon)) * W;
  const y = (lat: number) => H - ((lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * H;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full rounded-btn bg-app-subtle" role="group" aria-label="Waterlogging probability heatmap by zone">
      <defs>
        {zones.map((z) => {
          const p = z.timeline[hour]?.p_waterlog ?? 0;
          return (
            <radialGradient key={z.id} id={`heat-${z.id.replace(/\s/g, '-')}`}>
              <stop offset="0%" stopColor={heat(p)} stopOpacity={0.55} />
              <stop offset="100%" stopColor={heat(p)} stopOpacity={0} />
            </radialGradient>
          );
        })}
      </defs>
      {zones.map((z) => {
        const p = z.timeline[hour]?.p_waterlog ?? 0;
        return <circle key={`h-${z.id}`} cx={x(z.longitude)} cy={y(z.latitude)} r={30 + p * 45} fill={`url(#heat-${z.id.replace(/\s/g, '-')})`} pointerEvents="none" aria-hidden="true" />;
      })}
      {zones.map((z) => {
        const t = z.timeline[hour];
        const p = t?.p_waterlog ?? 0;
        const active = z.id === selected;
        return (
          <g
            key={z.id}
            transform={`translate(${x(z.longitude)},${y(z.latitude)})`}
            className="group cursor-pointer outline-none"
            role="button"
            tabIndex={0}
            aria-pressed={active}
            aria-label={`${z.name}: ${pct(p)} waterlogging chance${t ? `, ${t.level}` : ''}`}
            onClick={() => onSelect(z.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(z.id);
              }
            }}
          >
            {/* Invisible larger hit target so small markers are easy to click/tap */}
            <circle r={16} fill="transparent" />
            <circle r={14} fill="none" stroke="var(--color-accent)" strokeWidth={2.5} className="opacity-0 group-focus-visible:opacity-100" />
            <circle r={active ? 9 : 7} fill={heat(p)} stroke="white" strokeWidth={active ? 3 : 1.5} />
            <text y={-13} textAnchor="middle" className="fill-[var(--color-text-secondary)] text-[11px] font-medium" style={{ paintOrder: 'stroke', stroke: 'var(--color-bg-subtle)', strokeWidth: 3 }}>
              {z.name.length > 16 ? `${z.name.slice(0, 15)}…` : z.name}
              {p >= 0.05 ? ` · ${pct(p)}` : ''}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function DepthChart({ zone }: { zone: FloodZone }) {
  const data = zone.timeline.map((t) => ({
    time: hourLabel(t.time),
    band: [t.depth_cm.p10, t.depth_cm.p90],
    p50: t.depth_cm.p50,
    rain: t.rain_sampled_mean_mm,
  }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid stroke="var(--color-border-subtle)" strokeDasharray="3 4" vertical={false} />
        <XAxis dataKey="time" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} />
        <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} unit=" cm" />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
          formatter={(v: number | number[], name: string) =>
            Array.isArray(v) ? [`${v[0]}–${v[1]} cm`, 'p10–p90 depth'] : [`${v} cm`, name === 'p50' ? 'median depth' : name]
          }
        />
        <ReferenceLine y={5} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'waterlog 5cm', fontSize: 10, fill: '#f59e0b', position: 'insideTopRight' }} />
        <ReferenceLine y={15} stroke="#dc2626" strokeDasharray="4 4" label={{ value: 'stall 15cm', fontSize: 10, fill: '#dc2626', position: 'insideTopRight' }} />
        <Area dataKey="band" stroke="none" fill="#3b82f6" fillOpacity={0.2} isAnimationActive={false} />
        <Line dataKey="p50" stroke="#2563eb" strokeWidth={2} dot={false} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export const FloodTwinPage: React.FC = () => {
  const [scenario, setScenario] = useState(0);
  const [hour, setHour] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const { data, isLoading, isError, refetch, dataUpdatedAt, isFetching } = useFloodTwin(HORIZON, scenario);

  const zones = data?.zones ?? [];
  const hours = zones[0]?.timeline.length ?? HORIZON;
  const h = Math.min(hour, hours - 1);
  const ranked = useMemo(
    () => [...zones].sort((a, b) => (b.timeline[h]?.p_waterlog ?? 0) - (a.timeline[h]?.p_waterlog ?? 0)),
    [zones, h]
  );
  // Pin the initial pick (riskiest zone on first load) so the detail panel
  // doesn't jump to a different zone when the scenario or hour changes.
  useEffect(() => {
    if (selected === null && ranked[0]) setSelected(ranked[0].id);
  }, [selected, ranked]);
  const sel = zones.find((z) => z.id === selected) ?? ranked[0];
  const cityNow = data?.city_timeline[h];
  const flagged = cityNow ? cityNow.zones_warning + cityNow.zones_severe : 0;
  const peakHour = data?.city_timeline.reduce(
    (best, c, i) => (c.zones_warning + c.zones_severe > best.n ? { i, n: c.zones_warning + c.zones_severe } : best),
    { i: 0, n: -1 }
  );
  const selPoint = sel?.timeline[h];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Flood-Risk Digital Twin"
        subtitle="Bengaluru only, independent of your selected location. Probability of road waterlogging per zone: Monte Carlo rain ensemble driven through a stormwater ponding model."
        updatedAt={dataUpdatedAt ? new Date(dataUpdatedAt) : null}
        onRefresh={() => refetch()}
        isRefreshing={isFetching}
      />

      {isError && <ErrorState message="Could not run the flood twin." onRetry={() => refetch()} />}

      <Card className="space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-text-secondary">What-if cloudburst in the next hour</span>
            <SegmentedControl options={SCENARIOS} value={scenario} onChange={setScenario} ariaLabel="Cloudburst scenario" />
          </div>
          <label className="flex flex-1 flex-col gap-1.5 lg:max-w-md">
            <span className="flex justify-between text-xs font-medium text-text-secondary">
              <span>Forecast hour</span>
              <span className="tabular-nums text-text-primary">
                +{h}h · {hourLabel(zones[0]?.timeline[h]?.time)}
              </span>
            </span>
            <input
              type="range"
              min={0}
              max={hours - 1}
              value={h}
              onChange={(e) => setHour(Number(e.target.value))}
              className="w-full accent-[var(--color-accent)]"
              aria-label="Forecast hour"
            />
          </label>
        </div>
        {data?.is_simulation && (
          <div className="flex items-center gap-2 rounded-btn border border-risk-moderate-border bg-risk-moderate-bg px-3 py-2 text-xs text-risk-moderate">
            <FlaskConical className="h-3.5 w-3.5 shrink-0" />
            Simulation: a hypothetical {scenario} mm cloudburst is added to the next hour on top of the live forecast.
          </div>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile loading={isLoading} label="Zones at warning+" value={flagged} unit={`of ${zones.length}`} icon={<Waves className="h-4 w-4" />} trendText={`at +${h}h`} />
        <StatTile loading={isLoading} label="Watch zones" value={cityNow?.zones_watch ?? 0} icon={<Layers className="h-4 w-4" />} trendText="20–50% waterlog chance" />
        <StatTile
          loading={isLoading}
          label="City peak hour"
          value={peakHour && peakHour.n > 0 ? hourLabel(data?.city_timeline[peakHour.i].time) : '—'}
          icon={<Clock className="h-4 w-4" />}
          trendText={peakHour && peakHour.n > 0 ? `${peakHour.n} zones flagged` : 'no flagged hour'}
        />
        <StatTile
          loading={isLoading}
          label="Crowd reports"
          value={data?.crowd.reports_in_window ?? 0}
          icon={<Users className="h-4 w-4" />}
          trendText={`${data?.crowd.zones_corrected ?? 0} zones corrected · last ${data?.crowd.window_hours ?? 6}h`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-7" title="Waterlogging heatmap" subtitle="Colour and halo size = probability that road water exceeds 5 cm">
          {isLoading ? <Skeleton className="h-80 w-full" /> : <FloodMap zones={zones} hour={h} selected={sel?.id ?? null} onSelect={setSelected} />}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-2xs text-text-muted">
            <span>0%</span>
            <span className="h-2 w-40 rounded-full" style={{ background: `linear-gradient(90deg, ${[0, 0.2, 0.5, 0.8, 1].map(heat).join(',')})` }} />
            <span>100%</span>
          </div>
        </Card>

        <Card className="lg:col-span-5" title={sel?.name ?? 'Zone detail'} subtitle={sel?.zone}>
          {sel && selPoint ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant={LEVEL_VARIANT[selPoint.level]}>{selPoint.level} at +{h}h</Badge>
                <Badge variant="neutral">Drainage class: {sel.vulnerability}</Badge>
                {sel.correction.n_reports > 0 && <Badge variant="info">Crowd-corrected · {sel.correction.n_reports} reports</Badge>}
              </div>
              {sel.correction.n_reports > 0 && selPoint.p_waterlog_uncorrected !== undefined && (
                <div className="rounded-btn border border-border-subtle bg-app-subtle px-3 py-2 text-xs text-text-secondary">
                  <div className="font-medium text-text-primary">
                    Model alone {pct(selPoint.p_waterlog_uncorrected)} → with citizen reports {pct(selPoint.p_waterlog)}
                  </div>
                  <div className="mt-0.5 text-2xs text-text-muted">
                    Rain bias {sel.correction.rain_bias >= 0 ? '+' : ''}{sel.correction.rain_bias.toFixed(2)} log-odds · assimilated ponding {sel.correction.initial_storage_mm.toFixed(1)} mm
                  </div>
                </div>
              )}
              <div className="grid grid-cols-3 gap-3 text-sm">
                {[
                  ['Waterlog ≥5cm', pct(selPoint.p_waterlog)],
                  ['Stall ≥15cm', pct(selPoint.p_severe)],
                  ['Median depth', `${selPoint.depth_cm.p50} cm`],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-btn bg-app-subtle px-3 py-2">
                    <div className="text-2xs text-text-muted">{k}</div>
                    <div className="font-semibold tabular-nums text-text-primary">{v}</div>
                  </div>
                ))}
              </div>
              <div>
                <div className="mb-1 text-xs font-medium text-text-secondary">Road water depth band (p10–p90)</div>
                <DepthChart zone={sel} />
              </div>
              <p className="text-2xs leading-relaxed text-text-muted">
                Drain capacity {sel.hydrology.drain_capacity_mm_h} mm/h · runoff coefficient {sel.hydrology.runoff_coefficient} · basin inflow ×{sel.hydrology.basin_inflow_factor} ({sel.elevation} m ASL)
              </p>
            </div>
          ) : (
            <Skeleton className="h-64 w-full" />
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
      <Card className="lg:col-span-8" title={`Zone ranking at +${h}h`} subtitle="Sorted by waterlogging probability">
        <div className="grid gap-3 sm:grid-cols-2">
          {ranked.map((z) => {
            const t = z.timeline[h];
            return (
              <button
                key={z.id}
                type="button"
                onClick={() => setSelected(z.id)}
                className={`rounded-card border p-3 text-left transition-colors hover:border-accent ${z.id === sel?.id ? 'border-accent bg-accent-subtle' : 'border-border-subtle bg-app-subtle'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium text-text-primary">{z.name}</div>
                    <div className="text-2xs text-text-muted">{z.vulnerability} drainage</div>
                  </div>
                  <Badge size="sm" variant={LEVEL_VARIANT[t.level]}>{t.level}</Badge>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border-subtle">
                  <div className="h-full rounded-full" style={{ width: pct(t.p_waterlog), background: heat(t.p_waterlog) }} />
                </div>
                <div className="mt-1.5 flex gap-4 text-xs tabular-nums text-text-secondary">
                  <span>{pct(t.p_waterlog)} waterlog</span>
                  <span>{t.depth_cm.p50} cm median</span>
                </div>
              </button>
            );
          })}
        </div>
      </Card>
      <div className="lg:col-span-4">
        <CrowdReportPanel zones={zones.map((z) => ({ id: z.id, name: z.name })).sort((a, b) => a.name.localeCompare(b.name))} zoneId={sel?.id} onZoneChange={setSelected} />
      </div>
      </div>
    </div>
  );
};
