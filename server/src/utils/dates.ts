export const DAY_MS = 24 * 60 * 60 * 1000;

export function nowIso(): string {
  return new Date().toISOString();
}

export function isoDaysAgo(days: number, from = Date.now()): string {
  return new Date(from - days * DAY_MS).toISOString();
}

export function isoHoursAgo(hours: number, from = Date.now()): string {
  return new Date(from - hours * 60 * 60 * 1000).toISOString();
}

export function addDays(iso: string, days: number): string {
  return new Date(Date.parse(iso) + days * DAY_MS).toISOString();
}

export type RangePreset = '24h' | '7d' | '30d' | 'custom';

export interface ResolvedRange {
  preset: RangePreset;
  from: string;
  to: string;
  granularity: 'hour' | 'day';
  label: string;
}

export function resolveRange(
  preset: RangePreset,
  fromInput?: string,
  toInput?: string,
  now = Date.now(),
): ResolvedRange {
  const to = toInput ? new Date(toInput) : new Date(now);
  if (Number.isNaN(to.getTime())) throw new Error('Invalid to date');
  if (to.getTime() > now + 5 * 60 * 1000) throw new Error('The end of the range cannot be in the future');

  if (preset === 'custom') {
    if (!fromInput) throw new Error('A from date is required for a custom range');
    const from = new Date(fromInput);
    if (Number.isNaN(from.getTime())) throw new Error('Invalid from date');
    if (from > to) throw new Error('The start of the range must be before the end');
    if (to.getTime() - from.getTime() > 366 * DAY_MS) {
      throw new Error('Custom ranges are limited to 366 days');
    }
    const span = to.getTime() - from.getTime();
    return {
      preset,
      from: from.toISOString(),
      to: to.toISOString(),
      granularity: span <= 48 * 60 * 60 * 1000 ? 'hour' : 'day',
      label: `${from.toISOString().slice(0, 10)} → ${to.toISOString().slice(0, 10)}`,
    };
  }

  const presetDays = preset === '24h' ? 1 : preset === '7d' ? 7 : 30;
  const from = new Date(to.getTime() - presetDays * DAY_MS);
  return {
    preset,
    from: from.toISOString(),
    to: to.toISOString(),
    granularity: preset === '24h' ? 'hour' : 'day',
    label: preset === '24h' ? 'Last 24 hours' : preset === '7d' ? 'Last 7 days' : 'Last 30 days',
  };
}

export function dayKey(iso: string): string {
  return iso.slice(0, 10);
}
