import React, { useState } from 'react';
import { Navigation, MapPin, Flag, Umbrella, Timer, ShieldCheck, Route as RouteIcon, AlertTriangle, Loader2 } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { Card } from '../components/ui/Card';
import { StatTile } from '../components/ui/StatTile';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { ErrorState } from '../components/ui/ErrorState';
import { EmptyState } from '../components/ui/EmptyState';
import { useRouteForecast } from '../hooks/useWeather';
import { scoreVariant } from '../lib/severity';
import { iconForCode } from '../landing/weatherTheme';

const MODES = [
  { value: 'two_wheeler', label: '🛵 Two-wheeler' },
  { value: 'auto_cab', label: '🛺 Auto / Cab' },
  { value: 'four_wheeler', label: '🚗 Car' },
  { value: 'pedestrian', label: '🚶 Walking' },
];

const EXAMPLES: Array<[string, string]> = [
  ['Vimanapura', 'Koramangala'],
  ['Whitefield', 'MG Road'],
  ['Electronic City', 'Hebbal'],
];

const inputCls =
  'w-full rounded-input border border-border-default bg-app-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none';

export const RoutePage: React.FC = () => {
  const [origin, setOrigin] = useState('Vimanapura');
  const [destination, setDestination] = useState('Koramangala');
  const [mode, setMode] = useState('two_wheeler');
  const [submitted, setSubmitted] = useState<{ o: string; d: string; m: string } | null>(null);

  const { data, isFetching, isError, error, refetch } = useRouteForecast(
    submitted?.o ?? '',
    submitted?.d ?? '',
    submitted?.m ?? mode,
    !!submitted
  );

  const run = (o = origin, d = destination) => setSubmitted({ o, d, m: mode });
  const physics = data?.contact_physics;
  const maxStop = physics ? Math.max(physics.dry_stopping_distance_m, physics.wet_stopping_distance_m) : 1;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Route Rain Shield"
        subtitle="Weather along your commute corridor, raincoat advice and wet-road braking physics."
      />

      <Card>
        <form
          className="grid gap-3 md:grid-cols-[1fr_1fr_auto_auto] md:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            run();
          }}
        >
          <label className="space-y-1">
            <span className="flex items-center gap-1 text-xs text-text-secondary"><MapPin className="h-3 w-3" /> From</span>
            <input className={inputCls} value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="e.g. Indiranagar" />
          </label>
          <label className="space-y-1">
            <span className="flex items-center gap-1 text-xs text-text-secondary"><Flag className="h-3 w-3" /> To</span>
            <input className={inputCls} value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="e.g. Koramangala" />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-text-secondary">Mode</span>
            <select className={inputCls} value={mode} onChange={(e) => setMode(e.target.value)}>
              {MODES.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </label>
          <Button type="submit" disabled={isFetching}>
            {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
            Check route
          </Button>
        </form>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-2xs text-text-muted">
          Try:
          {EXAMPLES.map(([o, d]) => (
            <button
              key={o}
              type="button"
              className="rounded-full border border-border-subtle bg-app-subtle px-2.5 py-1 text-text-secondary hover:text-text-primary"
              onClick={() => {
                setOrigin(o);
                setDestination(d);
                run(o, d);
              }}
            >
              {o} → {d}
            </button>
          ))}
        </div>
      </Card>

      {!submitted && (
        <EmptyState
          icon={<RouteIcon className="h-6 w-6" />}
          title="Plan a commute"
          description="Enter two places to sample the weather at waypoints along the way."
        />
      )}

      {isFetching && !data && (
        <Card>
          <div className="flex items-center gap-3 text-sm text-text-secondary">
            <Loader2 className="h-4 w-4 animate-spin text-accent" />
            Sampling weather along the corridor — this takes a few seconds…
          </div>
        </Card>
      )}

      {isError && <ErrorState message={(error as Error)?.message || 'Could not analyse this route.'} onRetry={() => refetch()} />}

      {data && (
        <>
          <div className={`rounded-card border p-4 text-sm ${data.raincoat_needed ? 'border-risk-moderate-border bg-risk-moderate-bg text-risk-moderate' : 'border-risk-low-border bg-risk-low-bg text-risk-low'}`}>
            <div className="flex items-start gap-2">
              <Umbrella className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <div className="font-medium">{data.raincoat_advisory}</div>
                <div className="mt-1 text-xs opacity-80">{data.mode_guidance}</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile label="Distance" value={data.total_distance_km.toFixed(1)} unit="km" trendText={data.transit_type} icon={<RouteIcon className="h-4 w-4" />} />
            <StatTile label="Est. travel time" value={data.estimated_drive_mins} unit="min" trendText={data.transit_mode} icon={<Timer className="h-4 w-4" />} />
            <StatTile label="Safety score" value={data.safety_score} unit="/100" trendText={data.safety_status} icon={<ShieldCheck className="h-4 w-4" />} />
            <StatTile
              label="Braking penalty"
              value={`+${data.stopping_distance_penalty_pct.toFixed(0)}`}
              unit="%"
              trendText="extra stopping distance now"
              icon={<AlertTriangle className="h-4 w-4" />}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-12">
            <Card className="lg:col-span-7" title="Corridor waypoints" subtitle={`${data.origin} → ${data.destination}`}>
              <ol className="relative ml-3 border-l border-border-default">
                {data.waypoints.map((w, i) => {
                  const Icon = iconForCode(w.weather_code);
                  const last = i === data.waypoints.length - 1;
                  return (
                    <li key={w.step} className="relative pb-5 pl-6 last:pb-0">
                      <span className={`absolute -left-[9px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-app-surface ${i === 0 || last ? 'bg-accent' : w.hazard ? 'bg-risk-high' : 'bg-border-default'}`} />
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-medium text-text-primary">{w.name}</div>
                          <div className="text-2xs text-text-muted tabular-nums">
                            {w.distance_km.toFixed(1)} km · ETA +{w.eta_mins} min
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-text-secondary tabular-nums">
                          <Icon className="h-4 w-4 text-accent" />
                          <span>{w.temperature == null ? '—' : `${w.temperature.toFixed(1)}°`}</span>
                          <span>{w.precipitation == null ? '—' : `${w.precipitation.toFixed(1)} mm`}</span>
                          <span>{w.wind_speed == null ? '—' : `${w.wind_speed.toFixed(0)} km/h`}</span>
                        </div>
                      </div>
                      {w.hazard && (
                        <Badge variant="risk-high" size="sm" className="mt-1.5">{w.hazard}</Badge>
                      )}
                    </li>
                  );
                })}
              </ol>
            </Card>

            <div className="space-y-6 lg:col-span-5">
              {physics && (
                <Card title="Wet-road stopping distance" subtitle={`At ${physics.assumed_speed_kmh} km/h · reaction ${physics.reaction_time_seconds}s`}>
                  {[
                    { label: 'Dry asphalt', v: physics.dry_stopping_distance_m, mu: physics.friction_dry, cls: 'bg-emerald-500' },
                    { label: 'Wet asphalt', v: physics.wet_stopping_distance_m, mu: physics.friction_wet, cls: 'bg-sky-500' },
                  ].map((r) => (
                    <div key={r.label} className="mb-4 last:mb-0">
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="text-text-secondary">{r.label} <span className="text-text-muted">(μ {r.mu})</span></span>
                        <span className="font-semibold tabular-nums text-text-primary">{r.v.toFixed(1)} m</span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-app-subtle">
                        <div className={`h-full rounded-full ${r.cls} transition-all duration-700`} style={{ width: `${(r.v / maxStop) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                  <div className="mt-4 rounded-btn bg-app-subtle p-3 text-xs text-text-secondary">
                    Wet roads add <strong className="text-text-primary">+{physics.increase_percentage}%</strong> stopping distance.
                    Reaction distance {physics.reaction_distance_m} m · braking {physics.dry_braking_distance_m} m dry vs {physics.wet_braking_distance_m} m wet.
                  </div>
                  <p className="mt-3 text-2xs leading-relaxed text-text-muted">{physics.disclaimer}</p>
                </Card>
              )}

              <Card title="Active hazards">
                {data.active_hazards.length === 0 ? (
                  <div className="flex items-center gap-2 text-sm text-text-secondary">
                    <Badge variant={scoreVariant(data.safety_score)} size="sm">Clear</Badge>
                    No hazards detected along this corridor.
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {data.active_hazards.map((h, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-risk-high" />
                        {typeof h === 'string' ? h : String((h as Record<string, unknown>).description ?? (h as Record<string, unknown>).hazard ?? JSON.stringify(h))}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
