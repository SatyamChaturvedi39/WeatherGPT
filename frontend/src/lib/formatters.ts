/**
 * Meteorological and date formatters ensuring zero 'undefined' or 'null' display.
 */

export function formatRelativeTime(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '—';
  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(date.getTime())) return '—';

    const now = Date.now();
    const diffSec = Math.max(0, Math.floor((now - date.getTime()) / 1000));

    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin === 1) return 'Updated 1 min ago';
    if (diffMin < 60) return `Updated ${diffMin} min ago`;

    const diffHours = Math.floor(diffMin / 60);
    if (diffHours === 1) return 'Updated 1 hour ago';
    if (diffHours < 24) return `Updated ${diffHours} hours ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Updated yesterday';
    return `Updated ${diffDays} days ago`;
  } catch {
    return '—';
  }
}

export function formatNumber(
  val: number | string | null | undefined,
  decimals: number = 1
): string {
  if (val === null || val === undefined || val === '') return '—';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '—';

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

export function formatTemperature(
  tempC: number | null | undefined,
  unit: 'celsius' | 'fahrenheit' = 'celsius'
): { value: string; unit: string } {
  if (tempC === null || tempC === undefined || isNaN(tempC)) {
    return { value: '—', unit: unit === 'fahrenheit' ? '°F' : '°C' };
  }
  const val = unit === 'fahrenheit' ? (tempC * 9) / 5 + 32 : tempC;
  return {
    value: formatNumber(val, 1),
    unit: unit === 'fahrenheit' ? '°F' : '°C',
  };
}

export function formatPrecipitation(
  precipMm: number | null | undefined,
  unit: 'mm' | 'inch' = 'mm'
): { value: string; unit: string } {
  if (precipMm === null || precipMm === undefined || isNaN(precipMm)) {
    return { value: '—', unit };
  }
  const val = unit === 'inch' ? precipMm * 0.0393701 : precipMm;
  return {
    value: formatNumber(val, unit === 'inch' ? 2 : 1),
    unit,
  };
}

export function formatWindSpeed(
  speedKmh: number | null | undefined,
  unit: 'celsius' | 'fahrenheit' = 'celsius'
): { value: string; unit: string } {
  if (speedKmh === null || speedKmh === undefined || isNaN(speedKmh)) {
    return { value: '—', unit: unit === 'fahrenheit' ? 'mph' : 'km/h' };
  }
  const val = unit === 'fahrenheit' ? speedKmh * 0.621371 : speedKmh;
  return {
    value: formatNumber(val, 0),
    unit: unit === 'fahrenheit' ? 'mph' : 'km/h',
  };
}

export function formatPressure(
  pressureHpa: number | null | undefined
): { value: string; unit: string } {
  if (pressureHpa === null || pressureHpa === undefined || isNaN(pressureHpa)) {
    return { value: '—', unit: 'hPa' };
  }
  return {
    value: formatNumber(pressureHpa, 0),
    unit: 'hPa',
  };
}
