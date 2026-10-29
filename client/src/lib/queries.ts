import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import {
  advanceRefund,
  assignException,
  getDashboard,
  getDemoStatus,
  getEvent,
  getException,
  getHealth,
  getMeta,
  getRefund,
  getSettlement,
  getTransaction,
  listEvents,
  listExceptions,
  listRefunds,
  listRuns,
  listSettlements,
  listTransactions,
  resetDemo,
  resolveException,
  runDemoScenario,
  runReconciliation,
  type DashboardRange,
} from './api';
import { invalidateLedgerData, queryClient, queryKeys } from './queryClient';
import type {
  DemoScenario,
  EventFilters,
  ExceptionFilters,
  RefundFilters,
  SettlementFilters,
  TransactionFilters,
} from '../types/api';

export function useMeta() {
  return useQuery({
    queryKey: queryKeys.meta,
    queryFn: getMeta,
    staleTime: Infinity,
    retry: 2,
  });
}

export function useHealth() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: getHealth,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function useDashboard(range: DashboardRange, from?: string, to?: string) {
  return useQuery({
    queryKey: [...queryKeys.dashboard, range, from ?? null, to ?? null],
    queryFn: ({ signal }) => getDashboard(range, from, to, signal),
    placeholderData: keepPreviousData,
  });
}

export function useTransactions(filters: TransactionFilters) {
  return useQuery({
    queryKey: [...queryKeys.transactions, filters],
    queryFn: ({ signal }) => listTransactions(filters, signal),
    placeholderData: keepPreviousData,
  });
}

export function useTransaction(reference: string | null) {
  return useQuery({
    queryKey: queryKeys.transaction(reference ?? ''),
    queryFn: () => getTransaction(reference as string),
    enabled: Boolean(reference),
    staleTime: 5_000,
  });
}

export function useExceptions(filters: ExceptionFilters, enabled = true) {
  return useQuery({
    queryKey: [...queryKeys.exceptions, filters],
    queryFn: ({ signal }) => listExceptions(filters, signal),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useException(reference: string | null) {
  return useQuery({
    queryKey: queryKeys.exception(reference ?? ''),
    queryFn: () => getException(reference as string),
    enabled: Boolean(reference),
    staleTime: 5_000,
  });
}

export function useRuns() {
  return useQuery({
    queryKey: queryKeys.runs,
    queryFn: listRuns,
  });
}

export function useSettlements(filters: SettlementFilters) {
  return useQuery({
    queryKey: [...queryKeys.settlements, filters],
    queryFn: ({ signal }) => listSettlements(filters, signal),
    placeholderData: keepPreviousData,
  });
}

export function useSettlement(reference: string | null) {
  return useQuery({
    queryKey: queryKeys.settlement(reference ?? ''),
    queryFn: () => getSettlement(reference as string),
    enabled: Boolean(reference),
    staleTime: 5_000,
  });
}

export function useRefunds(filters: RefundFilters) {
  return useQuery({
    queryKey: [...queryKeys.refunds, filters],
    queryFn: ({ signal }) => listRefunds(filters, signal),
    placeholderData: keepPreviousData,
  });
}

export function useRefund(reference: string | null) {
  return useQuery({
    queryKey: queryKeys.refund(reference ?? ''),
    queryFn: () => getRefund(reference as string),
    enabled: Boolean(reference),
    staleTime: 5_000,
  });
}

export function useEvents(filters: EventFilters) {
  return useQuery({
    queryKey: [...queryKeys.events, filters],
    queryFn: ({ signal }) => listEvents(filters, signal),
    placeholderData: keepPreviousData,
  });
}

export function useEvent(reference: string | null) {
  return useQuery({
    queryKey: queryKeys.event(reference ?? ''),
    queryFn: () => getEvent(reference as string),
    enabled: Boolean(reference),
    staleTime: 5_000,
  });
}

export function useDemoStatus() {
  return useQuery({
    queryKey: queryKeys.demo,
    queryFn: getDemoStatus,
    staleTime: 5_000,
  });
}

export function useAssignException() {
  return useMutation({
    mutationFn: (variables: { reference: string; assignedTo: string; note?: string }) =>
      assignException(variables.reference, {
        assignedTo: variables.assignedTo,
        note: variables.note,
      }),
    onSuccess: async (detail) => {
      queryClient.setQueryData(queryKeys.exception(detail.exception.exceptionRef), detail);
      await invalidateLedgerData();
    },
  });
}

export function useResolveException() {
  return useMutation({
    mutationFn: (variables: {
      reference: string;
      resolutionType: string;
      note: string;
    }) =>
      resolveException(variables.reference, {
        resolutionType: variables.resolutionType,
        note: variables.note,
      }),
    onSuccess: async (detail) => {
      queryClient.setQueryData(queryKeys.exception(detail.exception.exceptionRef), detail);
      await invalidateLedgerData();
    },
  });
}

export function useRunReconciliation() {
  return useMutation({
    mutationFn: (input: { scope?: 'all' | 'payment'; transactionRef?: string }) =>
      runReconciliation(input),
    onSuccess: async () => {
      await invalidateLedgerData();
    },
  });
}

export function useAdvanceRefund() {
  return useMutation({
    mutationFn: (reference: string) => advanceRefund(reference),
    onSuccess: async () => {
      await invalidateLedgerData();
    },
  });
}

export function useDemoScenario() {
  return useMutation({
    mutationFn: (input: {
      scenario: DemoScenario;
      amountMinor?: number;
      note?: string;
    }) => runDemoScenario(input),
    onSuccess: async () => {
      await invalidateLedgerData();
    },
  });
}

export function useResetDemo() {
  return useMutation({
    mutationFn: (confirm: string) => resetDemo(confirm),
    onSuccess: async () => {
      await invalidateLedgerData();
    },
  });
}
