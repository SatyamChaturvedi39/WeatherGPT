/**
 * Maps WMO weather codes + day/night to a visual theme for the landing page.
 */
import {
  Sun,
  Moon,
  CloudSun,
  CloudMoon,
  Cloud,
  CloudFog,
  CloudDrizzle,
  CloudRain,
  CloudLightning,
  CloudSnow,
} from 'lucide-react';

/** @typedef {'clear'|'partly'|'cloudy'|'fog'|'drizzle'|'rain'|'storm'|'snow'} Condition */

/** @returns {Condition} */
export function classifyCode(code) {
  const c = Number(code);
  if (c === 0) return 'clear';
  if (c === 1 || c === 2) return 'partly';
  if (c === 3) return 'cloudy';
  if (c === 45 || c === 48) return 'fog';
  if (c >= 51 && c <= 57) return 'drizzle';
  if ((c >= 61 && c <= 67) || (c >= 80 && c <= 82)) return 'rain';
  if ((c >= 71 && c <= 77) || c === 85 || c === 86) return 'snow';
  if (c >= 95) return 'storm';
  return 'partly';
}

/** "2026-11-04T20:15" → minutes since midnight (location-local, as returned by Open-Meteo) */
function minutesOf(iso) {
  if (!iso || typeof iso !== 'string' || !iso.includes('T')) return null;
  const [h, m] = iso.split('T')[1].split(':').map(Number);
  return h * 60 + (m || 0);
}

export function isNightAt(timeIso, sunriseIso, sunsetIso) {
  const t = minutesOf(timeIso);
  if (t == null) return false;
  const rise = minutesOf(sunriseIso) ?? 6 * 60;
  const set = minutesOf(sunsetIso) ?? 18 * 60;
  return t < rise || t >= set;
}

/** Sky gradients (top → bottom) per condition, for day and night. */
const SKIES = {
  clear: {
    day: ['#1d5fd1', '#4f9cf0', '#ffd7a3'],
    night: ['#050816', '#101a3d', '#2b2459'],
  },
  partly: {
    day: ['#2a68c9', '#6aa8e8', '#f3d9b8'],
    night: ['#070b1d', '#152147', '#33305e'],
  },
  cloudy: {
    day: ['#5b6f8c', '#8b9cb3', '#c9d1dc'],
    night: ['#0c111d', '#1d2535', '#343c4f'],
  },
  fog: {
    day: ['#8c97a6', '#b5bec9', '#e3e7ec'],
    night: ['#11151d', '#262c37', '#424955'],
  },
  drizzle: {
    day: ['#4a5f7e', '#7a8ea8', '#aebccc'],
    night: ['#0a0f1a', '#18223a', '#2c3850'],
  },
  rain: {
    day: ['#2f3e55', '#55677f', '#8394a8'],
    night: ['#05080f', '#111a2b', '#212d42'],
  },
  storm: {
    day: ['#1b2130', '#383f55', '#5e5470'],
    night: ['#020308', '#0d0f1c', '#241b35'],
  },
  snow: {
    day: ['#8fb3d9', '#c3d7ec', '#f4f8fc'],
    night: ['#0b1226', '#25345a', '#566a90'],
  },
};

const META = {
  clear: { label: 'Clear skies', day: 'Bright, open sky.', night: 'A clear, starlit night.', IconDay: Sun, IconNight: Moon },
  partly: { label: 'Partly cloudy', day: 'Sun breaking through.', night: 'Clouds drifting past the moon.', IconDay: CloudSun, IconNight: CloudMoon },
  cloudy: { label: 'Overcast', day: 'A soft, grey ceiling.', night: 'Heavy clouds overhead.', IconDay: Cloud, IconNight: Cloud },
  fog: { label: 'Fog', day: 'Low visibility, hushed air.', night: 'Fog rolling through the dark.', IconDay: CloudFog, IconNight: CloudFog },
  drizzle: { label: 'Drizzle', day: 'A light, steady mist.', night: 'Fine rain in the night air.', IconDay: CloudDrizzle, IconNight: CloudDrizzle },
  rain: { label: 'Rain', day: 'Take the umbrella.', night: 'Rain on the rooftops.', IconDay: CloudRain, IconNight: CloudRain },
  storm: { label: 'Thunderstorm', day: 'Electric skies — stay alert.', night: 'Lightning across the night.', IconDay: CloudLightning, IconNight: CloudLightning },
  snow: { label: 'Snow', day: 'Quiet, falling snow.', night: 'Snow under streetlights.', IconDay: CloudSnow, IconNight: CloudSnow },
};

export function themeFor(condition, night) {
  const meta = META[condition] ?? META.partly;
  const sky = (SKIES[condition] ?? SKIES.partly)[night ? 'night' : 'day'];
  return {
    condition,
    night,
    sky,
    label: meta.label,
    tagline: night ? meta.night : meta.day,
    Icon: night ? meta.IconNight : meta.IconDay,
  };
}

export const iconForCode = (code, night = false) => themeFor(classifyCode(code), night).Icon;

export const CONDITIONS = ['clear', 'partly', 'cloudy', 'fog', 'drizzle', 'rain', 'storm', 'snow'];
