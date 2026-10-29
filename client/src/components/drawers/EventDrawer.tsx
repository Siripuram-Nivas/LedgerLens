import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Database,
  GitCompareArrows,
  ScrollText,
  ShieldAlert,
} from 'lucide-react';
import { useEvent } from '../../lib/queries';
import { errorMessage } from '../../lib/api';
import { formatDateTime, formatMoney } from '../../lib/format';
import { paymentStatusMeta } from '../../lib/status';
import type { EventDelivery } from '../../types/api';
import { Drawer } from '../ui/Drawer';
import { Badge, StatusBadge } from '../ui/Badge';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { DetailList } from '../ui/DetailList';
import { Callout } from '../ui/Callout';
import { Skeleton, SkeletonText } from '../ui/Skeleton';
import { ErrorState } from '../ui/States';
import { CopyButton } from '../ui/CopyButton';
import { Table, TBody, Td, Th, THead, Tr } from '../ui/Table';
import { ProcessingBadge, SignatureBadge } from '../domain/EventBadges';

const deliveryTone: Record<EventDelivery['outcome'], 'success' | 'warning' | 'danger' | 'neutral'> =
  {
    ACCEPTED: 'success',
    REPROCESSED: 'success',
    DUPLICATE: 'warning',
    REJECTED_SIGNATURE: 'danger',
    INVALID: 'danger',
  };

