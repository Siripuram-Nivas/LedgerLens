import { NavLink } from 'react-router-dom';
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
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
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
      <p className="px-3 pb-1.5 pt-4 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-white/35">
        {label}
      </p>
      <ul className="space-y-0.5">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.end}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-[12.5px] font-medium transition-colors',
                  isActive
                    ? 'bg-white/[0.09] text-white'
                    : 'text-white/62 hover:bg-white/[0.05] hover:text-white/90',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      'absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r bg-brand-400 transition-opacity',
                      isActive ? 'opacity-100' : 'opacity-0',
                    )}
                    aria-hidden
                  />
                  <item.icon
                    className={cn(
                      'h-4 w-4 shrink-0 transition-colors',
                      isActive ? 'text-brand-300' : 'text-white/45 group-hover:text-white/75',
                    )}
                    aria-hidden
                  />
                  <span className="flex-1 truncate">{item.label}</span>
                  {typeof item.badge === 'number' && item.badge > 0 ? (
                    <span className="rounded-full bg-danger-500/90 px-1.5 py-0.5 text-[9.5px] font-bold leading-none text-white tabular">
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
          className="animate-fade fixed inset-0 z-40 bg-navy-950/55 backdrop-blur-[2px] lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      ) : null}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[248px] flex-col bg-navy-900 text-white transition-transform duration-200 lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label="Main navigation"
      >
        <div className="flex h-[60px] shrink-0 items-center gap-2.5 border-b border-white/[0.07] px-4">
          <BrandMark className="h-8 w-8" />
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold leading-tight tracking-tight">LedgerLens</p>
            <p className="text-[9.5px] uppercase tracking-[0.15em] text-white/38">
              Payment reconciliation
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-white/50 hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="scrollbar-thin flex-1 overflow-y-auto px-2 pb-4">
          <NavSection label="Monitor" items={monitor} onNavigate={onClose} />
          <NavSection label="Operate" items={navOperate} onNavigate={onClose} />
          <NavSection label="Workspace" items={system} onNavigate={onClose} />
        </nav>

        <div className="shrink-0 space-y-2.5 border-t border-white/[0.07] p-3">
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.045] p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-white/90">
                <FlaskConical className="h-3.5 w-3.5 text-amber-300" aria-hidden />
                {meta?.demoMode ? 'Demo environment' : 'Sandbox environment'}
              </span>
              <ConnectionBadge />
            </div>
            <p className="mt-1.5 text-[10px] leading-relaxed text-white/40">
              {meta?.demoMode
                ? 'Simulated payments only. No real funds move.'
                : 'Connected provider environment.'}
            </p>
            <div className="mt-2 flex items-center justify-between border-t border-white/[0.06] pt-2 text-[9.5px] uppercase tracking-wider text-white/35">
              <span>{meta?.persistence ?? '…'}</span>
              <span>{meta?.environment ?? '…'}</span>
            </div>
          </div>
          <div className="flex items-start gap-2 px-1.5 text-[9.5px] leading-relaxed text-white/30">
            <LifeBuoy className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
            <span>Local prototype · no authentication. Do not use with real financial data.</span>
          </div>
        </div>
      </aside>
    </>
  );
}
