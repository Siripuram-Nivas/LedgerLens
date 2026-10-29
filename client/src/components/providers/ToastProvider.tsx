import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { cn } from '../../lib/cn';

export type ToastTone = 'info' | 'success' | 'warning' | 'danger' | 'neutral';

export interface ToastInput {
  title: string;
  description?: string;
  tone?: ToastTone;
  duration?: number;
}

interface ToastItem extends ToastInput {
  id: number;
  tone: ToastTone;
}

interface ToastContextValue {
  toast: (input: ToastInput) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const toneMeta: Record<
  ToastTone,
  { icon: typeof Info; className: string; iconClassName: string }
> = {
  info: {
    icon: Info,
    className: 'border-brand-200',
    iconClassName: 'text-brand-600',
  },
  success: {
    icon: CheckCircle2,
    className: 'border-success-100',
    iconClassName: 'text-success-600',
  },
  warning: {
    icon: AlertTriangle,
    className: 'border-warning-100',
    iconClassName: 'text-warning-600',
  },
  danger: {
    icon: XCircle,
    className: 'border-danger-100',
    iconClassName: 'text-danger-600',
  },
  neutral: {
    icon: Info,
    className: 'border-line',
    iconClassName: 'text-muted',
  },
};

let nextToastId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<number, number>());
  // A local mutation and its realtime echo can describe the same change. Collapse
  // identical notifications fired within a short window into one visible toast.
  const recent = useRef(new Map<string, { id: number; at: number }>());

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((item) => item.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const signature = `${input.title}\u0000${input.description ?? ''}`;
      const now = Date.now();
      const previous = recent.current.get(signature);
      if (previous && now - previous.at < 1_500) return previous.id;

      const id = nextToastId++;
      recent.current.set(signature, { id, at: now });
      if (recent.current.size > 40) {
        for (const [key, value] of recent.current) {
          if (now - value.at > 5_000) recent.current.delete(key);
        }
      }

      const item: ToastItem = { ...input, id, tone: input.tone ?? 'info' };
      setToasts((current) => [...current.slice(-3), item]);
      const duration = input.duration ?? 4_500;
      if (duration > 0) {
        const timer = window.setTimeout(() => dismiss(id), duration);
        timers.current.set(id, timer);
      }
      return id;
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-label="Notifications"
        className="pointer-events-none fixed inset-x-3 bottom-20 z-[80] flex flex-col items-end gap-2 sm:inset-x-auto sm:bottom-6 sm:right-6"
      >
        {toasts.map((item) => {
          const meta = toneMeta[item.tone];
          const Icon = meta.icon;
          return (
            <div
              key={item.id}
              role="status"
              className={cn(
                'animate-enter pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border bg-surface p-3.5 shadow-float',
                meta.className,
              )}
            >
              <Icon className={cn('mt-0.5 h-4.5 w-4.5 shrink-0', meta.iconClassName)} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{item.title}</p>
                {item.description ? (
                  <p className="mt-0.5 text-xs leading-relaxed text-muted">
                    {item.description}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                className="rounded-md p-1 text-muted-light transition hover:bg-surface-sunken hover:text-ink"
                aria-label="Dismiss notification"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used inside a ToastProvider');
  }
  return context;
}
