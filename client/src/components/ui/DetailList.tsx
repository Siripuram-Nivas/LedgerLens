import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface DetailItem {
  label: string;
  value: ReactNode;
  mono?: boolean;
  className?: string;
}

export function DetailList({
  items,
  className,
  dense = false,
}: {
  items: DetailItem[];
  className?: string;
  dense?: boolean;
}) {
  return (
    <dl
      className={cn(
        'overflow-hidden rounded-lg border border-line bg-surface',
        className,
      )}
    >
      {items.map((item) => (
        <div
          key={item.label}
          className={cn(
            'grid grid-cols-[minmax(112px,38%)_1fr] gap-3 border-b border-line px-3.5 last:border-b-0',
            dense ? 'py-2' : 'py-2.5',
          )}
        >
          <dt className="text-[11px] font-medium text-muted">{item.label}</dt>
          <dd
            className={cn(
              'min-w-0 break-words text-[12.5px] text-ink',
              item.mono && 'font-mono text-[11.5px]',
              item.className,
            )}
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
