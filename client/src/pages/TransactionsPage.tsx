import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeftRight, FilterX, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { useTransactions } from '../lib/queries';
import { errorMessage } from '../lib/api';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import {
  paymentStatusMeta,
  reconciliationStatusMeta,
  settlementStatusMeta,
} from '../lib/status';
import { formatDateTime, formatMoney } from '../lib/format';
import type {
  PaymentStatus,
  ReconciliationStatus,
  RefundStatus,
  SettlementStatus,
  TransactionFilters,
} from '../types/api';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge, StatusBadge } from '../components/ui/Badge';
import { SearchInput, Select } from '../components/ui/Field';
import { Pagination } from '../components/ui/Pagination';
import { TableSkeleton } from '../components/ui/Skeleton';
import { EmptyState, ErrorState } from '../components/ui/States';
import { Table, TBody, Td, Th, THead, Tr } from '../components/ui/Table';
import { TransactionDrawer } from '../components/drawers/TransactionDrawer';
import { RefundStatusPill } from '../components/domain/EventBadges';

const PAGE_SIZE = 20;
const paymentStatuses: PaymentStatus[] = ['PENDING', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED'];
const settlementStatuses: SettlementStatus[] = [
  'NOT_APPLICABLE',
  'NOT_STARTED',
  'PENDING',
  'SETTLED',
  'FAILED',
  'UNKNOWN',
];
const reconciliationStatuses: ReconciliationStatus[] = [
  'MATCHED',
  'PENDING_RECONCILIATION',
  'MISSING_ORDER',
  'MISSING_PAYMENT',
  'AMOUNT_MISMATCH',
  'CURRENCY_MISMATCH',
  'DUPLICATE_EVENT',
  'DUPLICATE_PAYMENT',
  'UNDER_REVIEW',
  'NOT_APPLICABLE',
];
const refundStatuses: RefundStatus[] = [
  'NONE',
  'REQUESTED',
  'PROCESSING',
  'PARTIALLY_REFUNDED',
  'REFUNDED',
  'FAILED',
];

export function TransactionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<PaymentStatus | ''>('');
  const [settlementStatus, setSettlementStatus] = useState<SettlementStatus | ''>('');
  const [reconciliationStatus, setReconciliationStatus] = useState<ReconciliationStatus | ''>('');
  const [refundStatus, setRefundStatus] = useState<RefundStatus | ''>('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const selected = searchParams.get('transaction');

  const filters = useMemo<TransactionFilters>(
    () => ({
      page,
      limit: PAGE_SIZE,
      q: debouncedSearch || undefined,
      status: status || undefined,
      settlementStatus: settlementStatus || undefined,
      reconciliationStatus: reconciliationStatus || undefined,
      refundStatus: refundStatus || undefined,
      sortBy: 'createdAt',
      sortDir: 'desc',
    }),
    [page, debouncedSearch, status, settlementStatus, reconciliationStatus, refundStatus],
  );

  const { data, isPending, isFetching, isError, error, refetch } = useTransactions(filters);
  const activeFilters =
    Number(Boolean(debouncedSearch)) +
    Number(Boolean(status)) +
    Number(Boolean(settlementStatus)) +
    Number(Boolean(reconciliationStatus)) +
    Number(Boolean(refundStatus));

  function updateFilter<T extends string>(setter: (value: T) => void) {
    return (value: string) => {
      setter(value as T);
      setPage(1);
    };
  }

  function resetFilters() {
    setSearch('');
    setStatus('');
    setSettlementStatus('');
    setReconciliationStatus('');
    setRefundStatus('');
    setPage(1);
  }

  function openTransaction(reference: string) {
    const next = new URLSearchParams(searchParams);
    next.set('transaction', reference);
    setSearchParams(next);
  }

  function closeTransaction() {
    const next = new URLSearchParams(searchParams);
    next.delete('transaction');
    setSearchParams(next, { replace: true });
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Transactions"
        description="Every payment attempt, with payment, settlement, reconciliation and refund states kept separate."
        actions={
          <>
            {data ? (
              <Badge tone="neutral" className="h-7 px-2.5">
                {data.meta.total} transactions
              </Badge>
            ) : null}
            <Button variant="secondary" size="sm" onClick={() => void refetch()}>
              <RefreshCw className={isFetching ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
              Refresh
            </Button>
          </>
        }
      />

      <Card>
        <div className="border-b border-line p-3 sm:p-4">
          <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center">
            <SearchInput
              value={search}
              onChange={updateFilter(setSearch)}
              placeholder="Search transaction, order, customer or provider payment…"
              label="Search transactions"
              className="min-w-0 flex-1 xl:max-w-md"
            />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:flex xl:flex-1">
              <Select
                aria-label="Payment status"
                value={status}
                onChange={(event) =>
                  updateFilter<PaymentStatus | ''>(setStatus)(event.target.value)
                }
                wrapperClassName="min-w-0"
              >
                <option value="">All payments</option>
                {paymentStatuses.map((value) => (
                  <option key={value} value={value}>
                    {paymentStatusMeta[value].label}
                  </option>
                ))}
              </Select>
              <Select
                aria-label="Settlement status"
                value={settlementStatus}
                onChange={(event) =>
                  updateFilter<SettlementStatus | ''>(setSettlementStatus)(event.target.value)
                }
                wrapperClassName="min-w-0"
              >
                <option value="">All settlements</option>
                {settlementStatuses.map((value) => (
                  <option key={value} value={value}>
                    {settlementStatusMeta[value].label}
                  </option>
                ))}
              </Select>
              <Select
                aria-label="Reconciliation status"
                value={reconciliationStatus}
                onChange={(event) =>
                  updateFilter<ReconciliationStatus | ''>(setReconciliationStatus)(
                    event.target.value,
                  )
                }
                wrapperClassName="min-w-0"
              >
                <option value="">All reconciliation</option>
                {reconciliationStatuses.map((value) => (
                  <option key={value} value={value}>
                    {reconciliationStatusMeta[value].label}
                  </option>
                ))}
              </Select>
              <Select
                aria-label="Refund status"
                value={refundStatus}
                onChange={(event) =>
                  updateFilter<RefundStatus | ''>(setRefundStatus)(event.target.value)
                }
                wrapperClassName="min-w-0"
              >
                <option value="">All refunds</option>
                {refundStatuses.map((value) => (
                  <option key={value} value={value}>
                    {value === 'NONE' ? 'No refund' : value.replaceAll('_', ' ').toLowerCase()}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[10px] text-muted">
                <SlidersHorizontal className="h-3 w-3" />
                {activeFilters} active
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                disabled={activeFilters === 0}
              >
                <FilterX className="h-3.5 w-3.5" /> Clear
              </Button>
            </div>
          </div>
        </div>

        {!data && isPending ? (
          <TableSkeleton rows={8} columns={6} />
        ) : isError || !data ? (
          <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />
        ) : data.data.length === 0 ? (
          <EmptyState
            icon={ArrowLeftRight}
            title="No transactions match these filters"
            description="Try clearing the search or widening the status filters."
            action={
              <Button variant="secondary" size="sm" onClick={resetFilters}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <>
            <Table minWidth={1020}>
              <THead>
                <Th>Transaction</Th>
                <Th align="right">Amount</Th>
                <Th>Payment</Th>
                <Th>Settlement</Th>
                <Th>Reconciliation</Th>
                <Th>Refund</Th>
                <Th>Method</Th>
                <Th align="right">Created</Th>
              </THead>
              <TBody>
                {data.data.map((payment) => (
                  <Tr
                    key={payment.transactionRef}
                    onClick={() => openTransaction(payment.transactionRef)}
                    className="cursor-pointer"
                  >
                    <Td>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          openTransaction(payment.transactionRef);
                        }}
                        className="text-left font-mono text-[11.5px] font-medium text-brand-700 hover:text-brand-900 hover:underline"
                      >
                        {payment.transactionRef}
                      </button>
                      <p className="mt-0.5 font-mono text-[10px] text-muted-light">
                        {payment.customerRef}
                      </p>
                    </Td>
                    <Td align="right" className="whitespace-nowrap font-semibold text-ink tabular">
                      {formatMoney(payment.amountMinor, payment.currency)}
                    </Td>
                    <Td>
                      <StatusBadge meta={paymentStatusMeta[payment.status]} />
                    </Td>
                    <Td>
                      <StatusBadge meta={settlementStatusMeta[payment.settlementStatus]} />
                    </Td>
                    <Td>
                      <StatusBadge meta={reconciliationStatusMeta[payment.reconciliationStatus]} />
                    </Td>
                    <Td>
                      <RefundStatusPill status={payment.refundStatus} />
                    </Td>
                    <Td className="capitalize text-[11.5px] text-muted">{payment.method}</Td>
                    <Td align="right" className="whitespace-nowrap text-[11px] text-muted">
                      {formatDateTime(payment.createdAt)}
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

      <TransactionDrawer reference={selected} onClose={closeTransaction} />
    </div>
  );
}
