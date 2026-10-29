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
import { NotFoundPage } from './pages/NotFoundPage';

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
      <div className="shimmer h-8 w-56 rounded-md" aria-hidden />
      <div className="shimmer h-4 w-80 max-w-full rounded-md" aria-hidden />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="shimmer h-24 rounded-card border border-line bg-surface"
            aria-hidden
          />
        ))}
      </div>
      <div className="shimmer h-72 rounded-card border border-line bg-surface" aria-hidden />
    </div>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RealtimeProvider>
          <TooltipProvider>
            <BrowserRouter>
              <AppBootstrap>
                <ErrorBoundary>
                  <Suspense fallback={<RouteFallback />}>
                    <Routes>
                      <Route element={<AppShell />}>
                        <Route index element={<OverviewPage />} />
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
                  </Suspense>
                </ErrorBoundary>
              </AppBootstrap>
            </BrowserRouter>
          </TooltipProvider>
        </RealtimeProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
