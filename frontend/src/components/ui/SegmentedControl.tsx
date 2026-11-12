export interface Option<T extends string | number> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string | number> {
  options: Option<T>[];
  value: T;
  onChange: (val: T) => void;
  ariaLabel?: string;
  size?: 'sm' | 'md';
}

export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel = 'Segmented options',
  size = 'md',
}: SegmentedControlProps<T>) {
  const padClass = size === 'sm' ? 'p-0.5 text-xs' : 'p-1 text-xs';
  const itemPadClass = size === 'sm' ? 'px-2 py-1' : 'px-3 py-1.5';

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`inline-flex items-center bg-app-subtle border border-border-subtle rounded-input ${padClass}`}
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            role="tab"
            aria-selected={selected}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`font-medium rounded-input transition-all duration-150 select-none ${itemPadClass} ${
              selected
                ? 'bg-app-surface text-text-primary shadow-sm font-semibold border border-border-subtle'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
