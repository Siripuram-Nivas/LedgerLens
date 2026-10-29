import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card } from './Card';
import { cn } from '../../lib/cn';

type Tone = 'brand' | 'success' | 'warning' | 'danger' | 'neutral' | 'info';

const toneStyles: Record<Tone, { icon: string; halo: string }> = {
  brand: {
    icon: 'bg-brand-50 text-brand-600',
    halo: 'from-brand-200/35',
  },
  success: {
    icon: 'bg-success-50 text-success-600',
    halo: 'from-success-100/45',
  },
  warning: {
    icon: 'bg-warning-50 text-warning-600',
    halo: 'from-warning-100/55',
  },
  danger: {
    icon: 'bg-danger-50 text-danger-600',
    halo: 'from-danger-100/45',
  },
  neutral: {
    icon: 'bg-surface-sunken text-muted',
    halo: 'from-white/60',
  },
  info: {
    icon: 'bg-info-50 text-info-600',
    halo: 'from-info-100/45',
  },
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
  const styles = toneStyles[tone];
  return (
    <Card className={cn('relative overflow-hidden p-4 sm:p-5', className)}>
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-gradient-to-br to-transparent blur-2xl',
          styles.halo,
        )}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">{label}</p>
          <div className="mt-2 truncate text-[1.7rem] font-semibold leading-tight tracking-tight text-ink tabular sm:text-[1.85rem]">
            {value}
          </div>
        </div>
        {Icon ? (
          <div
            className={cn(
              'clay-pill flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl',
              styles.icon,
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
          </div>
        ) : null}
      </div>
      <div className="relative mt-3 flex min-h-4 flex-wrap items-center gap-2">
        {hint ? <p className="text-[11px] leading-relaxed text-muted">{hint}</p> : null}
        {badge}
      </div>
    </Card>
  );
}
