import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  FilterX,
  Play,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { useExceptions, useRunReconciliation, useRuns } from '../lib/queries';
import { errorMessage } from '../lib/api';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import { useToast } from '../components/providers/ToastProvider';
import {
  exceptionStatusMeta,
  exceptionTypeLabel,
  exceptionTypeTone,
} from '../lib/status';
import { formatDateTime, formatMoney, formatNumber, formatRelative } from '../lib/format';
import type { ExceptionFilters, ExceptionStatus, ExceptionType } from '../types/api';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge, SeverityBadge, StatusBadge } from '../components/ui/Badge';
import { SearchInput, Select } from '../components/ui/Field';
import { MetricCard } from '../components/ui/MetricCard';
import { Pagination } from '../components/ui/Pagination';
import { TableSkeleton } from '../components/ui/Skeleton';
import { EmptyState, ErrorState } from '../components/ui/States';
import { Table, TBody, Td, Th, THead, Tr } from '../components/ui/Table';
import { ExceptionDrawer } from '../components/drawers/ExceptionDrawer';

const PAGE_SIZE = 20;
const exceptionTypes: ExceptionType[] = [
  'MISSING_ORDER',
  'MISSING_PAYMENT',
  'AMOUNT_MISMATCH',
  'CURRENCY_MISMATCH',
  'DUPLICATE_EVENT',
  'DUPLICATE_PAYMENT',
];
const exceptionStatuses: ExceptionStatus[] = ['OPEN', 'UNDER_REVIEW', 'RESOLVED'];

