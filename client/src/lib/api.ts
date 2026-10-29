import type {
  DashboardSummary,
  DemoScenario,
  DemoStatus,
  EventDetail,
  EventFilters,
  ExceptionDetail,
  ExceptionFilters,
  Health,
  Meta,
  PaginatedMeta,
  RefundDetail,
  RefundFilters,
  ReconciliationException,
  ReconciliationRun,
  SettlementDetail,
  SettlementFilters,
  TransactionDetail,
  TransactionFilters,
} from '../types/api';

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '/api/v1';

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  readonly requestId?: string;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: unknown,
    requestId?: string,
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }
}

export interface ListResponse<T> {
  data: T[];
  meta: PaginatedMeta;
}

type QueryValue = string | number | boolean | null | undefined;

function toQuery(params: Record<string, QueryValue>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body !== undefined) headers.set('Content-Type', 'application/json');

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiClientError(
      0,
      'NETWORK_ERROR',
      'Could not reach the LedgerLens API. Check that the server is running.',
    );
  }

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const body = payload as
      | { error?: { code?: string; message?: string; details?: unknown; requestId?: string } }
      | null;
    throw new ApiClientError(
      response.status,
      body?.error?.code ?? 'REQUEST_FAILED',
      body?.error?.message ?? `Request failed with status ${response.status}`,
      body?.error?.details,
      body?.error?.requestId,
    );
  }

  return payload as T;
}

function listMeta(payload: { meta?: PaginatedMeta & { items?: unknown } }): PaginatedMeta {
  const meta = payload.meta;
  return {
    page: meta?.page ?? 1,
    limit: meta?.limit ?? 20,
    total: meta?.total ?? 0,
    totalPages: meta?.totalPages ?? 1,
  };
}

export function getHealth(): Promise<Health> {
  return request<{ data: Health }>('/health').then((payload) => payload.data);
}

export function getMeta(): Promise<Meta> {
  return request<{ data: Meta }>('/meta').then((payload) => payload.data);
}

export type DashboardRange = '24h' | '7d' | '30d' | 'custom';

export function getDashboard(
  range: DashboardRange,
  from?: string,
  to?: string,
  signal?: AbortSignal,
): Promise<DashboardSummary> {
  return request<{ data: DashboardSummary }>(
    `/dashboard/summary${toQuery({ range, from, to })}`,
    { signal },
  ).then((payload) => payload.data);
}

export async function listTransactions(
  filters: TransactionFilters,
  signal?: AbortSignal,
): Promise<ListResponse<import('../types/api').Payment>> {
  const payload = await request<{
    data: import('../types/api').Payment[];
    meta: PaginatedMeta;
  }>(`/transactions${toQuery({ ...filters })}`, { signal });
  return { data: payload.data, meta: listMeta(payload) };
}

export function getTransaction(reference: string): Promise<TransactionDetail> {
  return request<{ data: TransactionDetail }>(
    `/transactions/${encodeURIComponent(reference)}`,
  ).then((payload) => payload.data);
}

export async function listExceptions(
  filters: ExceptionFilters,
  signal?: AbortSignal,
): Promise<ListResponse<ReconciliationException> & { counts: ExceptionCounts }> {
  const payload = await request<{
    data: ReconciliationException[];
    meta: PaginatedMeta & { counts?: ExceptionCounts };
  }>(`/reconciliation/exceptions${toQuery({ ...filters })}`, { signal });
  return {
    data: payload.data,
    meta: listMeta(payload),
    counts: payload.meta?.counts ?? { open: 0, underReview: 0, resolved: 0 },
  };
}

export interface ExceptionCounts {
  open: number;
  underReview: number;
  resolved: number;
}

export function getException(reference: string): Promise<ExceptionDetail> {
  return request<{ data: ExceptionDetail }>(
    `/reconciliation/exceptions/${encodeURIComponent(reference)}`,
  ).then((payload) => payload.data);
}

export function assignException(
  reference: string,
  input: { assignedTo: string; note?: string },
): Promise<ExceptionDetail> {
  return request<{ data: ExceptionDetail }>(
    `/reconciliation/exceptions/${encodeURIComponent(reference)}/assign`,
    { method: 'POST', body: JSON.stringify(input) },
  ).then((payload) => payload.data);
}

