import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, ShieldAlert } from 'lucide-react';
import { cn } from '../../lib/cn';

const variants = {
  info: {
    icon: Info,
    container: 'border-info-100 bg-info-50 text-info-700',
  },
  success: {
    icon: CheckCircle2,
    container: 'border-success-100 bg-success-50 text-success-700',
  },
  warning: {
    icon: AlertTriangle,
    container: 'border-warning-100 bg-warning-50 text-warning-700',
  },
  danger: {
    icon: ShieldAlert,
    container: 'border-danger-100 bg-danger-50 text-danger-700',
  },
  neutral: {
    icon: Info,
    container: 'border-line bg-surface-sunken text-ink-soft',
  },
};

export function Callout({
  tone = 'info',
  title,
  children,
  className,
}: {
  tone?: keyof typeof variants;
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const variant = variants[tone];
  const Icon = variant.icon;
  return (
    <div className={cn('flex gap-3 rounded-lg border p-3.5', variant.container, className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 text-xs leading-relaxed">
        {title ? <p className="mb-0.5 font-semibold">{title}</p> : null}
        <div className="opacity-90">{children}</div>
      </div>
    </div>
  );
}
