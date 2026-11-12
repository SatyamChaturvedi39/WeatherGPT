/** Browser side of Web Push alert notifications. */

export type Severity = 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME';

export interface WatchedLocation {
  name: string;
  latitude: number;
  longitude: number;
}

export interface PushStatus {
  subscribed: boolean;
  min_severity: Severity | null;
  locations: WatchedLocation[];
  flood_zones: string[];
}

const API = '/api/notifications';

export const isPushSupported = (): boolean =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.detail || `Request failed (${res.status})`);
  return json as T;
}

/** VAPID public key (base64url) -> Uint8Array for PushManager.subscribe. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration('/');
  return existing ?? navigator.serviceWorker.register('/sw.js', { scope: '/' });
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration('/');
  return reg ? reg.pushManager.getSubscription() : null;
}

export async function getPushStatus(): Promise<PushStatus> {
  const sub = await currentSubscription();
  if (!sub) return { subscribed: false, min_severity: null, locations: [], flood_zones: [] };
  return post<PushStatus>('/status', { endpoint: sub.endpoint });
}

/** Ask for permission (if needed), subscribe this browser and register the locations to watch. */
export async function enablePush(locations: WatchedLocation[], minSeverity: Severity, floodZones: string[] = []): Promise<void> {
  if (!isPushSupported()) throw new Error('This browser does not support push notifications.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notifications are blocked for this site. Allow them in the browser settings.');

  const reg = await registration();
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const { public_key } = await fetch(`${API}/vapid-public-key`).then((r) => r.json());
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(public_key) as BufferSource,
    });
  }
  await post('/subscribe', { subscription: sub.toJSON(), locations, min_severity: minSeverity, flood_zones: floodZones });
}

export async function disablePush(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  await post('/unsubscribe', { endpoint: sub.endpoint });
  await sub.unsubscribe();
}

export async function sendTestPush(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) throw new Error('Notifications are not enabled in this browser.');
  await post('/test', { endpoint: sub.endpoint });
}
