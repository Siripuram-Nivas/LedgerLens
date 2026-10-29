import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useMeta } from '../../lib/queries';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { data: meta } = useMeta();

  useEffect(() => {
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [location.pathname]);

  return (
    <div className="min-h-screen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-xl focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:shadow-float"
      >
        Skip to content
      </a>
      <Sidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="lg:pl-[284px]">
        <Topbar onMenu={() => setMobileOpen(true)} />
        <main
          id="main-content"
          className="mx-auto w-full max-w-[1480px] px-4 py-4 sm:px-6 lg:px-8 lg:py-5"
        >
          <Outlet />
        </main>
        <footer className="mx-auto flex w-full max-w-[1480px] flex-wrap items-center justify-between gap-2 px-4 pb-7 pt-3 text-[10px] text-muted sm:px-6 lg:px-8">
          <span>LedgerLens · local reconciliation prototype · integer minor units</span>
          <span className="font-mono">
            environment={meta?.environment ?? 'unknown'} · no real funds
          </span>
        </footer>
      </div>
    </div>
  );
}
