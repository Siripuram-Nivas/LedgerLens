import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FilterX, RefreshCw, Undo2 } from 'lucide-react';
import { useRefunds } from '../lib/queries';
import { errorMessage } from '../lib/api';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import { refundRecordStatusMeta } from '../lib/status';
import { formatDateTime, formatMoney, formatNumber } from '../lib/format';
import type {
  RefundFilters,
  RefundRecordStatus,
} from '../types/api';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StatusBadge } from '../components/ui/Badge';
import { SearchInput, Select } from '../components/ui/Field';
import { Pagination } from '../components/ui/Pagination';
import { TableSkeleton } from '../components/ui/Skeleton';
import { EmptyState, ErrorState } from '../components/ui/States';
import { Table, TBody, Td, Th, THead, Tr } from '../components/ui/Table';
import { RefundDrawer } from '../components/drawers/RefundDrawer';

const PAGE_SIZE = 20;
const statuses: RefundRecordStatus[] = [
  'REQUESTED',
  'PROCESSING',
  'PARTIALLY_REFUNDED',
  'REFUNDED',
  'FAILED',
];

export function RefundsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<RefundRecordStatus | ''>('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const selected = searchParams.get('refund');

  const filters = useMemo<RefundFilters>(
    () => ({
      page,
      limit: PAGE_SIZE,
      q: debouncedSearch || undefined,
      status: status || undefined,
    }),
    [page, debouncedSearch, status],
  );

  const { data, isPending, isFetching, isError, error, refetch } = useRefunds(filters);
  const activeFilters = Number(Boolean(debouncedSearch)) + Number(Boolean(status));

  function openRefund(reference: string) {
    const next = new URLSearchParams(searchParams);
    next.set('refund', reference);
    setSearchParams(next);
  }

  function closeRefund() {
    const next = new URLSearchParams(searchParams);
    next.delete('refund');
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
        title="Refunds"
        description="Refund requests, processing state and completion. A request is not a completed refund, and does not automatically reduce captured revenue."
        actions={
          <Button variant="secondary" size="sm" onClick={() => void refetch()}>
            <RefreshCw className={isFetching ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
            Refresh
          </Button>
        }
      />

      <Card>
        <div className="flex flex-col gap-2.5 border-b border-line p-3 sm:flex-row sm:items-center sm:p-4">
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="Search refund, payment or transaction…"
            label="Search refunds"
            className="min-w-0 flex-1 sm:max-w-md"
          />
          <Select
            aria-label="Refund status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as RefundRecordStatus | '');
              setPage(1);
            }}
            wrapperClassName="sm:w-48"
          >
            <option value="">All statuses</option>
            {statuses.map((value) => (
              <option key={value} value={value}>
                {refundRecordStatusMeta[value].label}
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
          <TableSkeleton rows={6} columns={6} />
        ) : isError || !data ? (
          <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />
        ) : data.data.length === 0 ? (
          <EmptyState
            icon={Undo2}
            title="No refunds match this view"
            description="Refund records appear when a request is recorded. The demo lab can create one."
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
            <Table minWidth={980}>
              <THead>
                <Th>Refund</Th>
                <Th>Payment</Th>
                <Th align="right">Amount</Th>
                <Th>Status</Th>
                <Th>Timeline</Th>
                <Th align="right">Created</Th>
                <Th align="right">Updated</Th>
              </THead>
              <TBody>
                {data.data.map((refund) => (
                  <Tr
                    key={refund.refundRef}
                    className="cursor-pointer"
                    onClick={() => openRefund(refund.refundRef)}
                  >
                    <Td>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          openRefund(refund.refundRef);
                        }}
                        className="text-left font-mono text-[11px] font-medium text-brand-700 hover:text-brand-900 hover:underline"
                      >
                        {refund.refundRef}
                      </button>
                      <p className="mt-0.5 truncate text-[10px] text-muted-light">
                        {refund.reason}
                      </p>
                    </Td>
                    <Td>
                      <span className="font-mono text-[10.5px] text-ink">
                        {refund.transactionRef}
                      </span>
                      <p className="mt-0.5 truncate font-mono text-[9.5px] text-muted-light">
                        {refund.paymentRef}
                      </p>
                    </Td>
                    <Td align="right" className="whitespace-nowrap font-semibold text-ink tabular">
                      {formatMoney(refund.amountMinor, refund.currency)}
                    </Td>
                    <Td>
                      <StatusBadge meta={refundRecordStatusMeta[refund.status]} />
                    </Td>
                    <Td>
                      <span className="text-[10.5px] text-muted">
                        {formatNumber(refund.timeline.length)} transition
                        {refund.timeline.length === 1 ? '' : 's'}
                      </span>
                    </Td>
                    <Td align="right" className="whitespace-nowrap text-[10.5px] text-muted">
                      {formatDateTime(refund.createdAt)}
                    </Td>
                    <Td align="right" className="whitespace-nowrap text-[10.5px] text-muted">
                      {formatDateTime(refund.updatedAt)}
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
          title="Refund status model"
          description="Refund records track their own lifecycle. NONE is a payment-view label, not a refund record status."
        />
        <CardBody>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {statuses.map((value) => (
              <div key={value} className="rounded-lg border border-line bg-surface-sunken p-3">
                <StatusBadge meta={refundRecordStatusMeta[value]} />
                <p className="mt-1.5 text-[10.5px] leading-relaxed text-muted">
                  {refundRecordStatusMeta[value].description}
                </p>
              </div>
            ))}
            <div className="rounded-lg border border-dashed border-line-strong bg-surface p-3">
              <p className="text-[11px] font-semibold text-ink">Real-mode transitions</p>
              <p className="mt-1.5 text-[10.5px] leading-relaxed text-muted">
                Demo-only advancement is disabled outside environment=demo. Real refunds require
                trusted provider events.
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      <RefundDrawer key={selected ?? 'none'} reference={selected} onClose={closeRefund} />
    </div>
  );
}
