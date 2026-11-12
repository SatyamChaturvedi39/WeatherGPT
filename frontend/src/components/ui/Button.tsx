import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'secondary',
  size = 'md',
  icon,
  className = '',
  disabled,
  ...props
}) => {
  const base =
    'inline-flex items-center justify-center font-medium rounded-btn transition-colors duration-150 focus-visible:outline-none disabled:opacity-50 disabled:pointer-events-none select-none';

  const sizeClasses =
    size === 'sm' ? 'px-2.5 py-1.5 text-xs gap-1.5' : 'px-3.5 py-2 text-sm gap-2';

  let variantClasses = '';
  switch (variant) {
    case 'primary':
      variantClasses =
        'bg-accent text-accent-fg hover:bg-accent-hover shadow-sm border border-transparent';
      break;
    case 'secondary':
      variantClasses =
        'bg-app-surface text-text-primary border border-border-default hover:bg-app-subtle';
      break;
    case 'ghost':
      variantClasses = 'text-text-secondary hover:text-text-primary hover:bg-app-subtle';
      break;
    case 'danger':
      variantClasses =
        'bg-red-600 text-white hover:bg-red-700 border border-transparent';
      break;
  }

  return (
    <button
      className={`${base} ${sizeClasses} ${variantClasses} ${className}`}
      disabled={disabled}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </button>
  );
};
