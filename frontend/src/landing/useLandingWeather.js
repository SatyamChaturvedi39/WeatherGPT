import { useEffect, useState } from 'react';
import { getBrowserCoords, reverseGeocode } from '../lib/geolocation';
import { classifyCode, isNightAt } from './weatherTheme';

const FALLBACK = { name: 'Bengaluru, India', latitude: 12.9716, longitude: 77.5946 };

/**
 * Loads everything the landing page needs in two requests:
 * /api/forecast/bundle (current + hourly + daily) and /api/alerts (activity scores).
 */
export function useLandingWeather() {
  const [state, setState] = useState({ status: 'loading', location: FALLBACK, data: null, error: null });

  useEffect(() => {
    let cancelled = false;

    async function resolveLocation() {
      try {
        const coords = await getBrowserCoords();
        let name = `${coords.latitude.toFixed(2)}, ${coords.longitude.toFixed(2)}`;
        try {
          const geo = await reverseGeocode(coords.latitude, coords.longitude);
          name = geo.country ? `${geo.city}, ${geo.country}` : geo.city;
        } catch {
          /* keep coordinate label */
        }
        return { name, latitude: coords.latitude, longitude: coords.longitude };
      } catch {
        return FALLBACK;
      }
    }

    (async () => {
      const location = await resolveLocation();
      if (cancelled) return;
      setState((s) => ({ ...s, location }));
      const qs = `lat=${location.latitude.toFixed(4)}&lon=${location.longitude.toFixed(4)}`;
      try {
        const [bundleRes, alertsRes] = await Promise.all([
          fetch(`/api/forecast/bundle?${qs}&hours=24&days=7`),
          fetch(`/api/alerts/?${qs}`).catch(() => null),
        ]);
        if (!bundleRes.ok) throw new Error(`Forecast unavailable (${bundleRes.status})`);
        const bundle = (await bundleRes.json()).data;
        const alerts = alertsRes && alertsRes.ok ? await alertsRes.json() : null;
        if (cancelled) return;
        setState({ status: 'ready', location, data: normalise(bundle, alerts), error: null });
      } catch (err) {
        if (!cancelled) setState({ status: 'error', location, data: null, error: err.message });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

function normalise(bundle, alerts) {
  const current = bundle?.current?.current ?? {};
  const daily = bundle?.daily?.daily ?? [];
  const today = daily[0] ?? {};
  const sunFor = (iso) => {
    const date = iso?.slice(0, 10);
    const d = daily.find((x) => x.date === date) ?? today;
    return [d.sunrise, d.sunset];
  };

  const hourly = (bundle?.hourly?.hourly ?? []).slice(0, 24).map((h) => {
    const [rise, set] = sunFor(h.time);
    return {
      time: h.time,
      temp: h.temperature_2m,
      lower: h.temp_lower_80 ?? h.temperature_lower,
      upper: h.temp_upper_80 ?? h.temperature_upper,
      rainProb: h.precipitation_probability ?? 0,
      wind: h.wind_speed_10m ?? 0,
      humidity: h.relative_humidity_2m ?? 0,
      code: h.weather_code,
      condition: classifyCode(h.weather_code),
      night: isNightAt(h.time, rise, set),
    };
  });

  return {
    current: {
      time: current.time,
      temp: current.temperature_2m,
      feelsLike: current.apparent_temperature,
      humidity: current.relative_humidity_2m,
      wind: current.wind_speed_10m,
      pressure: current.surface_pressure,
      cloud: current.cloud_cover,
      code: current.weather_code,
      condition: classifyCode(current.weather_code),
      night: isNightAt(current.time, today.sunrise, today.sunset),
    },
    hourly,
    daily: daily.map((d) => ({
      date: d.date,
      max: d.temperature_2m_max,
      min: d.temperature_2m_min,
      rainProb: d.precipitation_probability_max ?? 0,
      code: d.weather_code,
      sunrise: d.sunrise,
      sunset: d.sunset,
    })),
    activities: Object.entries(alerts?.activity_suitability ?? {}).map(([key, a]) => ({ key, ...a })),
    alerts: alerts?.alerts ?? [],
  };
}
