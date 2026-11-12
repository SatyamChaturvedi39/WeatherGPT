import React from 'react';
import { Clock } from 'lucide-react';
import { Card } from '../ui/Card';
import { Skeleton } from '../ui/Skeleton';
import { useRouteDepartures } from '../../hooks/useWeather';
import type { DepartureSlot } from '../../types/extra';

interface Props {
  origin: string;
  destination: string;
  mode: string;
}

/** Format a UTC timestamp in the route's local time using its UTC offset (independent of the viewer's zone). */
function localTime(ts: number, offsetS: number | null): string {
  const d = new Date((ts + (offsetS ?? 0)) * 1000);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

const barColor = (s: DepartureSlot) =>
  s.max_rain_probability == null ? 'var(--color-border-subtle)' : s.max_rain_probability >= 60 ? '#dc2626' : s.max_rain_probability >= 30 ? '#f59e0b' : '#10b981';

export const BestDepartureCard: React.FC<Props> = ({ origin, destination, mode }) => {
  const { data, isLoading, isError } = useRouteDepartures(origin, destination, mode);
  const off = data?.utc_offset_seconds ?? null;
  const best = data?.best;
  const now = data?.leave_now;
  const sameAsNow = best && now && best.depart_ts === now.depart_ts;
  const pct = (v: number | null | undefined) => (v == null ? '—' : `${v}%`);

  let headline = '';
  if (best && now) {
    if (sameAsNow) {
      headline = `Leave now — up to ${pct(best.max_rain_probability)} chance of rain on the way, and no drier time in the next 6 hours.`;
    } else {
      headline = `Leave at ${localTime(best.depart_ts, off)} — up to ${pct(best.max_rain_probability)} chance of rain on the way, versus ${pct(now.max_rain_probability)} if you leave now.`;
    }
  }

  return (
    <Card
      title="Best time to leave"
      subtitle={data ? `${data.trip_minutes} min trip · times in ${data.timezone ?? 'local time'}` : 'Driest departure over the next 6 hours'}
      headerAction={<Clock className="h-4 w-4 text-text-muted" />}
    >
      {isLoading && <Skeleton className="h-28 w-full" />}
      {isError && <p className="text-sm text-text-muted">Could not plan departures for this route.</p>}
      {data && best && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-text-primary">{headline}</p>
          <div
            className="flex h-20 items-end gap-0.5"
            role="img"
            aria-label="Peak chance of rain along the route for each departure time"
          >
            {data.slots.map((s) => {
              const isBest = s.depart_ts === best.depart_ts;
              return (
                <div
                  key={s.depart_ts}
                  title={`${localTime(s.depart_ts, off)}: ${pct(s.max_rain_probability)} rain chance, ${s.max_rain_mm_h ?? '—'} mm/h`}
                  className={`flex-1 rounded-t-sm ${isBest ? 'ring-2 ring-accent ring-offset-1' : ''}`}
                  style={{ height: `${Math.max(6, s.max_rain_probability ?? 0)}%`, background: barColor(s) }}
                />
              );
            })}
          </div>
          <div className="flex justify-between text-2xs tabular-nums text-text-muted">
            <span>{localTime(data.slots[0].depart_ts, off)}</span>
            <span>{localTime(data.slots[Math.floor(data.slots.length / 2)].depart_ts, off)}</span>
            <span>{localTime(data.slots[data.slots.length - 1].depart_ts, off)}</span>
          </div>
          <p className="text-2xs text-text-muted">
            Bars: highest chance of rain you would meet along the route for each departure. {data.method}
          </p>
        </div>
      )}
    </Card>
  );
};
