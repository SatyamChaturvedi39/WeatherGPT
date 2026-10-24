import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  headerAction?: React.ReactNode;
  title?: string;
  subtitle?: string;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  headerAction,
  title,
  subtitle,
  ...props
}) => {
  return (
    <div
      className={`bg-app-surface border border-border-subtle rounded-card shadow-card p-5 ${className}`}
      {...props}
    >
      {(title || headerAction) && (
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            {title && <h3 className="text-base font-semibold text-text-primary">{title}</h3>}
            {subtitle && <p className="text-xs text-text-secondary mt-0.5">{subtitle}</p>}
          </div>
          {headerAction && <div className="shrink-0">{headerAction}</div>}
        </div>
      )}
      {children}
    </div>
  );
};
