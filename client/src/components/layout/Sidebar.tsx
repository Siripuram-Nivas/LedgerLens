import { Link, NavLink } from 'react-router-dom';
import {
  ArrowLeftRight,
  FlaskConical,
  LayoutDashboard,
  LifeBuoy,
  ScrollText,
  Settings,
  ShieldCheck,
  Undo2,
  Wallet,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useMeta, useExceptions } from '../../lib/queries';
import { cn } from '../../lib/cn';
import { BrandMark } from './BrandMark';
import { ConnectionBadge } from './ConnectionBadge';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  badge?: number;
}

const monitor: NavItem[] = [
  { to: '/overview', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
];

const operate: NavItem[] = [
  { to: '/reconciliation', label: 'Reconciliation', icon: ShieldCheck },
  { to: '/settlements', label: 'Settlements', icon: Wallet },
  { to: '/refunds', label: 'Refunds', icon: Undo2 },
  { to: '/events', label: 'Event log', icon: ScrollText },
];

const system: NavItem[] = [
  { to: '/demo', label: 'Demo lab', icon: FlaskConical },
  { to: '/settings', label: 'Settings', icon: Settings },
];

function NavSection({
  label,
  items,
  onNavigate,
}: {
  label: string;
  items: NavItem[];
  onNavigate: () => void;
}) {
  return (
    <div>
      <p className="px-3 pb-2 pt-5 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-muted-light">
        {label}
      </p>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.end}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'group relative flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[12.5px] font-semibold transition-all duration-150',
                  isActive
                    ? 'bg-brand-50 text-brand-800 shadow-[inset_3px_3px_8px_rgb(44_57_87/0.1),inset_-3px_-3px_8px_rgb(255_255_255/0.9)]'
                    : 'text-ink-soft hover:bg-white/60 hover:text-ink hover:shadow-[4px_4px_12px_-10px_rgb(44_57_87/0.35),-4px_-4px_12px_-10px_rgb(255_255_255/0.9)]',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      'absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-brand-600 transition-opacity',
                      isActive ? 'opacity-100' : 'opacity-0',
                    )}
                    aria-hidden
                  />
                  <item.icon
                    className={cn(
                      'h-4 w-4 shrink-0 transition-colors',
                      isActive ? 'text-brand-600' : 'text-muted-light group-hover:text-muted',
                    )}
                    aria-hidden
                  />
                  <span className="flex-1 truncate">{item.label}</span>
                  {typeof item.badge === 'number' && item.badge > 0 ? (
                    <span className="rounded-full bg-danger-600 px-1.5 py-0.5 text-[9.5px] font-bold leading-none text-white tabular shadow-[inset_0_1px_0_rgb(255_255_255/0.25)]">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  ) : null}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { data: meta } = useMeta();
  const { data: exceptionData } = useExceptions({ page: 1, limit: 1 }, Boolean(meta));
  const openCount = (exceptionData?.counts.open ?? 0) + (exceptionData?.counts.underReview ?? 0);

  const navOperate = operate.map((item) =>
    item.to === '/reconciliation' ? { ...item, badge: openCount } : item,
  );

  return (
    <>
      {open ? (
        <div
          className="animate-fade fixed inset-0 z-40 bg-[#1b2333]/40 backdrop-blur-[3px] lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      ) : null}
      <aside
        className={cn(
          'clay-panel-lifted fixed inset-y-3 left-3 z-50 flex w-[260px] flex-col overflow-hidden rounded-[2rem] text-ink transition-transform duration-200 lg:translate-x-0',
          open ? 'visible translate-x-0' : 'invisible -translate-x-[calc(100%_+_1rem)] lg:visible',
        )}
        aria-label="Main navigation"
      >
        <div className="flex h-[68px] shrink-0 items-center gap-2.5 border-b border-white/70 px-4">
          <Link
            to="/"
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            aria-label="LedgerLens home"
          >
            <BrandMark className="h-9 w-9" />
            <span className="min-w-0">
              <span className="block text-[14px] font-semibold leading-tight tracking-tight">
                LedgerLens
              </span>
              <span className="block text-[9px] uppercase tracking-[0.16em] text-muted">
                Payment reconciliation
              </span>
            </span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-muted transition hover:bg-surface-sunken hover:text-ink lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav aria-label="Workspace sections" className="scrollbar-thin flex-1 overflow-y-auto px-2.5 pb-4">
          <NavSection label="Monitor" items={monitor} onNavigate={onClose} />
          <NavSection label="Operate" items={navOperate} onNavigate={onClose} />
          <NavSection label="Workspace" items={system} onNavigate={onClose} />
        </nav>

        <div className="shrink-0 space-y-2.5 border-t border-white/70 p-3">
          <div className="clay-inset rounded-2xl p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-ink-soft">
                <FlaskConical className="h-3.5 w-3.5 text-warning-600" aria-hidden />
                {meta?.demoMode ? 'Demo environment' : 'Sandbox environment'}
              </span>
              <ConnectionBadge />
            </div>
            <p className="mt-1.5 text-[10px] leading-relaxed text-muted">
              {meta?.demoMode
                ? 'Simulated payments only. No real funds move.'
                : 'Connected provider environment.'}
            </p>
            <div className="mt-2 flex items-center justify-between border-t border-white/60 pt-2 text-[9.5px] uppercase tracking-wider text-muted-light">
              <span>{meta?.persistence ?? '…'}</span>
              <span>{meta?.environment ?? '…'}</span>
            </div>
          </div>
          <div className="flex items-start gap-2 px-1.5 text-[9.5px] leading-relaxed text-muted-light">
            <LifeBuoy className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
            <span>Local prototype · no authentication. Do not use with real financial data.</span>
          </div>
        </div>
      </aside>
    </>
  );
}
