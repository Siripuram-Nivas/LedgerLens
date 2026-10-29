import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';
import { cn } from '../../lib/cn';

function pageWindow(page: number, totalPages: number): Array<number | 'ellipsis'> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }
  const pages = new Set<number>([1, totalPages, page - 1, page, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((value) => pages.add(value));
  if (page >= totalPages - 2) {
    [totalPages - 3, totalPages - 2, totalPages - 1].forEach((value) => pages.add(value));
  }
  const sorted = [...pages].filter((value) => value >= 1 && value <= totalPages).sort((a, b) => a - b);
  const result: Array<number | 'ellipsis'> = [];
  sorted.forEach((value, index) => {
    if (index > 0 && value - sorted[index - 1] > 1) result.push('ellipsis');
    result.push(value);
  });
  return result;
}

export function Pagination({
  page,
  limit,
  total,
  totalPages,
  onPageChange,
  className,
}: {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  const first = total === 0 ? 0 : (page - 1) * limit + 1;
  const last = total === 0 ? 0 : Math.min(total, page * limit);
  const pages = pageWindow(page, Math.max(1, totalPages));

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-between gap-3 border-t border-line px-4 py-3 text-xs text-muted sm:flex-row sm:px-5',
        className,
      )}
    >
      <p aria-live="polite">
        Showing <span className="font-semibold text-ink-soft tabular">{first}</span>–
        <span className="font-semibold text-ink-soft tabular">{last}</span> of{' '}
        <span className="font-semibold text-ink-soft tabular">{total}</span>
      </p>
      <nav className="flex items-center gap-1" aria-label="Pagination">
        <Button
          variant="secondary"
          size="icon"
          className="h-8 w-8"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {pages.map((value, index) =>
          value === 'ellipsis' ? (
            <span key={`ellipsis-${index}`} className="px-1.5 text-muted-light" aria-hidden>
              …
            </span>
          ) : (
            <button
              key={value}
              type="button"
              onClick={() => onPageChange(value)}
              aria-label={`Page ${value}`}
              aria-current={value === page ? 'page' : undefined}
              className={cn(
                'h-8 min-w-8 rounded-lg border px-2 text-xs font-medium tabular transition',
                value === page
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'border-transparent text-ink-soft hover:border-line-strong hover:bg-surface-sunken',
              )}
            >
              {value}
            </button>
          ),
        )}
        <Button
          variant="secondary"
          size="icon"
          className="h-8 w-8"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </nav>
    </div>
  );
}
