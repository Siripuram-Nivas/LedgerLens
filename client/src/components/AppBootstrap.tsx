import type { ReactNode } from 'react';
import { useMeta } from '../lib/queries';
import { errorMessage } from '../lib/api';
import { BrandMark } from '../components/layout/BrandMark';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';

export function AppBootstrap({ children }: { children: ReactNode }) {
  const { status, error, refetch } = useMeta();

  if (status === 'pending') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-3">
            <BrandMark className="h-10 w-10" />
            <div>
              <p className="text-base font-semibold tracking-tight text-ink">LedgerLens</p>
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted">
                Opening the ledger
              </p>
            </div>
          </div>
          <div className="mt-7 space-y-3 rounded-card border border-line bg-surface p-5 shadow-card">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
          <p className="mt-4 text-center text-[11px] text-muted">
            Connecting to the local API and realtime channel…
          </p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
        <div className="w-full max-w-md rounded-card border border-line bg-surface p-6 text-center shadow-card">
          <BrandMark className="mx-auto h-10 w-10" />
          <h1 className="mt-4 text-base font-semibold text-ink">The LedgerLens API is unreachable</h1>
          <p className="mt-1.5 text-xs leading-relaxed text-muted">
            {errorMessage(error)} Start the server with <code className="font-mono">npm run dev</code>{' '}
            and try again.
          </p>
          <Button className="mt-5" onClick={() => void refetch()}>
            Retry connection
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
