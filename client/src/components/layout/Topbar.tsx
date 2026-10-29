import { Link, useLocation } from 'react-router-dom';
import { FlaskConical, Menu, ShieldAlert } from 'lucide-react';
import { useMeta } from '../../lib/queries';
import { ConnectionBadge } from './ConnectionBadge';
import { Badge } from '../ui/Badge';

const titles: Record<string, string> = {
  '/overview': 'Overview',
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
    <header className="sticky top-0 z-30 flex h-[64px] items-center gap-3 bg-canvas/75 px-4 backdrop-blur-md sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={onMenu}
        className="clay-panel flex h-10 w-10 items-center justify-center rounded-xl text-ink-soft transition hover:-translate-y-0.5 lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-4 w-4" />
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[11px] text-muted">
          <Link to="/" className="hidden rounded transition hover:text-ink sm:inline">
            LedgerLens
          </Link>
          <span className="hidden text-line-strong sm:inline">/</span>
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
            className="clay-pill hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-semibold text-warning-700 transition hover:-translate-y-0.5 sm:inline-flex"
          >
            <FlaskConical className="h-3 w-3" aria-hidden />
            Demo data
          </Link>
        )}
        <ConnectionBadge />
        <span className="hidden h-5 w-px bg-line-strong/60 sm:block" aria-hidden />
        <Link
          to="/settings"
          className="hidden items-center gap-1.5 rounded-xl px-2 py-1.5 text-[11px] text-muted transition hover:bg-white/60 hover:text-ink sm:inline-flex"
          title={meta?.accessControlNote}
        >
          <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
          No auth
        </Link>
      </div>
    </header>
  );
}