export function EventDrawer({
  reference,
  onClose,
}: {
  reference: string | null;
  onClose: () => void;
}) {
  const { data, isPending, isError, error, refetch } = useEvent(reference);
  const event = data?.event;

  return (
    <Drawer
      open={Boolean(reference)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      width="xl"
      title={
        <span className="flex items-center gap-2">
          <ScrollText className="h-4 w-4 shrink-0 text-muted" aria-hidden />
          <span className="truncate font-mono text-[12px]">{reference ?? 'Event'}</span>
          {reference ? <CopyButton value={reference} label="Copy event key" /> : null}
        </span>
      }
      description="Trusted event record, every delivery, and the financial effect that was (or was not) applied."
    >
      {isPending ? (
        <div className="space-y-4 p-5">
          <Skeleton className="h-28 w-full rounded-xl" />
          <SkeletonText lines={5} />
          <Skeleton className="h-44 w-full rounded-xl" />
        </div>
      ) : isError || !data || !event ? (
        <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />
      ) : (
        <div className="space-y-4 p-4 sm:p-5">
          <div className="rounded-xl border border-line bg-surface p-4 shadow-card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
                  {event.type}
                </p>
                <p className="mt-1 font-mono text-[12px] text-ink">{event.providerEventId}</p>
                <p className="mt-1 text-[11px] text-muted">
                  received {formatDateTime(event.receivedAt)} · provider{' '}
                  {formatDateTime(event.providerCreatedAt)}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <SignatureBadge status={event.signatureStatus} />
                <ProcessingBadge status={event.processingStatus} />
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-lg border border-line p-2.5">
                <p className="text-[9.5px] uppercase tracking-wide text-muted">Applied</p>
                <p className="mt-1 text-[11.5px] font-semibold text-ink">
                  {event.applied ? 'Exactly once' : 'No effect'}
                </p>
              </div>
              <div className="rounded-lg border border-line p-2.5">
                <p className="text-[9.5px] uppercase tracking-wide text-muted">Deliveries</p>
                <p className="mt-1 text-[11.5px] font-semibold text-ink tabular">
                  {data.deliveries.length}
                </p>
              </div>
              <div className="rounded-lg border border-line p-2.5">
                <p className="text-[9.5px] uppercase tracking-wide text-muted">Duplicates</p>
                <p className="mt-1 text-[11.5px] font-semibold text-ink tabular">
                  {event.duplicateDeliveryCount}
                </p>
              </div>
              <div className="rounded-lg border border-line p-2.5">
                <p className="text-[9.5px] uppercase tracking-wide text-muted">Recon triggered</p>
                <p className="mt-1 text-[11.5px] font-semibold text-ink">
                  {event.reconciliationTriggered ? 'Yes' : 'No'}
                </p>
              </div>
            </div>
          </div>

          {event.signatureStatus === 'INVALID' ||
          event.signatureStatus === 'NOT_AVAILABLE' ? (
            <Callout tone="danger" title="This event is not trusted">
              Its signature was not verified. LedgerLens retains the record for audit but must not
              apply its financial claims.
            </Callout>
          ) : event.processingStatus === 'FAILED' ? (
            <Callout tone="danger" title="Processing failed">
              {event.processingError ?? 'The event was retained but could not be processed.'}
            </Callout>
          ) : event.duplicateDeliveryCount > 0 ? (
            <Callout tone="warning" title="Duplicate deliveries were recorded">
              The same idempotency key arrived {event.duplicateDeliveryCount + 1} times. Financial
              effects were applied only once; every delivery remains in the audit trail.
            </Callout>
          ) : !event.applied && event.processingNote ? (
            <Callout tone="neutral" title="Retained without a financial effect">
              {event.processingNote}
            </Callout>
          ) : null}

          <Card>
            <CardHeader
              title="Processing stages"
              description="Derived from the stored event and its delivery records. Nothing is inferred."
            />
            <CardBody>
              <ol className="relative space-y-4 border-l border-line pl-5">
                {data.stages.map((stage) => (
                  <li key={stage.stage} className="relative">
                    <span className="absolute -left-[26px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-surface">
                      {stage.complete ? (
                        <CheckCircle2 className="h-4 w-4 text-success-600" aria-hidden />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-light" aria-hidden />
                      )}
                    </span>
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <p className="text-[12px] font-semibold capitalize text-ink">
                        {stage.stage}
                      </p>
                      <p className="text-[10px] text-muted">{formatDateTime(stage.at)}</p>
                    </div>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted">{stage.detail}</p>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Delivery records"
              description="Each webhook delivery is retained separately, including duplicates and rejected signatures."
            />
            <Table minWidth={640}>
              <THead>
                <Th>Delivery</Th>
                <Th>Outcome</Th>
                <Th>Signature</Th>
                <Th>Received</Th>
              </THead>
              <TBody>
                {data.deliveries.length === 0 ? (
                  <Tr>
                    <Td colSpan={4} className="py-6 text-center text-[11px] text-muted">
                      No delivery records are linked to this event.
                    </Td>
                  </Tr>
                ) : (
                  data.deliveries.map((delivery) => (
                    <Tr key={delivery.deliveryId}>
                      <Td>
                        <span className="font-mono text-[10.5px] text-ink">
                          {delivery.deliveryId}
                        </span>
                        {delivery.note ? (
                          <p className="mt-0.5 text-[10px] text-muted">{delivery.note}</p>
                        ) : null}
                      </Td>
                      <Td>
                        <Badge tone={deliveryTone[delivery.outcome]}>
                          {delivery.outcome.replaceAll('_', ' ').toLowerCase()}
                        </Badge>
                      </Td>
                      <Td>
                        <SignatureBadge status={delivery.signatureStatus} />
                      </Td>
                      <Td className="whitespace-nowrap text-[10.5px] text-muted">
                        {formatDateTime(delivery.receivedAt)}
                      </Td>
                    </Tr>
                  ))
                )}
              </TBody>
            </Table>
          </Card>

          <Card>
            <CardHeader title="Linked records" />
            <CardBody className="space-y-3">
              <DetailList
                dense
                items={[
                  { label: 'Event key', value: event.eventKey, mono: true },
                  { label: 'Provider', value: event.provider },
                  { label: 'Provider event ID', value: event.providerEventId, mono: true },
                  { label: 'Provider status', value: event.providerStatus ?? '—', mono: true },
                  {
                    label: 'Amount',
                    value:
                      event.amountMinor === null
                        ? '—'
                        : formatMoney(event.amountMinor, event.currency ?? 'INR'),
                  },
                  { label: 'Transaction', value: event.transactionRef ?? '—', mono: true },
                  { label: 'Order', value: event.orderRef ?? '—', mono: true },
                  { label: 'Source', value: `${event.source} / ${event.environment}` },
                ]}
              />
              <div className="flex flex-wrap gap-2">
                {data.transaction ? (
                  <Link
                    to={`/transactions?transaction=${encodeURIComponent(
                      data.transaction.transactionRef,
                    )}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-brand-100 bg-brand-50 px-2.5 py-1.5 text-[11px] font-semibold text-brand-700 transition hover:bg-brand-100"
                  >
                    <GitCompareArrows className="h-3.5 w-3.5" aria-hidden />
                    Open transaction {data.transaction.transactionRef}
                  </Link>
                ) : (
                  <span className="text-[11px] text-muted">
                    No payment record resolves for this event yet.
                  </span>
                )}
                {data.transaction ? (
                  <span className="inline-flex items-center gap-2 rounded-lg border border-line px-2.5 py-1.5">
                    <StatusBadge meta={paymentStatusMeta[data.transaction.status]} />
                    <span className="text-[10.5px] text-muted">
                      {formatMoney(data.transaction.amountMinor, data.transaction.currency)} ·{' '}
                      {data.transaction.transactionRef}
                    </span>
                  </span>
                ) : null}
              </div>
              {data.order ? (
                <p className="text-[11px] text-muted">
                  Order <span className="font-mono text-ink">{data.order.orderRef}</span> ·{' '}
                  {formatMoney(data.order.amountMinor, data.order.currency)} ·{' '}
                  {data.order.description}
                </p>
              ) : (
                <p className="text-[11px] text-muted">No order reference is attached to this event.</p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Payload summary"
              description="Sanitized summary stored with the event. Raw card data and secrets are never retained."
            />
            <CardBody>
              <pre className="scrollbar-thin max-h-72 overflow-auto rounded-lg border border-line bg-surface-sunken p-3 font-mono text-[10.5px] leading-relaxed text-ink-soft">
                {JSON.stringify(event.payloadSummary, null, 2)}
              </pre>
            </CardBody>
          </Card>

          <div className="flex items-start gap-2 px-1 pb-2 text-[10px] leading-relaxed text-muted">
            <Database className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
            <span>
              The event log is an audit record, not a reconciliation result. A processed event can
              still produce an exception when the amount, order or currency does not agree.
            </span>
          </div>
          <div className="flex items-start gap-2 px-1 pb-2 text-[10px] leading-relaxed text-muted">
            {event.signatureStatus === 'VERIFIED' ? (
              <ShieldAlert className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
            ) : (
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
            )}
            <span>
              Signature state is recorded per delivery. Demo events are marked SIMULATED and are
              never presented as provider-verified.
            </span>
          </div>
        </div>
      )}
    </Drawer>
  );
}
