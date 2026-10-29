import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

const variants: Record<ButtonVariant, string> = {
  primary:
    'border border-brand-700/20 bg-brand-600 text-white shadow-[0_10px_20px_-12px_rgb(48_69_170/0.8),inset_0_1px_0_rgb(255_255_255/0.3)] hover:-translate-y-0.5 hover:bg-brand-700 hover:shadow-[0_14px_26px_-12px_rgb(48_69_170/0.75),inset_0_1px_0_rgb(255_255_255/0.3)]',
  secondary:
    'border border-white/80 bg-[linear-gradient(145deg,#ffffff,#eef2f8)] text-ink-soft shadow-[7px_7px_18px_-12px_rgb(44_57_87/0.35),-7px_-7px_18px_-12px_rgb(255_255_255/0.95),inset_0_1px_0_rgb(255_255_255/0.9)] hover:-translate-y-0.5 hover:text-ink hover:shadow-[10px_10px_22px_-13px_rgb(44_57_87/0.4),-8px_-8px_20px_-13px_rgb(255_255_255/0.95)]',
  ghost:
    'border border-transparent bg-transparent text-ink-soft hover:border-white/70 hover:bg-surface hover:text-ink hover:shadow-[6px_6px_16px_-12px_rgb(44_57_87/0.28),-6px_-6px_16px_-12px_rgb(255_255_255/0.9)]',
  danger:
    'border border-danger-700/20 bg-danger-600 text-white shadow-[0_10px_20px_-12px_rgb(165_43_59/0.8),inset_0_1px_0_rgb(255_255_255/0.25)] hover:-translate-y-0.5 hover:bg-danger-700',
  subtle:
    'border border-brand-100/80 bg-brand-50 text-brand-700 shadow-[inset_0_1px_0_rgb(255_255_255/0.85)] hover:bg-brand-100 hover:text-brand-900',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 gap-1.5 rounded-xl px-3 text-xs',
  md: 'h-10 gap-2 rounded-xl px-4 text-[13px]',
  lg: 'h-12 gap-2.5 rounded-2xl px-6 text-sm',
  icon: 'h-10 w-10 rounded-xl p-0',
};

export function buttonClassName({
  variant = 'primary',
  size = 'md',
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return cn(
    'clay-pressable inline-flex shrink-0 items-center justify-center font-semibold disabled:pointer-events-none disabled:opacity-50',
    variants[variant],
    sizes[size],
    className,
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', loading = false, disabled, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={props.type ?? 'button'}
      disabled={disabled || loading}
      className={buttonClassName({ variant, size, className })}
      {...props}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
      {children}
    </button>
  );
});
