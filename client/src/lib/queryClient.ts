import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: 0,
    },
  },
});

export const queryKeys = {
  meta: ['meta'] as const,
  health: ['health'] as const,
  dashboard: ['dashboard'] as const,
  transactions: ['transactions'] as const,
  transaction: (reference: string) => ['transactions', reference] as const,
  exceptions: ['exceptions'] as const,
  exception: (reference: string) => ['exceptions', reference] as const,
  runs: ['reconciliation', 'runs'] as const,
  settlements: ['settlements'] as const,
  settlement: (reference: string) => ['settlements', reference] as const,
  refunds: ['refunds'] as const,
  refund: (reference: string) => ['refunds', reference] as const,
  events: ['events'] as const,
  event: (reference: string) => ['events', reference] as const,
  demo: ['demo'] as const,
};

/** Invalidate every ledger read after a financial or demo mutation. */
export function invalidateLedgerData(): Promise<unknown> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
    queryClient.invalidateQueries({ queryKey: queryKeys.transactions }),
    queryClient.invalidateQueries({ queryKey: queryKeys.exceptions }),
    queryClient.invalidateQueries({ queryKey: queryKeys.runs }),
    queryClient.invalidateQueries({ queryKey: queryKeys.settlements }),
    queryClient.invalidateQueries({ queryKey: queryKeys.refunds }),
    queryClient.invalidateQueries({ queryKey: queryKeys.events }),
    queryClient.invalidateQueries({ queryKey: queryKeys.demo }),
  ]);
}