export function ReconciliationPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [type, setType] = useState<ExceptionType | ''>('');
  const [status, setStatus] = useState<ExceptionStatus | ''>('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const selected = searchParams.get('exception');

  const filters = useMemo<ExceptionFilters>(
    () => ({
      page,
      limit: PAGE_SIZE,
      q: debouncedSearch || undefined,
      type: type || undefined,
      status: status || undefined,
      sortBy: 'lastDetectedAt',
      sortDir: 'desc',
    }),
    [page, debouncedSearch, type, status],
  );

  const { data, isPending, isFetching, isError, error, refetch } = useExceptions(filters);
  const runs = useRuns();
  const runReconciliation = useRunReconciliation();
  const { toast } = useToast();

  const activeFilters = Number(Boolean(debouncedSearch)) + Number(Boolean(type)) + Number(Boolean(status));
  const latestRun = runs.data?.[0];

  function setFilter<T extends string>(setter: (value: T) => void, value: string) {
    setter(value as T);
    setPage(1);
  }

  function resetFilters() {
    setSearch('');
    setType('');
    setStatus('');
    setPage(1);
  }

  function openException(reference: string) {
    const next = new URLSearchParams(searchParams);
    next.set('exception', reference);
    setSearchParams(next);
  }

  function closeException() {
    const next = new URLSearchParams(searchParams);
    next.delete('exception');
    setSearchParams(next, { replace: true });
  }

  function handleRun() {
    runReconciliation.mutate(
      { scope: 'all' },
      {
        onSuccess: (run) => {
          toast({
            title: `Reconciliation ${run.runRef} completed`,
            description: `${formatNumber(run.counts.paymentsEvaluated)} payments evaluated · ${run.counts.exceptionsCreated} new · ${run.counts.exceptionsUpdated} updated · ${run.counts.exceptionsAutoResolved} auto-cleared.`,
            tone: 'success',
          });
        },
        onError: (mutationError) =>
          toast({
            title: 'Reconciliation failed',
            description: errorMessage(mutationError),
            tone: 'danger',
          }),
      },
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reconciliation"
        description="Explainable matches and discrepancies between orders, captured payments and provider events. Re-runs update active exceptions in place."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => void refetch()}>
              <RefreshCw className={isFetching ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
              Refresh
            </Button>
            <Button onClick={handleRun} loading={runReconciliation.isPending}>
              <Play className="h-3.5 w-3.5" /> Run reconciliation
            </Button>
          </>
        }
      />

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Exception counts">
        <MetricCard
          label="Open"
          value={formatNumber(data?.counts.open ?? 0)}
          icon={AlertTriangle}
          tone="danger"
          hint="Needs investigation"
        />
        <MetricCard
          label="Under review"
          value={formatNumber(data?.counts.underReview ?? 0)}
          icon={ShieldCheck}
          tone="warning"
          hint="Assigned to an operator"
        />
        <MetricCard
          label="Resolved"
          value={formatNumber(data?.counts.resolved ?? 0)}
          icon={CheckCircle2}
          tone="success"
          hint="Decision recorded with evidence"
        />
      </section>

      <Card>
        <CardHeader
          title="Latest run"
          description="Runs are stored with counts and scope for later inspection."
          action={
            latestRun ? (
              <Badge tone={latestRun.status === 'COMPLETED' ? 'success' : 'warning'} dot>
                {latestRun.status.toLowerCase()}
              </Badge>
            ) : null
          }
        />
        <CardBody>
          {runs.isPending ? (
            <p className="text-xs text-muted">Loading run history…</p>
          ) : latestRun ? (
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="font-mono text-[12px] font-medium text-ink">{latestRun.runRef}</p>
                <p className="mt-0.5 text-[10.5px] text-muted">
                  {latestRun.scope} · triggered by {latestRun.triggeredBy} ·{' '}
                  {formatDateTime(latestRun.finishedAt)} ({formatRelative(latestRun.finishedAt)})
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {[
                  ['Payments', latestRun.counts.paymentsEvaluated],
                  ['Orders', latestRun.counts.ordersEvaluated],
                  ['Matched', latestRun.counts.matched],
                  ['New', latestRun.counts.exceptionsCreated],
                  ['Updated', latestRun.counts.exceptionsUpdated],
                  ['Auto-cleared', latestRun.counts.exceptionsAutoResolved],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-lg border border-line bg-surface-sunken px-2.5 py-1.5">
                    <p className="text-[9px] uppercase tracking-wide text-muted">{label}</p>
                    <p className="text-[12px] font-semibold text-ink tabular">{formatNumber(Number(value))}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-4 text-center">
              <ShieldCheck className="h-6 w-6 text-muted-light" />
              <p className="mt-1.5 text-xs font-semibold text-ink">No reconciliation runs yet</p>
              <p className="mt-0.5 text-[11px] text-muted">
                Run reconciliation to evaluate every order and captured payment.
              </p>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <div className="flex flex-col gap-2.5 border-b border-line p-3 sm:p-4 xl:flex-row xl:items-center">
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="Search exception, order, payment or transaction…"
            label="Search exceptions"
            className="min-w-0 flex-1 xl:max-w-md"
          />
          <div className="grid grid-cols-2 gap-2 sm:max-w-sm sm:flex-1 sm:grid-cols-2 xl:max-w-md">
            <Select
              aria-label="Exception type"
              value={type}
              onChange={(event) =>
                setFilter<ExceptionType | ''>(setType, event.target.value)
              }
            >
              <option value="">All types</option>
              {exceptionTypes.map((value) => (
                <option key={value} value={value}>
                  {exceptionTypeLabel[value]}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Exception status"
              value={status}
              onChange={(event) =>
                setFilter<ExceptionStatus | ''>(setStatus, event.target.value)
              }
            >
              <option value="">All statuses</option>
              {exceptionStatuses.map((value) => (
                <option key={value} value={value}>
                  {exceptionStatusMeta[value].label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex items-center justify-between gap-2 xl:justify-end">
            <span className="text-[10px] text-muted">{activeFilters} filters</span>
            <Button variant="ghost" size="sm" onClick={resetFilters} disabled={activeFilters === 0}>
              <FilterX className="h-3.5 w-3.5" /> Clear
            </Button>
          </div>
        </div>

        {!data && isPending ? (
          <TableSkeleton rows={8} columns={6} />
        ) : isError || !data ? (
          <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />
        ) : data.data.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="No exceptions match this view"
            description={
              activeFilters > 0
                ? 'Clear the filters to see the complete exception ledger.'
                : 'Every evaluated payment currently matches its order.'
            }
            action={
              activeFilters > 0 ? (
                <Button variant="secondary" size="sm" onClick={resetFilters}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <Table minWidth={1100}>
              <THead>
                <Th>Exception</Th>
                <Th>Type</Th>
                <Th align="right">Expected</Th>
                <Th align="right">Observed</Th>
                <Th align="right">Difference</Th>
                <Th>Severity</Th>
                <Th>Status</Th>
                <Th>Assigned</Th>
                <Th align="right">Last detected</Th>
              </THead>
              <TBody>
                {data.data.map((exception) => (
                  <Tr
                    key={exception.exceptionRef}
                    className="cursor-pointer"
                    onClick={() => openException(exception.exceptionRef)}
                  >
                    <Td>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          openException(exception.exceptionRef);
                        }}
                        className="text-left font-mono text-[11px] font-medium text-brand-700 hover:text-brand-900 hover:underline"
                      >
                        {exception.exceptionRef}
                      </button>
                      <p className="mt-0.5 truncate font-mono text-[10px] text-muted-light">
                        {exception.transactionRef ?? exception.orderRef ?? 'No linked payment'}
                      </p>
                    </Td>
                    <Td>
                      <Badge tone={exceptionTypeTone[exception.type]}>
                        {exceptionTypeLabel[exception.type]}
                      </Badge>
                    </Td>
                    <Td align="right" className="whitespace-nowrap text-[11px] tabular">
                      {exception.expectedAmountMinor === null
                        ? '—'
                        : formatMoney(
                            exception.expectedAmountMinor,
                            exception.expectedCurrency ?? 'INR',
                          )}
                    </Td>
                    <Td align="right" className="whitespace-nowrap text-[11px] tabular">
                      {exception.observedAmountMinor === null
                        ? '—'
                        : formatMoney(
                            exception.observedAmountMinor,
                            exception.observedCurrency ?? 'INR',
                          )}
                    </Td>
                    <Td align="right" className="whitespace-nowrap text-[11px] font-semibold text-danger-700 tabular">
                      {exception.differenceMinor === null
                        ? '—'
                        : formatMoney(
                            exception.differenceMinor,
                            exception.observedCurrency ?? exception.expectedCurrency ?? 'INR',
                          )}
                    </Td>
                    <Td>
                      <SeverityBadge severity={exception.severity} />
                    </Td>
                    <Td>
                      <StatusBadge meta={exceptionStatusMeta[exception.status]} />
                    </Td>
                    <Td className="max-w-[170px] truncate text-[11px] text-muted">
                      {exception.assignedTo ?? '—'}
                    </Td>
                    <Td align="right" className="whitespace-nowrap text-[10.5px] text-muted">
                      {formatRelative(exception.lastDetectedAt)}
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
            <Pagination
              page={data.meta.page}
              limit={data.meta.limit}
              total={data.meta.total}
              totalPages={data.meta.totalPages}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Run history"
          description="Every run records its scope and outcome. Re-runs do not duplicate active exceptions."
        />
        {runs.isPending ? (
          <div className="p-4">
            <TableSkeleton rows={3} columns={6} />
          </div>
        ) : runs.isError ? (
          <ErrorState message={errorMessage(runs.error)} onRetry={() => void runs.refetch()} />
        ) : !runs.data || runs.data.length === 0 ? (
          <p className="px-4 py-5 text-xs text-muted">No runs recorded.</p>
        ) : (
          <Table minWidth={880}>
            <THead>
              <Th>Run</Th>
              <Th>Scope</Th>
              <Th>Status</Th>
              <Th align="right">Payments</Th>
              <Th align="right">New</Th>
              <Th align="right">Updated</Th>
              <Th align="right">Auto-cleared</Th>
              <Th align="right">Finished</Th>
            </THead>
            <TBody>
              {runs.data.slice(0, 8).map((run) => (
                <Tr key={run.runRef}>
                  <Td className="font-mono text-[10.5px] text-ink">{run.runRef}</Td>
                  <Td className="text-[11px] text-muted">{run.scope}</Td>
                  <Td>
                    <Badge tone={run.status === 'COMPLETED' ? 'success' : run.status === 'FAILED' ? 'danger' : 'info'}>
                      {run.status.toLowerCase()}
                    </Badge>
                  </Td>
                  <Td align="right" className="tabular text-[11px]">{run.counts.paymentsEvaluated}</Td>
                  <Td align="right" className="tabular text-[11px]">{run.counts.exceptionsCreated}</Td>
                  <Td align="right" className="tabular text-[11px]">{run.counts.exceptionsUpdated}</Td>
                  <Td align="right" className="tabular text-[11px]">{run.counts.exceptionsAutoResolved}</Td>
                  <Td align="right" className="whitespace-nowrap text-[10.5px] text-muted">
                    {formatDateTime(run.finishedAt)}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <ExceptionDrawer key={selected ?? 'none'} reference={selected} onClose={closeException} />
    </div>
  );
}
