const moneyFormatters = new Map<string, Intl.NumberFormat>();

export function formatMoney(
  amountMinor: number,
  currency: string,
  options: { maximumFractionDigits?: number; compact?: boolean } = {},
): string {
  const fraction = options.maximumFractionDigits ?? 2;
  const key = `${currency}:${fraction}:${options.compact ? 'c' : 's'}`;
  let formatter = moneyFormatters.get(key);
  if (!formatter) {
    try {
      formatter = new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency,
        minimumFractionDigits: fraction,
        maximumFractionDigits: fraction,
        notation: options.compact ? 'compact' : 'standard',
      });
    } catch {
      formatter = new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: fraction,
        maximumFractionDigits: fraction,
      });
    }
    moneyFormatters.set(key, formatter);
  }
  return formatter.format(amountMinor / 100);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-IN').format(value);
}

export function formatPercent(value: number, digits = 0): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function formatRelative(value: string | null | undefined, now = Date.now()): string {
  if (!value) return '—';
  const time = Date.parse(value);
  if (Number.isNaN(time)) return '—';
  const diffSeconds = Math.round((time - now) / 1000);
  const abs = Math.abs(diffSeconds);
  const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (abs < 60) return relative.format(Math.round(diffSeconds), 'second');
  if (abs < 3600) return relative.format(Math.round(diffSeconds / 60), 'minute');
  if (abs < 86_400) return relative.format(Math.round(diffSeconds / 3600), 'hour');
  if (abs < 2_592_000) return relative.format(Math.round(diffSeconds / 86_400), 'day');
  return relative.format(Math.round(diffSeconds / 2_592_000), 'month');
}

export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function formatBucket(bucket: string, granularity: 'hour' | 'day'): string {
  if (granularity === 'hour') {
    const date = new Date(bucket);
    if (Number.isNaN(date.getTime())) return bucket;
    return new Intl.DateTimeFormat('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  }
  const date = new Date(`${bucket}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return bucket;
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' }).format(date);
}

export function formatDurationMs(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  return `${Math.round(ms / 60_000)} min`;
}

export function maskRef(value: string, visible = 6): string {
  if (value.length <= visible) return value;
  return `${value.slice(0, visible)}…${value.slice(-4)}`;
}
