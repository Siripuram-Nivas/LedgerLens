import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Lightbulb,
  Play,
  ScrollText,
  ShieldAlert,
} from 'lucide-react';
import { useRunReconciliation, useTransaction } from '../../lib/queries';
import { errorMessage } from '../../lib/api';
import type { StatusMeta } from '../../lib/status';
import { useToast } from '../providers/ToastProvider';
import {
  paymentStatusMeta,
  reconciliationStatusMeta,
  refundRecordStatusMeta,
  settlementRecordStatusMeta,
} from '../../lib/status';
import { formatDateTime, formatMoney, formatRelative } from '../../lib/format';
import { cn } from '../../lib/cn';
import { Drawer } from '../ui/Drawer';
import { Button } from '../ui/Button';
import { Badge, StatusBadge } from '../ui/Badge';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { DetailList } from '../ui/DetailList';
import { Callout } from '../ui/Callout';
import { Skeleton, SkeletonText } from '../ui/Skeleton';
import { ErrorState } from '../ui/States';
import { CopyButton } from '../ui/CopyButton';
import { ProcessingBadge, RefundStatusPill, SignatureBadge } from '../domain/EventBadges';

const severityMeta = {
  success: { icon: CheckCircle2, className: 'border-success-100 bg-success-50 text-success-700' },
  info: { icon: Info, className: 'border-info-100 bg-info-50 text-info-700' },
  warning: { icon: AlertTriangle, className: 'border-warning-100 bg-warning-50 text-warning-700' },
  critical: { icon: ShieldAlert, className: 'border-danger-100 bg-danger-50 text-danger-700' },
};

