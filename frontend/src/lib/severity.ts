import type { BadgeVariant } from '../components/ui/Badge';

/** Map backend severity / risk words onto the app's risk badge variants. */
export function severityVariant(level: string | null | undefined): BadgeVariant {
  const l = (level || '').toUpperCase();
  if (l === 'EXTREME' || l === 'HIGH' || l === 'CRITICAL' || l === 'SEVERE') return 'risk-high';
  if (l === 'MODERATE' || l === 'ELEVATED' || l === 'MEDIUM') return 'risk-moderate';
  if (l === 'LOW' || l === 'MINIMAL' || l === 'OPTIMAL') return 'risk-low';
  return 'neutral';
}

/** Solid dot colour for maps/legends. */
export function riskColor(level: string | null | undefined): string {
  const l = (level || '').toUpperCase();
  if (l === 'CRITICAL' || l === 'EXTREME') return '#dc2626';
  if (l === 'SEVERE' || l === 'HIGH') return '#f97316';
  if (l === 'MODERATE' || l === 'ELEVATED') return '#f59e0b';
  return '#10b981';
}

export function scoreVariant(score: number): BadgeVariant {
  if (score >= 70) return 'risk-low';
  if (score >= 40) return 'risk-moderate';
  return 'risk-high';
}

export const humanize = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
