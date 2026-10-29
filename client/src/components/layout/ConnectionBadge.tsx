import { useRealtime } from '../providers/RealtimeProvider';
import { Tooltip } from '../ui/Tooltip';
import { cn } from '../../lib/cn';

const meta = {
  connected: {
    label: 'Live',
    dot: 'bg-emerald-400',
    text: 'text-emerald-700',
    bg: 'bg-emerald-50 border-emerald-100',
  },
  connecting: {
    label: 'Connecting',
    dot: 'bg-amber-400',
    text: 'text-warning-700',
    bg: 'bg-warning-50 border-warning-100',
  },
  disconnected: {
    label: 'Polling',
    dot: 'bg-danger-500',
    text: 'text-danger-700',
    bg: 'bg-danger-50 border-danger-100',
  },
  error: {
    label: 'Polling',
    dot: 'bg-danger-500',
    text: 'text-danger-700',
    bg: 'bg-danger-50 border-danger-100',
  },
};

export function ConnectionBadge({ className }: { className?: string }) {
  const { status, transport, error } = useRealtime();
  const current = meta[status];
  return (
    <Tooltip
      content={
        status === 'connected'
          ? `Socket.IO is connected${transport ? ` over ${transport}` : ''}. Updates arrive in real time.`
          : error ?? 'The realtime socket is unavailable. Data refreshes every 15 seconds.'
      }
    >
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-semibold leading-none',
          current.bg,
          current.text,
          className,
        )}
      >
        <span className="relative flex h-1.5 w-1.5">
          {status === 'connected' ? (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
          ) : null}
          <span className={cn('relative inline-flex h-1.5 w-1.5 rounded-full', current.dot)} />
        </span>
        {current.label}
      </span>
    </Tooltip>
  );
}
