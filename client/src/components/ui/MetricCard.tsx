import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card } from './Card';
import { cn } from '../../lib/cn';

type Tone = 'brand' | 'success' | 'warning' | 'danger' | 'neutral' | 'info';

const toneStyles: Record<Tone, { icon: string; value?: string }> = {
  brand: { icon: 'bg-brand-50 text-brand-600' },
  success: { icon: 'bg-success-50 text-success-600' },
  warning: { icon: 'bg-warning-50 text-warning-600' },
  danger: { icon: 'bg-danger-50 text-danger-600' },
  neutral: { icon: 'bg-surface-sunken text-muted' },
  info: { icon: 'bg-info-50 text-info-600' },
};

export function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'brand',
  badge,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
  badge?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn('relative p-4', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">{label}</p>
          <div className="mt-1.5 truncate text-[1.55rem] font-semibold leading-tight tracking-tight text-ink tabular">
            {value}
          </div>
        </div>
        {Icon ? (
          <div
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
              toneStyles[tone].icon,
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
          </div>
        ) : null}
      </div>
      <div className="mt-2 flex min-h-4 flex-wrap items-center gap-2">
        {hint ? <p className="text-[11px] leading-relaxed text-muted">{hint}</p> : null}
        {badge}
      </div>
    </Card>
  );
}
