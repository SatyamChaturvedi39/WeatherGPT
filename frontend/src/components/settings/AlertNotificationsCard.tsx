import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BellRing, BellOff, Send, Waves } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { SegmentedControl } from '../ui/SegmentedControl';
import { useFloodTwin } from '../../hooks/useWeather';
import {
  disablePush,
  enablePush,
  getPushStatus,
  isPushSupported,
  sendTestPush,
  type PushStatus,
  type Severity,
  type WatchedLocation,
} from '../../lib/push';

const SEVERITY_OPTIONS: { label: string; value: Severity }[] = [
  { label: 'Moderate+', value: 'MODERATE' },
  { label: 'High+', value: 'HIGH' },
  { label: 'Extreme only', value: 'EXTREME' },
];

interface Props {
  /** Current location first, then saved ones; duplicates are collapsed server-side */
  locations: WatchedLocation[];
}

export const AlertNotificationsCard: React.FC<Props> = ({ locations }) => {
  const supported = useMemo(isPushSupported, []);
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [severity, setSeverity] = useState<Severity>('MODERATE');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [floodZones, setFloodZones] = useState<string[]>([]);
  const watched = locations.slice(0, 10);
  const { data: twin } = useFloodTwin(6, 0);
  const zoneOptions = useMemo(
    () => (twin?.zones ?? []).map((z) => ({ id: z.id, name: z.name })).sort((a, b) => a.name.localeCompare(b.name)),
    [twin]
  );
  const toggleZone = (id: string) =>
    setFloodZones((cur) => (cur.includes(id) ? cur.filter((z) => z !== id) : [...cur, id]));

  const refresh = useCallback(async () => {
    try {
      const s = await getPushStatus();
      setStatus(s);
      if (s.min_severity) setSeverity(s.min_severity);
      if (s.subscribed) setFloodZones(s.flood_zones);
    } catch {
      setStatus({ subscribed: false, min_severity: null, locations: [], flood_zones: [] });
    }
  }, []);

  useEffect(() => {
    if (supported) refresh();
  }, [supported, refresh]);

  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
      setMessage({ kind: 'ok', text: ok });
      await refresh();
    } catch (e) {
      setMessage({ kind: 'error', text: e instanceof Error ? e.message : 'Something went wrong.' });
    } finally {
      setBusy(false);
    }
  };

  const on = !!status?.subscribed;

  return (
    <Card
      title="Alert Notifications"
      subtitle="Get a browser notification when a weather alert starts or gets more severe, even when WeatherGPT is closed."
      headerAction={on ? <Badge variant="success" size="sm">On</Badge> : <Badge size="sm">Off</Badge>}
    >
      {!supported ? (
        <p className="text-sm text-text-muted">This browser does not support push notifications.</p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-text-secondary">Notify me for</span>
            <SegmentedControl options={SEVERITY_OPTIONS} value={severity} onChange={setSeverity} ariaLabel="Minimum alert severity" />
          </div>

          <fieldset className="space-y-1.5">
            <legend className="flex items-center gap-1.5 text-xs font-medium text-text-secondary">
              <Waves className="h-3.5 w-3.5" /> Flood warnings for Bengaluru zones
              <span className="font-normal text-text-muted">({floodZones.length} selected)</span>
            </legend>
            <p className="text-2xs text-text-muted">
              Notified when the Flood Twin forecasts Warning or Severe waterlogging in a zone within 6 hours.
            </p>
            <div className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto">
              {zoneOptions.map((z) => {
                const selected = floodZones.includes(z.id);
                return (
                  <button
                    key={z.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleZone(z.id)}
                    className={`rounded-full border px-2.5 py-1 text-2xs transition-colors ${
                      selected
                        ? 'border-accent bg-accent-subtle text-accent'
                        : 'border-border-subtle bg-app-subtle text-text-secondary hover:border-accent'
                    }`}
                  >
                    {z.name}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="text-xs text-text-secondary">
            <span className="font-medium">Watching: </span>
            {(on ? status!.locations : watched).map((l) => l.name).join(', ') || '—'}
            {!on && watched.length > 0 && <span className="text-text-muted"> (current and saved locations)</span>}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              icon={<BellRing className="h-3.5 w-3.5" />}
              disabled={busy || watched.length === 0}
              onClick={() =>
                run(() => enablePush(watched, severity, floodZones), on ? 'Notification settings updated.' : 'Alert notifications are on.')
              }
            >
              {on ? 'Update' : 'Turn on'}
            </Button>
            {on && (
              <>
                <Button size="sm" variant="secondary" icon={<Send className="h-3.5 w-3.5" />} disabled={busy} onClick={() => run(sendTestPush, 'Test notification sent.')}>
                  Send test
                </Button>
                <Button size="sm" variant="ghost" icon={<BellOff className="h-3.5 w-3.5" />} disabled={busy} onClick={() => run(disablePush, 'Alert notifications are off.')}>
                  Turn off
                </Button>
              </>
            )}
          </div>

          {message && (
            <p role="status" className={`text-xs ${message.kind === 'ok' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
              {message.text}
            </p>
          )}
          <p className="text-2xs text-text-muted">
            Alerts are checked every 15 minutes. You get one notification per alert, plus another only if it gets more severe.
          </p>
        </div>
      )}
    </Card>
  );
};
