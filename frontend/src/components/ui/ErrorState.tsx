import React from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { Button } from './Button';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  compact?: boolean;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Failed to load telemetry',
  message = 'An unexpected error occurred while fetching data.',
  onRetry,
  compact = false,
}) => {
  if (compact) {
    return (
      <div className="flex items-center justify-between p-3 rounded-card bg-red-500/10 border border-red-500/20 text-xs">
        <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{message}</span>
        </div>
        {onRetry && (
          <Button variant="ghost" size="sm" onClick={onRetry} className="h-7 text-xs">
            <RotateCcw className="w-3 h-3 mr-1" /> Retry
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center rounded-card border border-border-subtle bg-app-surface">
      <div className="p-3 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 mb-3">
        <AlertCircle className="w-6 h-6" />
      </div>
      <h4 className="text-sm font-semibold text-text-primary">{title}</h4>
      <p className="text-xs text-text-secondary max-w-sm mt-1 mb-4 leading-relaxed">
        {message}
      </p>
      {onRetry && (
        <Button variant="secondary" size="sm" icon={<RotateCcw className="w-3.5 h-3.5" />} onClick={onRetry}>
          Try Again
        </Button>
      )}
    </div>
  );
};
