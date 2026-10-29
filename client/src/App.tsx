import { lazy, Suspense } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { queryClient } from './lib/queryClient';
import { ToastProvider } from './components/providers/ToastProvider';
import { RealtimeProvider } from './components/providers/RealtimeProvider';
import { TooltipProvider } from './components/ui/Tooltip';
import { AppBootstrap } from './components/AppBootstrap';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppShell } from './components/layout/AppShell';
import { BrandMark } from './components/layout/BrandMark';
import { NotFoundPage } from './pages/NotFoundPage';

const LandingPage = lazy(() =>
  import('./pages/LandingPage').then((module) => ({ default: module.LandingPage })),
);
const OverviewPage = lazy(() =>
  import('./pages/OverviewPage').then((module) => ({ default: module.OverviewPage })),
);
const TransactionsPage = lazy(() =>
  import('./pages/TransactionsPage').then((module) => ({ default: module.TransactionsPage })),
);
const ReconciliationPage = lazy(() =>
  import('./pages/ReconciliationPage').then((module) => ({ default: module.ReconciliationPage })),
);
const SettlementsPage = lazy(() =>
  import('./pages/SettlementsPage').then((module) => ({ default: module.SettlementsPage })),
);
const RefundsPage = lazy(() =>
  import('./pages/RefundsPage').then((module) => ({ default: module.RefundsPage })),
);
const EventLogPage = lazy(() =>
  import('./pages/EventLogPage').then((module) => ({ default: module.EventLogPage })),
);
const DemoLabPage = lazy(() =>
  import('./pages/DemoLabPage').then((module) => ({ default: module.DemoLabPage })),
);
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage })),
);

function RouteFallback() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading view">
      <div className="shimmer h-8 w-56 rounded-xl" aria-hidden />
      <div className="shimmer h-4 w-80 max-w-full rounded-lg" aria-hidden />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="shimmer h-24 rounded-card border border-white/70 bg-surface"
            aria-hidden
          />
        ))}
      </div>
      <div className="shimmer h-72 rounded-card border border-white/70 bg-surface" aria-hidden />
    </div>
  );
}

function LandingFallback() {
  return (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      role="status"
      aria-label="Loading LedgerLens"
    >
      <div className="flex items-center gap-3">
        <BrandMark className="h-10 w-10" />
        <div>
          <p className="text-base font-semibold tracking-tight text-ink">LedgerLens</p>
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted">Opening the lens</p>
        </div>
      </div>
    </div>
  );
}

function Workspace() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RealtimeProvider>
          <TooltipProvider>
            <AppBootstrap>
              <ErrorBoundary>
                <Suspense fallback={<RouteFallback />}>
                  <AppShell />
                </Suspense>
              </ErrorBoundary>
            </AppBootstrap>
          </TooltipProvider>
        </RealtimeProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          index
          element={
            <Suspense fallback={<LandingFallback />}>
              <LandingPage />
            </Suspense>
          }
        />
        <Route element={<Workspace />}>
          <Route path="overview" element={<OverviewPage />} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="reconciliation" element={<ReconciliationPage />} />
          <Route path="settlements" element={<SettlementsPage />} />
          <Route path="refunds" element={<RefundsPage />} />
          <Route path="events" element={<EventLogPage />} />
          <Route path="demo" element={<DemoLabPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
