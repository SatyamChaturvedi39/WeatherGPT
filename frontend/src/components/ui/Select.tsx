import React from 'react';
import { ChevronDown } from 'lucide-react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  sizeVariant?: 'sm' | 'md';
}

export const Select: React.FC<SelectProps> = ({
  label,
  children,
  sizeVariant = 'md',
  className = '',
  ...props
}) => {
  const sizeClasses =
    sizeVariant === 'sm' ? 'py-1 pl-2.5 pr-7 text-xs' : 'py-1.5 pl-3 pr-8 text-sm';

  return (
    <div className="relative inline-flex items-center">
      {label && <span className="text-xs text-text-secondary mr-2">{label}</span>}
      <div className="relative w-full">
        <select
          className={`appearance-none w-full bg-app-surface text-text-primary border border-border-default rounded-input hover:border-text-muted focus:border-accent focus-visible:outline-none transition-colors cursor-pointer ${sizeClasses} ${className}`}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="w-3.5 h-3.5 text-text-muted absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
    </div>
  );
};
