import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FilterX, Landmark, RefreshCw } from 'lucide-react';
import { useDashboard, useSettlements } from '../lib/queries';
import { errorMessage } from '../lib/api';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import { settlementRecordStatusMeta, settlementStatusMeta } from '../lib/status';
import { formatDateTime, formatMoney, formatNumber } from '../lib/format';
import type {
  SettlementFilters,
  SettlementRecordStatus,
} from '../types/api';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge, StatusBadge } from '../components/ui/Badge';
import { SearchInput, Select } from '../components/ui/Field';
import { MetricCard } from '../components/ui/MetricCard';
import { Pagination } from '../components/ui/Pagination';
import { TableSkeleton } from '../components/ui/Skeleton';
import { EmptyState, ErrorState } from '../components/ui/States';
import { Table, TBody, Td, Th, THead, Tr } from '../components/ui/Table';
import { SettlementDrawer } from '../components/drawers/SettlementDrawer';

const PAGE_SIZE = 20;
const statuses: SettlementRecordStatus[] = ['PENDING', 'SETTLED', 'FAILED', 'UNKNOWN'];

export function SettlementsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<SettlementRecordStatus | ''>('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const selected = searchParams.get('settlement');

  const dashboard = useDashboard('30d');

  const filters = useMemo<SettlementFilters>(
    () => ({
      page,
      limit: PAGE_SIZE,
      q: debouncedSearch || undefined,
      status: status || undefined,
    }),
    [page, debouncedSearch, status],
  );

  const { data, isPending, isFetching, isError, error, refetch } = useSettlements(filters);
  const activeFilters = Number(Boolean(debouncedSearch)) + Number(Boolean(status));
  const metrics = dashboard.data?.metrics;

  function openSettlement(reference: string) {
    const next = new URLSearchParams(searchParams);
    next.set('settlement', reference);
    setSearchParams(next);
  }

  function closeSettlement() {
    const next = new URLSearchParams(searchParams);
    next.delete('settlement');
    setSearchParams(next, { replace: true });
  }

  function resetFilters() {
    setSearch('');
    setStatus('');
    setPage(1);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Settlements"
        description="Recorded settlement batches and their payment references. A captured payment is not treated as settled until a trusted settlement record exists."
        actions={
          <Button variant="secondary" size="sm" onClick={() => void refetch()}>
            <RefreshCw className={isFetching ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
            Refresh
          </Button>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Settlement snapshot">
        <MetricCard
          label="Settled gross"
          value={
            metrics ? formatMoney(metrics.settledGrossMinor, metrics.settlementCurrency) : '—'
          }
          icon={Landmark}
          tone="success"
          hint={
            metrics
              ? `${formatNumber(metrics.settledSettlements)} settled batch${
                  metrics.settledSettlements === 1 ? '' : 'es'
                } · 30 days`
              : undefined
          }
        />
        <MetricCard
          label="Settled fees"
          value={metrics ? formatMoney(metrics.settledFeesMinor, metrics.settlementCurrency) : '—'}
          icon={Landmark}
          tone="neutral"
          hint="Recorded fees only"
        />
        <MetricCard
          label="Settled net"
          value={metrics ? formatMoney(metrics.settledNetMinor, metrics.settlementCurrency) : '—'}
          icon={Landmark}
          tone="brand"
          hint="Gross minus recorded fees"
        />
        <MetricCard
          label="Awaiting settlement"
          value={
            metrics
              ? formatMoney(metrics.settlementPendingGrossMinor, metrics.settlementPendingCurrency)
              : '—'
          }
          icon={Landmark}
          tone="warning"
          hint={
            metrics
              ? `${formatNumber(metrics.settlementPending)} pending batch${
                  metrics.settlementPending === 1 ? '' : 'es'
                } · 30 days`
              : undefined
          }
        />
      </section>

      <Card>
        <div className="flex flex-col gap-2.5 border-b border-line p-3 sm:p-4 sm:flex-row sm:items-center">
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="Search settlement or provider reference…"
            label="Search settlements"
            className="min-w-0 flex-1 sm:max-w-md"
          />
          <Select
            aria-label="Settlement status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as SettlementRecordStatus | '');
              setPage(1);
            }}
            wrapperClassName="sm:w-44"
          >
            <option value="">All statuses</option>
            {statuses.map((value) => (
              <option key={value} value={value}>
                {settlementRecordStatusMeta[value].label}
              </option>
            ))}
          </Select>
          <div className="flex items-center justify-between gap-2 sm:justify-end">
            <span className="text-[10px] text-muted">{activeFilters} filters</span>
            <Button variant="ghost" size="sm" onClick={resetFilters} disabled={activeFilters === 0}>
              <FilterX className="h-3.5 w-3.5" /> Clear
            </Button>
          </div>
        </div>

        {!data && isPending ? (
          <TableSkeleton rows={7} columns={7} />
        ) : isError || !data ? (
          <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />
        ) : data.data.length === 0 ? (
          <EmptyState
            icon={Landmark}
            title="No settlements match this view"
            description="Settlement batches appear only when a provider or explicit demo fixture records them."
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
            <Table minWidth={1000}>
              <THead>
                <Th>Settlement</Th>
                <Th>Status</Th>
                <Th align="right">Gross</Th>
                <Th align="right">Fees</Th>
                <Th align="right">Net</Th>
                <Th align="right">Payments</Th>
                <Th align="right">Expected</Th>
                <Th align="right">Settled</Th>
              </THead>
              <TBody>
                {data.data.map((settlement) => (
                  <Tr
                    key={settlement.settlementRef}
                    className="cursor-pointer"
                    onClick={() => openSettlement(settlement.settlementRef)}
                  >
                    <Td>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          openSettlement(settlement.settlementRef);
                        }}
                        className="text-left font-mono text-[11px] font-medium text-brand-700 hover:text-brand-900 hover:underline"
                      >
                        {settlement.settlementRef}
                      </button>
                      <p className="mt-0.5 truncate font-mono text-[9.5px] text-muted-light">
                        {settlement.providerSettlementRef ?? 'No provider reference'}
                      </p>
                    </Td>
                    <Td>
                      <StatusBadge meta={settlementRecordStatusMeta[settlement.status]} />
                    </Td>
                    <Td align="right" className="whitespace-nowrap font-semibold text-ink tabular">
                      {formatMoney(settlement.grossMinor, settlement.currency)}
                    </Td>
                    <Td align="right" className="whitespace-nowrap text-[11px] tabular">
                      {settlement.feesMinor === null
                        ? '—'
                        : formatMoney(settlement.feesMinor, settlement.currency)}
                    </Td>
                    <Td align="right" className="whitespace-nowrap text-[11px] tabular">
                      {settlement.netMinor === null
                        ? '—'
                        : formatMoney(settlement.netMinor, settlement.currency)}
                    </Td>
                    <Td align="right" className="tabular text-[11px]">{settlement.paymentRefs.length}</Td>
                    <Td align="right" className="whitespace-nowrap text-[10.5px] text-muted">
                      {formatDateTime(settlement.expectedAt)}
                    </Td>
                    <Td align="right" className="whitespace-nowrap text-[10.5px] text-muted">
                      {formatDateTime(settlement.settledAt)}
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
          title="Settlement status model"
          description="Settlement states answer one question: has the merchant been recorded as paid out?"
        />
        <CardBody>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {(['NOT_APPLICABLE', 'NOT_STARTED', 'PENDING', 'SETTLED', 'FAILED', 'UNKNOWN'] as const).map(
              (value) => (
                <div key={value} className="rounded-lg border border-line bg-surface-sunken p-3">
                  <div className="flex items-center gap-2">
                    <StatusBadge meta={settlementStatusMeta[value]} />
                    <Badge tone="neutral">{value === 'NOT_APPLICABLE' || value === 'NOT_STARTED' ? 'payment view' : 'batch view'}</Badge>
                  </div>
                  <p className="mt-1.5 text-[10.5px] leading-relaxed text-muted">
                    {settlementStatusMeta[value].description}
                  </p>
                </div>
              ),
            )}
          </div>
        </CardBody>
      </Card>

      <SettlementDrawer key={selected ?? 'none'} reference={selected} onClose={closeSettlement} />
    </div>
  );
}
