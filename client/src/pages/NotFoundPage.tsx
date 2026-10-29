import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { buttonClassName } from '../components/ui/Button';

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="clay-panel flex h-14 w-14 items-center justify-center rounded-2xl text-muted">
        <Compass className="h-5 w-5" aria-hidden />
      </div>
      <p className="mt-4 font-mono text-xs text-muted">404</p>
      <h1 className="mt-1 text-xl font-semibold tracking-tight text-ink">
        This page is not in the ledger
      </h1>
      <p className="mt-2 max-w-sm text-[12.5px] leading-relaxed text-muted">
        The address does not match a LedgerLens view. Financial records were not affected.
      </p>
      <Link to="/overview" className={buttonClassName({ className: 'mt-6' })}>
        Back to overview
      </Link>
    </div>
  );
}
