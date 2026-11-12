import React from 'react';
import { Inbox } from 'lucide-react';
import { Button } from './Button';

interface EmptyStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionLabel,
  onAction,
  icon = <Inbox className="w-8 h-8 text-text-muted" />,
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 text-center rounded-card border border-dashed border-border-default bg-app-surface/50">
      <div className="mb-3 p-3 rounded-full bg-app-subtle text-text-muted">
        {icon}
      </div>
      <h4 className="text-sm font-semibold text-text-primary">{title}</h4>
      {description && (
        <p className="text-xs text-text-secondary max-w-sm mt-1 mb-4 leading-relaxed">
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <Button variant="secondary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
