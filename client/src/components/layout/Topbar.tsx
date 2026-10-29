import { Link, useLocation } from 'react-router-dom';
import { FlaskConical, Menu, ShieldAlert } from 'lucide-react';
import { useMeta } from '../../lib/queries';
import { ConnectionBadge } from './ConnectionBadge';
import { Badge } from '../ui/Badge';

const titles: Record<string, string> = {
  '/': 'Overview',
  '/transactions': 'Transactions',
  '/reconciliation': 'Reconciliation',
  '/settlements': 'Settlements',
  '/refunds': 'Refunds',
  '/events': 'Event log',
  '/demo': 'Demo lab',
  '/settings': 'Settings',
};

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const location = useLocation();
  const { data: meta } = useMeta();
  const title =
    titles[location.pathname] ??
    (location.pathname.startsWith('/transactions')
      ? 'Transactions'
      : location.pathname.startsWith('/reconciliation')
        ? 'Reconciliation'
        : 'LedgerLens');

  return (
    <header className="sticky top-0 z-30 flex h-[60px] items-center gap-3 border-b border-line bg-canvas/85 px-4 backdrop-blur-md sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={onMenu}
        className="rounded-lg border border-line bg-surface p-1.5 text-ink-soft shadow-sm hover:bg-surface-sunken lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-4 w-4" />
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[11px] text-muted">
          <span className="hidden sm:inline">Workspace</span>
          <span className="hidden text-line-strong sm:inline">/</span>
          <span className="font-semibold text-ink-soft">{title}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {meta && !meta.demoMode ? (
          <Badge tone="warning" dot className="hidden sm:inline-flex">
            Provider mode
          </Badge>
        ) : (
          <Link
            to="/demo"
            className="hidden items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-800 transition hover:bg-amber-100 sm:inline-flex"
          >
            <FlaskConical className="h-3 w-3" aria-hidden />
            Demo data
          </Link>
        )}
        <ConnectionBadge />
        <span className="hidden h-5 w-px bg-line sm:block" aria-hidden />
        <Link
          to="/settings"
          className="hidden items-center gap-1.5 rounded-lg px-1.5 py-1 text-[11px] text-muted transition hover:text-ink sm:inline-flex"
          title={meta?.accessControlNote}
        >
          <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
          No auth
        </Link>
      </div>
    </header>
  );
}
