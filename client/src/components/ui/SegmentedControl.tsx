import { cn } from '../../lib/cn';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  label = 'View options',
  className,
}: {
  value: T;
  options: ReadonlyArray<SegmentedOption<T>>;
  onChange: (value: T) => void;
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'clay-inset inline-flex items-center gap-0.5 rounded-xl p-1',
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={active}
            className={cn(
              'clay-pressable rounded-lg px-3 py-1.5 text-[11px] font-semibold',
              active
                ? 'bg-surface text-ink shadow-[4px_4px_10px_-8px_rgb(44_57_87/0.5),-4px_-4px_10px_-8px_rgb(255_255_255/0.95),inset_0_1px_0_rgb(255_255_255/0.9)]'
                : 'text-muted hover:text-ink',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
