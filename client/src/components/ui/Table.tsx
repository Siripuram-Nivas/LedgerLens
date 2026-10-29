import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export function Table({
  children,
  minWidth = 900,
  className,
}: {
  children: ReactNode;
  minWidth?: number;
  className?: string;
}) {
  return (
    <div className="scrollbar-thin overflow-x-auto rounded-b-card">
      <table
        className={cn('w-full border-collapse text-left text-[13px]', className)}
        style={{ minWidth }}
      >
        {children}
      </table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="border-b border-white/70 bg-surface-sunken/80">
      <tr>{children}</tr>
    </thead>
  );
}

export function Th({
  children,
  className,
  align = 'left',
  ...props
}: ThHTMLAttributes<HTMLTableCellElement> & { align?: 'left' | 'right' | 'center' }) {
  return (
    <th
      scope="col"
      className={cn(
        'whitespace-nowrap px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.09em] text-muted',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        className,
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-line/80">{children}</tbody>;
}

export function Tr({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        'transition-colors duration-150 hover:bg-brand-50/45 focus-within:bg-brand-50/45',
        className,
      )}
      {...props}
    >
      {children}
    </tr>
  );
}

export function Td({
  children,
  className,
  align = 'left',
  ...props
}: TdHTMLAttributes<HTMLTableCellElement> & { align?: 'left' | 'right' | 'center' }) {
  return (
    <td
      className={cn(
        'px-4 py-3.5 align-middle text-ink-soft',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        className,
      )}
      {...props}
    >
      {children}
    </td>
  );
}

export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('font-mono text-[11.5px] tracking-tight text-ink', className)}>
      {children}
    </span>
  );
}
