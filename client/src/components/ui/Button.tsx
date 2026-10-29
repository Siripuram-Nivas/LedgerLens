import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle';
type Size = 'sm' | 'md' | 'icon';

const variants: Record<Variant, string> = {
  primary:
    'border border-brand-600 bg-brand-600 text-white shadow-[0_1px_2px_rgb(37_99_235/0.35)] hover:bg-brand-700 hover:border-brand-700 active:bg-brand-700',
  secondary:
    'border border-line-strong bg-surface text-ink hover:bg-surface-sunken active:bg-line/40',
  ghost: 'border border-transparent bg-transparent text-ink-soft hover:bg-surface-sunken hover:text-ink',
  danger:
    'border border-danger-600 bg-danger-600 text-white hover:bg-danger-700 hover:border-danger-700',
  subtle:
    'border border-brand-100 bg-brand-50 text-brand-700 hover:bg-brand-100 hover:text-brand-900',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 gap-1.5 rounded-lg px-2.5 text-xs',
  md: 'h-9.5 gap-2 rounded-lg px-3.5 text-[13px]',
  icon: 'h-9 w-9 rounded-lg p-0',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
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
      className={cn(
        'inline-flex shrink-0 items-center justify-center font-medium transition-colors transition-shadow disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
      {children}
    </button>
  );
});