export function TransactionDrawer({
  reference,
  onClose,
}: {
  reference: string | null;
  onClose: () => void;
}) {
  const { data, isPending, isError, error, refetch } = useTransaction(reference);
  const runReconciliation = useRunReconciliation();
  const { toast } = useToast();

  function handleRun() {
    if (!reference) return;
    runReconciliation.mutate(
      { scope: 'payment', transactionRef: reference },
      {
        onSuccess: (run) => {
          toast({
            title: 'Payment reconciled',
            description: `Run ${run.runRef} completed with ${run.counts.exceptionsCreated} new and ${run.counts.exceptionsAutoResolved} auto-cleared exceptions.`,
            tone: 'success',
          });
        },
        onError: (mutationError) => {
          toast({
            title: 'Could not reconcile payment',
            description: errorMessage(mutationError),
            tone: 'danger',
          });
        },
      },
    );
  }

  return (
    <Drawer
      open={Boolean(reference)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      width="xl"
      title={
        <span className="flex items-center gap-2">
          <span className="font-mono text-[13px]">{reference ?? 'Transaction'}</span>
          {reference ? <CopyButton value={reference} /> : null}
        </span>
      }
      description="Payment detail, event history and independent reconciliation dimensions."
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] text-muted">
            Reconciliation never edits captured amounts or provider evidence.
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            <Button onClick={handleRun} loading={runReconciliation.isPending} disabled={!data}>
              <Play className="h-3.5 w-3.5" /> Reconcile payment
            </Button>
          </div>
        </div>
      }
    >
      {isPending ? (
        <div className="space-y-4 p-5">
          <Skeleton className="h-24 w-full rounded-xl" />
          <SkeletonText lines={4} />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      ) : isError || !data ? (
        <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />
      ) : (
        <div className="space-y-4 p-4 sm:p-5">
          <div className="rounded-xl border border-line bg-surface p-4 shadow-card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
                  Captured amount
                </p>
                <p className="mt-1 text-2xl font-semibold tracking-tight text-ink tabular">
                  {formatMoney(data.payment.amountMinor, data.payment.currency)}
                </p>
                <p className="mt-1 text-[11px] text-muted">
                  {data.payment.method} · attempt {data.payment.attempt} ·{' '}
                  {formatDateTime(data.payment.createdAt)}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <StatusBadge meta={paymentStatusMeta[data.payment.status]} />
                <Badge tone={data.payment.source === 'demo' ? 'warning' : 'brand'}>
                  {data.payment.source === 'demo' ? 'Simulated data' : 'Provider data'}
                </Badge>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ['Payment', paymentStatusMeta[data.payment.status]],
                [
                  'Settlement',
                  settlementRecordStatusMeta[
                    data.payment.settlementStatus as keyof typeof settlementRecordStatusMeta
                  ] ?? {
                    label: data.payment.settlementStatus,
                    tone: 'neutral' as const,
                    description: '',
                  },
                ],
                ['Reconciliation', reconciliationStatusMeta[data.payment.reconciliationStatus]],
                [
                  'Refund',
                  refundRecordStatusMeta[
                    data.payment.refundStatus as keyof typeof refundRecordStatusMeta
                  ] ?? {
                    label: data.payment.refundStatus,
                    tone: 'neutral' as const,
                    description: '',
                  },
                ],
              ] as Array<[string, StatusMeta]>
            ).map(([label, meta]) => (
              <div key={String(label)} className="rounded-lg border border-line bg-surface p-2.5">
                <p className="mb-1.5 text-[9.5px] font-semibold uppercase tracking-wide text-muted">
                  {label}
                </p>
                <StatusBadge meta={meta} />
              </div>
            ))}
          </div>
          <p className="flex items-center gap-1.5 px-1 text-[10px] leading-relaxed text-muted">
            <Info className="h-3 w-3 shrink-0" />
            These four dimensions are independent. A paid payment can be unsettled, and a
            settlement never changes capture state.
          </p>

          {data.insights.length > 0 ? (
            <Card>
              <CardHeader
                title="What this means"
                description="Derived from the records, without guessing missing data."
              />
              <CardBody className="space-y-2">
                {data.insights.map((insight, index) => {
                  const meta = severityMeta[insight.severity];
                  const Icon = meta.icon;
                  return (
                    <div
                      key={`${insight.kind}-${index}`}
                      className={cn('flex gap-2.5 rounded-lg border p-3', meta.className)}
                    >
                      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                      <div className="min-w-0">
                        <p className="text-[11.5px] font-semibold">{insight.title}</p>
                        <p className="mt-0.5 text-[11px] leading-relaxed opacity-90">
                          {insight.detail}
                        </p>
                        {insight.action ? (
                          <p className="mt-1 flex items-start gap-1 text-[10.5px] font-medium opacity-80">
                            <Lightbulb className="mt-0.5 h-3 w-3 shrink-0" />
                            {insight.action}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader
              title="Order comparison"
              description="Amounts are compared as integer minor units and never converted across currencies."
            />
            <CardBody className="space-y-3">
              {data.order && data.orderComparison ? (
                <>
                  <DetailList
                    items={[
                      { label: 'Order', value: data.order.orderRef, mono: true },
                      {
                        label: 'Order amount',
                        value: formatMoney(
                          data.orderComparison.expectedAmountMinor,
                          data.orderComparison.expectedCurrency,
                        ),
                      },
                      {
                        label: 'Payment amount',
                        value: formatMoney(
                          data.orderComparison.observedAmountMinor,
                          data.orderComparison.observedCurrency,
                        ),
                      },
                      {
                        label: 'Difference',
                        value:
                          data.orderComparison.differenceMinor === 0
                            ? 'No difference'
                            : formatMoney(
                                data.orderComparison.differenceMinor,
                                data.orderComparison.observedCurrency,
                              ),
                        className:
                          data.orderComparison.differenceMinor === 0
                            ? 'text-success-700'
                            : 'font-semibold text-danger-700',
                      },
                      {
                        label: 'Amount match',
                        value: data.orderComparison.amountMatched ? 'Yes' : 'No',
                      },
                      {
                        label: 'Currency match',
                        value: data.orderComparison.currencyMatched ? 'Yes' : 'No',
                      },
                    ]}
                  />
                  {data.orderComparison.summary ? (
                    <Callout tone="warning">{data.orderComparison.summary}</Callout>
                  ) : null}
                </>
              ) : (
                <Callout tone="warning" title="No order is linked to this payment">
                  The payment is financially relevant but cannot be compared. Reconciliation
                  records this as MISSING_ORDER instead of inventing an expected amount.
                </Callout>
              )}
            </CardBody>
          </Card>

          {data.exceptions.length > 0 ? (
            <Card>
              <CardHeader
                title="Reconciliation exceptions"
                description="Original discrepancies are preserved even after resolution."
                action={
                  <Link
                    to={`/reconciliation?exception=${encodeURIComponent(data.exceptions[0].exceptionRef)}`}
                    className="text-[11px] font-semibold text-brand-700 hover:text-brand-900"
                  >
                    Open workspace
                  </Link>
                }
              />
              <ul className="divide-y divide-line">
                {data.exceptions.map((exception) => (
                  <li key={exception.exceptionRef} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11.5px] font-semibold text-ink">
                        {exception.type.replaceAll('_', ' ')}
                      </span>
                      <Badge tone={exception.status === 'OPEN' ? 'danger' : exception.status === 'RESOLVED' ? 'success' : 'warning'}>
                        {exception.status.replaceAll('_', ' ').toLowerCase()}
                      </Badge>
                      <span className="text-[10px] text-muted-light">
                        seen {exception.timesSeen}×
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted">
                      {exception.explanation}
                    </p>
                    {exception.resolutionNote ? (
                      <p className="mt-1 rounded-md bg-surface-sunken px-2 py-1 text-[10.5px] text-ink-soft">
                        Resolution: {exception.resolutionNote}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card>
            <CardHeader
              title="Event history"
              description="Trusted events determine payment state. Duplicate deliveries are recorded idempotently."
              action={
                <Link
                  to={`/events?q=${encodeURIComponent(data.payment.transactionRef)}`}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:text-brand-900"
                >
                  <ScrollText className="h-3 w-3" /> Event log
                </Link>
              }
            />
            {data.events.length === 0 ? (
              <p className="px-4 py-5 text-xs text-muted">No provider events recorded.</p>
            ) : (
              <ul className="divide-y divide-line">
                {data.events.map((event) => (
                  <li key={event.eventKey} className="px-4 py-2.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-[11px] font-medium text-ink">{event.type}</span>
                      <ProcessingBadge status={event.processingStatus} />
                      <SignatureBadge status={event.signatureStatus} />
                      {event.applied ? <Badge tone="success">applied</Badge> : null}
                      {event.duplicateDeliveryCount > 0 ? (
                        <Badge tone="warning">dupes ×{event.duplicateDeliveryCount}</Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-muted">
                      <span>{formatDateTime(event.receivedAt)}</span>
                      <span className="text-line-strong">·</span>
                      <span className="font-mono">{event.eventKey}</span>
                      <span className="text-line-strong">·</span>
                      <span>{formatRelative(event.receivedAt)}</span>
                    </p>
                    {event.processingNote ? (
                      <p className="mt-0.5 text-[10.5px] text-muted">{event.processingNote}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader title="Settlements" description="Never inferred from payment success." />
              {data.settlements.length === 0 ? (
                <p className="px-4 py-4 text-[11px] text-muted">No settlement record references this payment.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {data.settlements.map((settlement) => (
                    <li key={settlement.settlementRef} className="flex items-center gap-2 px-4 py-2.5">
                      <div className="min-w-0 flex-1">
                        <Link
                          to={`/settlements?settlement=${encodeURIComponent(settlement.settlementRef)}`}
                          className="block truncate font-mono text-[10.5px] font-medium text-brand-700 hover:underline"
                        >
                          {settlement.settlementRef}
                        </Link>
                        <p className="mt-0.5 text-[10px] text-muted">
                          {formatMoney(settlement.grossMinor, settlement.currency)}
                        </p>
                      </div>
                      <StatusBadge meta={settlementRecordStatusMeta[settlement.status as keyof typeof settlementRecordStatusMeta] ?? { label: settlement.status, tone: 'neutral', description: '' }} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <CardHeader title="Refunds" description="Requests are not completed refunds." />
              {data.refunds.length === 0 ? (
                <p className="px-4 py-4 text-[11px] text-muted">No refund record references this payment.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {data.refunds.map((refund) => (
                    <li key={refund.refundRef} className="flex items-center gap-2 px-4 py-2.5">
                      <div className="min-w-0 flex-1">
                        <Link
                          to={`/refunds?refund=${encodeURIComponent(refund.refundRef)}`}
                          className="block truncate font-mono text-[10.5px] font-medium text-brand-700 hover:underline"
                        >
                          {refund.refundRef}
                        </Link>
                        <p className="mt-0.5 text-[10px] text-muted">
                          {formatMoney(refund.amountMinor, refund.currency)}
                        </p>
                      </div>
                      <StatusBadge meta={refundRecordStatusMeta[refund.status]} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          {data.relatedPayments.length > 1 ? (
            <Card>
              <CardHeader
                title="Attempts for this order"
                description="Only captured attempts count toward the order total."
              />
              <ul className="divide-y divide-line">
                {data.relatedPayments.map((attempt) => (
                  <li key={attempt.transactionRef} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="font-mono text-[10.5px] text-ink">{attempt.transactionRef}</span>
                    <Badge tone="neutral">#{attempt.attempt}</Badge>
                    <span className="flex-1" />
                    <span className="text-[11px] font-medium text-ink tabular">
                      {formatMoney(attempt.amountMinor, attempt.currency)}
                    </span>
                    <StatusBadge meta={paymentStatusMeta[attempt.status]} />
                    <span className="text-[10px] text-muted">{formatDateTime(attempt.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card>
            <CardHeader
              title="Provider references"
              description="Sensitive metadata fields are excluded before display."
            />
            <CardBody>
              <DetailList
                dense
                items={[
                  { label: 'Transaction', value: data.payment.transactionRef, mono: true },
                  { label: 'Provider payment', value: data.payment.providerPaymentId, mono: true },
                  { label: 'Order', value: data.payment.orderRef ?? '—', mono: true },
                  { label: 'Customer', value: data.payment.customerRef, mono: true },
                  { label: 'Last event key', value: data.payment.lastEventKey ?? '—', mono: true },
                  { label: 'Last event at', value: formatDateTime(data.payment.lastEventAt) },
                  { label: 'Source', value: `${data.payment.source} / ${data.payment.environment}` },
                ]}
              />
              {Object.keys(data.metadata).length > 0 ? (
                <div className="mt-3">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
                    Metadata summary
                  </p>
                  <pre className="scrollbar-thin overflow-x-auto rounded-lg border border-line bg-surface-sunken p-2.5 font-mono text-[10px] leading-relaxed text-ink-soft">
                    {JSON.stringify(data.metadata, null, 2)}
                  </pre>
                </div>
              ) : null}
              {data.metadataRedacted.length > 0 ? (
                <p className="mt-2 text-[10px] text-muted">
                  Redacted fields: {data.metadataRedacted.join(', ')}
                </p>
              ) : null}
            </CardBody>
          </Card>
        </div>
      )}
    </Drawer>
  );
}
