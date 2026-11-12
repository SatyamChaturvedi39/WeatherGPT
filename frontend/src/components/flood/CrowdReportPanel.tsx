import React, { useState } from 'react';
import { Sun, CloudRain, CloudRainWind, Waves, LocateFixed, Users } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { useFloodReports, useSubmitFloodReport } from '../../hooks/useWeather';
import { getBrowserCoords } from '../../lib/geolocation';
import { formatRelativeTime } from '../../lib/formatters';
import type { CrowdReportType } from '../../types/extra';

const REPORT_OPTIONS: { type: CrowdReportType; label: string; icon: React.ReactNode }[] = [
  { type: 'dry', label: 'Dry', icon: <Sun className="h-4 w-4" /> },
  { type: 'raining', label: 'Raining', icon: <CloudRain className="h-4 w-4" /> },
  { type: 'heavy_rain', label: 'Heavy rain', icon: <CloudRainWind className="h-4 w-4" /> },
  { type: 'waterlogged', label: 'Waterlogged', icon: <Waves className="h-4 w-4" /> },
];

const LABEL: Record<CrowdReportType, string> = {
  dry: 'Dry',
  raining: 'Raining',
  heavy_rain: 'Heavy rain',
  waterlogged: 'Waterlogged',
};

interface Props {
  zones: { id: string; name: string }[];
  zoneId: string | undefined;
  onZoneChange: (id: string) => void;
}

export const CrowdReportPanel: React.FC<Props> = ({ zones, zoneId, onZoneChange }) => {
  const { data: reports = [] } = useFloodReports();
  const submit = useSubmitFloodReport();
  const [useGps, setUseGps] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const send = async (type: CrowdReportType) => {
    setMessage(null);
    try {
      let where: { zoneId: string } | { lat: number; lon: number };
      if (useGps) {
        const c = await getBrowserCoords();
        where = { lat: c.latitude, lon: c.longitude };
      } else if (zoneId) {
        where = { zoneId };
      } else {
        return;
      }
      const r = await submit.mutateAsync({ type, where });
      setMessage({ ok: true, text: `Thanks! "${LABEL[type]}" recorded for ${r.zone_name}. The twin has been re-corrected.` });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'Could not send report.' });
    }
  };

  return (
    <Card title="Report ground truth" subtitle="What do you see right now? Reports correct the model in real time.">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={zoneId ?? ''}
            onChange={(e) => onZoneChange(e.target.value)}
            disabled={useGps}
            aria-label="Zone to report"
            className="min-w-0 flex-1 rounded-input border border-border-subtle bg-app-surface px-3 py-2 text-sm text-text-primary disabled:opacity-50"
          >
            {zones.map((z) => (
              <option key={z.id} value={z.id}>{z.name}</option>
            ))}
          </select>
          <Button size="sm" variant={useGps ? 'primary' : 'secondary'} onClick={() => setUseGps((v) => !v)} aria-pressed={useGps}>
            <LocateFixed className="h-3.5 w-3.5" /> My location
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {REPORT_OPTIONS.map((o) => (
            <Button key={o.type} variant="secondary" onClick={() => send(o.type)} disabled={submit.isPending} className="justify-center">
              {o.icon} {o.label}
            </Button>
          ))}
        </div>

        {message && (
          <p role="status" className={`rounded-btn px-3 py-2 text-xs ${message.ok ? 'bg-risk-low-bg text-risk-low' : 'bg-risk-high-bg text-risk-high'}`}>
            {message.text}
          </p>
        )}

        <div>
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-text-secondary">
            <Users className="h-3.5 w-3.5" /> Recent reports ({reports.length})
          </div>
          {reports.length === 0 ? (
            <p className="text-sm text-text-muted">No reports in the last 6 hours. Be the first.</p>
          ) : (
            <ul className="max-h-48 space-y-1.5 overflow-y-auto text-sm">
              {reports.slice(0, 20).map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 rounded-btn bg-app-subtle px-3 py-1.5">
                  <span className="text-text-primary">
                    {LABEL[r.report_type]} <span className="text-text-muted">· {r.zone_name}</span>
                  </span>
                  <span className="shrink-0 text-2xs text-text-muted">{formatRelativeTime(new Date(r.created_at * 1000))}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
};
