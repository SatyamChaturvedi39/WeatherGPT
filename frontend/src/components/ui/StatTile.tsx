import React from 'react';
import { Skeleton } from './Skeleton';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatTileProps {
  label: string;
  value: string | number | null | undefined;
  unit?: string;
  trendText?: string;
  trendDirection?: 'up' | 'down' | 'neutral';
  icon?: React.ReactNode;
  loading?: boolean;
}

export const StatTile: React.FC<StatTileProps> = ({
  label,
  value,
  unit,
  trendText,
  trendDirection,
  icon,
  loading = false,
}) => {
  if (loading) {
    return (
      <div className="bg-app-surface border border-border-subtle rounded-card p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between mb-3">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-4 w-4 rounded-full" />
        </div>
        <div className="my-1">
          <Skeleton className="h-7 w-28" />
        </div>
        <div className="mt-2">
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
    );
  }

  const displayVal = value !== null && value !== undefined && value !== '' ? String(value) : '—';

  return (
    <div className="bg-app-surface border border-border-subtle rounded-card p-4 flex flex-col justify-between shadow-card hover:border-border-default transition-colors duration-150">
      <div className="flex items-center justify-between text-text-muted mb-1.5">
        <span className="text-xs font-normal text-text-secondary">{label}</span>
        {icon && <span className="text-text-muted">{icon}</span>}
      </div>

      <div className="flex items-baseline gap-1 my-0.5">
        <span className="text-stat font-semibold tracking-tight text-text-primary tabular-nums">
          {displayVal}
        </span>
        {unit && <span className="text-xs font-normal text-text-muted">{unit}</span>}
      </div>

      {trendText ? (
        <div className="flex items-center gap-1 text-2xs text-text-muted mt-1 tabular-nums">
          {trendDirection === 'up' && <TrendingUp className="w-3 h-3 text-text-secondary" />}
          {trendDirection === 'down' && <TrendingDown className="w-3 h-3 text-text-secondary" />}
          {trendDirection === 'neutral' && <Minus className="w-3 h-3 text-text-muted" />}
          <span>{trendText}</span>
        </div>
      ) : (
        <div className="h-4 mt-1" />
      )}
    </div>
  );
};
