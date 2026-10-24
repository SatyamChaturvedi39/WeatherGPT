import React from 'react';
import { formatRelativeTime } from '../../lib/formatters';
import { RefreshCw } from 'lucide-react';
import { Button } from '../ui/Button';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  updatedAt?: string | Date | null;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  updatedAt,
  onRefresh,
  isRefreshing = false,
  actions,
}) => {
  const relativeTime = formatRelativeTime(updatedAt);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-border-subtle">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-text-primary">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs text-text-secondary mt-0.5">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {updatedAt && (
          <span className="text-2xs text-text-muted tabular-nums">
            {relativeTime}
          </span>
        )}
        {onRefresh && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Refresh weather data"
            className="h-8 px-2"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 stroke-[1.75] text-text-muted ${
                isRefreshing ? 'animate-spin' : ''
              }`}
            />
          </Button>
        )}
        {actions}
      </div>
    </div>
  );
};
