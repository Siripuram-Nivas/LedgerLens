import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';
import type { BadgeTone, StatusMeta } from '../../lib/status';

const toneClasses: Record<BadgeTone, string> = {
  success: 'border-success-100 bg-success-50 text-success-700',
  warning: 'border-warning-100 bg-warning-50 text-warning-700',
  danger: 'border-danger-100 bg-danger-50 text-danger-700',
  info: 'border-info-100 bg-info-50 text-info-700',
  neutral: 'border-white/80 bg-surface-sunken text-muted',
  brand: 'border-brand-100 bg-brand-50 text-brand-700',
  violet: 'border-violet-200 bg-violet-50 text-violet-700',
};

const dotClasses: Record<BadgeTone, string> = {
  success: 'bg-success-600',
  warning: 'bg-warning-600',
  danger: 'bg-danger-600',
  info: 'bg-info-600',
  neutral: 'bg-muted-light',
  brand: 'bg-brand-600',
  violet: 'bg-violet-600',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  dot?: boolean;
}

export function Badge({ className, tone = 'neutral', dot = false, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-semibold leading-5 shadow-[inset_0_1px_0_rgb(255_255_255/0.8)]',
        toneClasses[tone],
        className,
      )}
      {...props}
    >
      {dot ? <span className={cn('h-1.5 w-1.5 rounded-full', dotClasses[tone])} aria-hidden /> : null}
      {children}
    </span>
  );
}

export function StatusBadge({
  meta,
  dot = true,
  className,
}: {
  meta: StatusMeta;
  dot?: boolean;
  className?: string;
}) {
  return (
    <Badge tone={meta.tone} dot={dot} className={className} title={meta.description}>
      {meta.label}
    </Badge>
  );
}

export function SeverityBadge({ severity }: { severity: 'HIGH' | 'MEDIUM' | 'LOW' }) {
  const tone = severity === 'HIGH' ? 'danger' : severity === 'MEDIUM' ? 'warning' : 'neutral';
  return (
    <Badge tone={tone} dot>
      {severity.toLowerCase()}
    </Badge>
  );
}
