import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  FilterX,
  RefreshCw,
  ScrollText,
} from 'lucide-react';
import { useEvents } from '../lib/queries';
import { errorMessage } from '../lib/api';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import { formatDateTime, formatRelative } from '../lib/format';
import type { EventFilters } from '../types/api';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { SearchInput, Select } from '../components/ui/Field';
import { MetricCard } from '../components/ui/MetricCard';
import { Pagination } from '../components/ui/Pagination';
import { TableSkeleton } from '../components/ui/Skeleton';
import { EmptyState, ErrorState } from '../components/ui/States';
import { Table, TBody, Td, Th, THead, Tr } from '../components/ui/Table';
import { EventDrawer } from '../components/drawers/EventDrawer';
import { ProcessingBadge, SignatureBadge } from '../components/domain/EventBadges';

const PAGE_SIZE = 20;
const processingStatuses = ['RECEIVED', 'PROCESSED', 'FAILED'] as const;
const eventTypes = [
  'payment.captured',
  'payment.authorized',
  'payment.pending',
  'payment.failed',
  'payment.cancelled',
  'refund.created',
  'refund.processed',
  'refund.failed',
  'settlement.processed',
] as const;

export function EventLogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [processingStatus, setProcessingStatus] = useState<
    (typeof processingStatuses)[number] | ''
  >('');
  const [type, setType] = useState('');
  const [duplicateOnly, setDuplicateOnly] = useState(false);
  const debouncedSearch = useDebouncedValue(search, 300);
  const selected = searchParams.get('event');

  const filters = useMemo<EventFilters>(
    () => ({
      page,
      limit: PAGE_SIZE,
      q: debouncedSearch || undefined,
      processingStatus: processingStatus || undefined,
      type: type || undefined,
      duplicateOnly: duplicateOnly || undefined,
    }),
    [page, debouncedSearch, processingStatus, type, duplicateOnly],
  );

  const { data, isPending, isFetching, isError, error, refetch } = useEvents(filters);
  const activeFilters =
    Number(Boolean(debouncedSearch)) +
    Number(Boolean(processingStatus)) +
    Number(Boolean(type)) +
    Number(Boolean(duplicateOnly));

  const pageDuplicates =
    data?.data.reduce((sum, event) => sum + event.duplicateDeliveryCount, 0) ?? 0;
  const pageFailed =
    data?.data.filter((event) => event.processingStatus === 'FAILED').length ?? 0;
  const pageNotApplied = data?.data.filter((event) => !event.applied).length ?? 0;

  function openEvent(eventKey: string) {
    const next = new URLSearchParams(searchParams);
    next.set('event', eventKey);
    setSearchParams(next);
  }

  function closeEvent() {
    const next = new URLSearchParams(searchParams);
    next.delete('event');
    setSearchParams(next, { replace: true });
  }

  function resetFilters() {
    setSearch('');
    setProcessingStatus('');
    setType('');
    setDuplicateOnly(false);
    setPage(1);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Event log"
        description="Every provider event and delivery, retained for audit. Duplicate deliveries are recorded without repeating financial effects."
        actions={
          <Button variant="secondary" size="sm" onClick={() => void refetch()}>
            <RefreshCw className={isFetching ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
            Refresh
          </Button>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Event log summary">
        <MetricCard
          label="Matching events"
          value={data?.meta.total ?? '—'}
          hint="Applies the current filters."
          icon={ScrollText}
          tone="brand"
        />
        <MetricCard
          label="Duplicate deliveries"
          value={data ? pageDuplicates : '—'}
          hint="Counted on this page only."
          icon={Copy}
          tone="warning"
        />
        <MetricCard
          label="Processing failures"
          value={data ? pageFailed : '—'}
          hint="Counted on this page only."
          icon={AlertTriangle}
          tone="danger"
        />
        <MetricCard
          label="Retained, not applied"
          value={data ? pageNotApplied : '—'}
          hint="Counted on this page only."
          icon={CheckCircle2}
          tone="neutral"
        />
      </section>

      <Card>
        <div className="flex flex-col gap-2.5 border-b border-line p-3 sm:p-4 xl:flex-row xl:items-center">
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="Search event key, provider event, transaction or payment…"
            label="Search events"
            className="min-w-0 flex-1 xl:max-w-md"
          />
          <div className="grid grid-cols-2 gap-2 sm:max-w-sm sm:flex-1 xl:max-w-md">
            <Select
              aria-label="Processing status"
              value={processingStatus}
              onChange={(event) => {
                setProcessingStatus(event.target.value as (typeof processingStatuses)[number] | '');
                setPage(1);
              }}
            >
              <option value="">All processing</option>
              {processingStatuses.map((value) => (
                <option key={value} value={value}>
                  {value.toLowerCase()}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Event type"
              value={type}
              onChange={(event) => {
                setType(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All event types</option>
              {eventTypes.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex items-center justify-between gap-2 xl:justify-end">
            <Button
              variant={duplicateOnly ? 'subtle' : 'secondary'}
              size="sm"
              aria-pressed={duplicateOnly}
              onClick={() => {
                setDuplicateOnly((current) => !current);
                setPage(1);
              }}
            >
              <Copy className="h-3.5 w-3.5" /> Duplicates only
            </Button>
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
            icon={ScrollText}
            title="No events match this view"
            description="Events appear when a webhook is accepted or a demo scenario is run. Duplicate deliveries and rejected signatures are kept here too."
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
            <Table minWidth={1060}>
              <THead>
                <Th>Event</Th>
                <Th>Type</Th>
                <Th>Transaction</Th>
                <Th>Signature</Th>
                <Th>Processing</Th>
                <Th>Applied</Th>
                <Th align="center">Dupes</Th>
                <Th align="right">Received</Th>
              </THead>
              <TBody>
                {data.data.map((event) => (
                  <Tr
                    key={event.eventKey}
                    className="cursor-pointer"
                    onClick={() => openEvent(event.eventKey)}
                  >
                    <Td>
                      <button
                        type="button"
                        onClick={(clickEvent) => {
                          clickEvent.stopPropagation();
                          openEvent(event.eventKey);
                        }}
                        className="max-w-[230px] truncate text-left font-mono text-[10.5px] font-medium text-brand-700 hover:text-brand-900 hover:underline"
                        title={event.eventKey}
                      >
                        {event.eventKey}
                      </button>
                      <p className="mt-0.5 max-w-[230px] truncate font-mono text-[9.5px] text-muted-light">
                        {event.providerEventId}
                      </p>
                    </Td>
                    <Td>
                      <span className="font-mono text-[10.5px] text-ink">{event.type}</span>
                      <p className="mt-0.5 text-[10px] text-muted">
                        {event.provider} · {event.providerStatus ?? 'no provider status'}
                      </p>
                    </Td>
                    <Td>
                      <span className="font-mono text-[10.5px] text-ink">
                        {event.transactionRef ?? '—'}
                      </span>
                      <p className="mt-0.5 text-[10px] text-muted">
                        {event.orderRef ?? 'no order ref'}
                      </p>
                    </Td>
                    <Td>
                      <SignatureBadge status={event.signatureStatus} />
                    </Td>
                    <Td>
                      <ProcessingBadge status={event.processingStatus} />
                    </Td>
                    <Td>
                      <Badge tone={event.applied ? 'success' : 'neutral'}>
                        {event.applied ? 'applied once' : 'no effect'}
                      </Badge>
                    </Td>
                    <Td align="center">
                      {event.duplicateDeliveryCount > 0 ? (
                        <Badge tone="warning">{event.duplicateDeliveryCount}</Badge>
                      ) : (
                        <span className="text-[11px] text-muted-light">—</span>
                      )}
                    </Td>
                    <Td align="right" className="whitespace-nowrap">
                      <span className="text-[10.5px] text-muted">
                        {formatRelative(event.receivedAt)}
                      </span>
                      <p className="mt-0.5 text-[9.5px] text-muted-light">
                        {formatDateTime(event.receivedAt)}
                      </p>
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
          title="How to read the event log"
          description="An event is evidence of a provider message; reconciliation is a judgment about the resulting ledger position."
        />
        <CardBody className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-line bg-surface-sunken p-3">
            <SignatureBadge status="VERIFIED" />
            <p className="mt-1.5 text-[10.5px] leading-relaxed text-muted">
              Verified events carry a valid HMAC signature. Only these can change financial state.
            </p>
          </div>
          <div className="rounded-lg border border-line bg-surface-sunken p-3">
            <SignatureBadge status="SIMULATED" />
            <p className="mt-1.5 text-[10.5px] leading-relaxed text-muted">
              Simulated events come from the local demo provider. They are clearly labeled and
              never treated as provider-verified.
            </p>
          </div>
          <div className="rounded-lg border border-line bg-surface-sunken p-3">
            <Badge tone="warning">duplicate delivery</Badge>
            <p className="mt-1.5 text-[10.5px] leading-relaxed text-muted">
              Repeated deliveries of the same idempotency key are recorded and counted, but the
              financial effect is applied at most once.
            </p>
          </div>
        </CardBody>
      </Card>

      <EventDrawer key={selected ?? 'none'} reference={selected} onClose={closeEvent} />
    </div>
  );
}
