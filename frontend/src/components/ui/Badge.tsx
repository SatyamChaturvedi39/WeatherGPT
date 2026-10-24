import React from 'react';

export type BadgeVariant =
  | 'neutral'
  | 'risk-low'
  | 'risk-moderate'
  | 'risk-high'
  | 'success'
  | 'info';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  icon,
  className = '',
}) => {
  let colorClasses = 'bg-app-subtle text-text-secondary border-border-subtle';

  switch (variant) {
    case 'risk-low':
      colorClasses = 'bg-risk-low-bg text-risk-low border-risk-low-border font-medium';
      break;
    case 'risk-moderate':
      colorClasses = 'bg-risk-moderate-bg text-risk-moderate border-risk-moderate-border font-medium';
      break;
    case 'risk-high':
      colorClasses = 'bg-risk-high-bg text-risk-high border-risk-high-border font-medium';
      break;
    case 'success':
      colorClasses = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40';
      break;
    case 'info':
      colorClasses = 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border-blue-200 dark:border-blue-800/40';
      break;
    case 'neutral':
    default:
      colorClasses = 'bg-app-subtle text-text-secondary border-border-default';
      break;
  }

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-2xs gap-1' : 'px-2.5 py-1 text-xs gap-1.5';

  return (
    <span
      className={`inline-flex items-center rounded-full border ${sizeClasses} ${colorClasses} select-none ${className}`}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </span>
  );
};
