/**
 * Browser geolocation + Nominatim reverse geocoding utilities.
 */

export interface Coords {
  latitude: number;
  longitude: number;
}

/** Ask the browser for GPS coordinates. Rejects if denied or unavailable. */
export function getBrowserCoords(timeoutMs = 8000): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      (err) => reject(err),
      { timeout: timeoutMs, maximumAge: 300_000, enableHighAccuracy: false }
    );
  });
}

export interface ReverseGeoResult {
  city: string;
  country: string;
}

/** Reverse-geocode coords → human-readable city via Nominatim (no API key needed). */
export async function reverseGeocode(lat: number, lon: number): Promise<ReverseGeoResult> {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10`;
  const res = await fetch(url, {
    headers: { 'Accept-Language': 'en', 'User-Agent': 'WeatherGPT/0.1' },
  });
  if (!res.ok) throw new Error('Reverse geocoding failed');
  const data = await res.json();
  const addr = data.address ?? {};
  const city =
    addr.city ||
    addr.town ||
    addr.village ||
    addr.county ||
    addr.state ||
    `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
  return { city, country: addr.country_code?.toUpperCase() ?? '' };
}