export function resolveException(
  reference: string,
  input: { resolutionType: string; note: string },
): Promise<ExceptionDetail> {
  return request<{ data: ExceptionDetail }>(
    `/reconciliation/exceptions/${encodeURIComponent(reference)}/resolve`,
    { method: 'POST', body: JSON.stringify(input) },
  ).then((payload) => payload.data);
}

export interface ReconciliationRunResult {
  run: ReconciliationRun;
  statuses: Record<string, number>;
  openExceptionCount: number;
}

export function runReconciliation(input: {
  scope?: 'all' | 'payment';
  transactionRef?: string;
}): Promise<ReconciliationRun> {
  // The API returns { run, statuses, openExceptionCount }; callers only need the
  // completed run record, so unwrap it here rather than at every call site.
  return request<{ data: ReconciliationRunResult }>('/reconciliation/run', {
    method: 'POST',
    body: JSON.stringify(input),
  }).then((payload) => payload.data.run);
}

export function listRuns(): Promise<ReconciliationRun[]> {
  return request<{ data: ReconciliationRun[] }>('/reconciliation/runs').then(
    (payload) => payload.data,
  );
}

export async function listSettlements(
  filters: SettlementFilters,
  signal?: AbortSignal,
): Promise<ListResponse<import('../types/api').Settlement>> {
  const payload = await request<{
    data: import('../types/api').Settlement[];
    meta: PaginatedMeta;
  }>(`/settlements${toQuery({ ...filters })}`, { signal });
  return { data: payload.data, meta: listMeta(payload) };
}

export function getSettlement(reference: string): Promise<SettlementDetail> {
  return request<{ data: SettlementDetail }>(
    `/settlements/${encodeURIComponent(reference)}`,
  ).then((payload) => payload.data);
}

export async function listRefunds(
  filters: RefundFilters,
  signal?: AbortSignal,
): Promise<ListResponse<import('../types/api').Refund>> {
  const payload = await request<{
    data: import('../types/api').Refund[];
    meta: PaginatedMeta;
  }>(`/refunds${toQuery({ ...filters })}`, { signal });
  return { data: payload.data, meta: listMeta(payload) };
}

export function getRefund(reference: string): Promise<RefundDetail> {
  return request<{ data: RefundDetail }>(
    `/refunds/${encodeURIComponent(reference)}`,
  ).then((payload) => payload.data);
}

export function advanceRefund(reference: string): Promise<import('../types/api').Refund> {
  return request<{ data: import('../types/api').Refund }>(
    `/refunds/${encodeURIComponent(reference)}/advance-demo`,
    { method: 'POST', body: JSON.stringify({}) },
  ).then((payload) => payload.data);
}

export async function listEvents(
  filters: EventFilters,
  signal?: AbortSignal,
): Promise<ListResponse<import('../types/api').PaymentEvent>> {
  const payload = await request<{
    data: import('../types/api').PaymentEvent[];
    meta: PaginatedMeta;
  }>(
    `/events${toQuery({
      ...filters,
      duplicateOnly: filters.duplicateOnly ? 'true' : undefined,
    })}`,
    { signal },
  );
  return { data: payload.data, meta: listMeta(payload) };
}

export function getEvent(reference: string): Promise<EventDetail> {
  return request<{ data: EventDetail }>(`/events/${encodeURIComponent(reference)}`).then(
    (payload) => payload.data,
  );
}

export function getDemoStatus(): Promise<DemoStatus> {
  return request<{ data: DemoStatus }>('/demo/status').then((payload) => payload.data);
}

export function runDemoScenario(input: {
  scenario: DemoScenario;
  amountMinor?: number;
  note?: string;
}): Promise<Record<string, unknown>> {
  return request<{ data: Record<string, unknown> }>('/demo/scenarios', {
    method: 'POST',
    body: JSON.stringify(input),
  }).then((payload) => payload.data);
}

export function resetDemo(confirm: string): Promise<Record<string, unknown>> {
  return request<{ data: Record<string, unknown> }>('/demo/reset', {
    method: 'POST',
    body: JSON.stringify({ confirm }),
  }).then((payload) => payload.data);
}

export function isApiClientError(error: unknown): error is ApiClientError {
  return error instanceof ApiClientError;
}

export function errorMessage(error: unknown): string {
  if (isApiClientError(error)) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}
