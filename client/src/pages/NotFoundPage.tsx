import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Button } from '../components/ui/Button';

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-line bg-surface text-muted shadow-card">
        <Compass className="h-5 w-5" />
      </div>
      <p className="mt-4 font-mono text-xs text-muted">404</p>
      <h1 className="mt-1 text-lg font-semibold text-ink">This page is not in the ledger</h1>
      <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-muted">
        The address does not match a LedgerLens view. Financial records were not affected.
      </p>
      <Link
        to="/"
        className="mt-5 inline-flex h-9.5 items-center justify-center gap-2 rounded-lg border border-brand-600 bg-brand-600 px-3.5 text-[13px] font-medium text-white shadow-[0_1px_2px_rgb(37_99_235/0.35)] transition-colors hover:border-brand-700 hover:bg-brand-700"
      >
        Back to overview
      </Link>
    </div>
  );
}
