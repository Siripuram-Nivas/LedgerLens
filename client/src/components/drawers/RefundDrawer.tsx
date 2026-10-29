import { Link } from 'react-router-dom';
import { ArrowRight, RotateCw, Undo2 } from 'lucide-react';
import { useAdvanceRefund, useRefund } from '../../lib/queries';
import { errorMessage } from '../../lib/api';
import { useToast } from '../providers/ToastProvider';
import { paymentStatusMeta, refundRecordStatusMeta } from '../../lib/status';
import { formatDateTime, formatMoney } from '../../lib/format';
import { Drawer } from '../ui/Drawer';
import { Button } from '../ui/Button';
import { Badge, StatusBadge } from '../ui/Badge';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { DetailList } from '../ui/DetailList';
import { Callout } from '../ui/Callout';
import { Skeleton, SkeletonText } from '../ui/Skeleton';
import { ErrorState } from '../ui/States';
import { CopyButton } from '../ui/CopyButton';

export function RefundDrawer({
  reference,
  onClose,
}: {
  reference: string | null;
  onClose: () => void;
}) {
  const { data, isPending, isError, error, refetch } = useRefund(reference);
  const advance = useAdvanceRefund();
  const { toast } = useToast();

  const nextStatus =
    data?.refund.status === 'REQUESTED'
      ? 'PROCESSING'
      : data?.refund.status === 'PROCESSING'
        ? 'REFUNDED'
        : null;

  function handleAdvance() {
    if (!data) return;
    advance.mutate(data.refund.refundRef, {
      onSuccess: (refund) => {
        toast({
          title: `Refund advanced to ${refund.status.replaceAll('_', ' ').toLowerCase()}`,
          description: 'This transition is simulated and recorded in the demo audit trail.',
          tone: refund.status === 'REFUNDED' ? 'success' : 'info',
        });
      },
      onError: (mutationError) =>
        toast({
          title: 'Could not advance refund',
          description: errorMessage(mutationError),
          tone: 'danger',
        }),
    });
  }

  return (
    <Drawer
      open={Boolean(reference)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      width="lg"
      title={
        <span className="flex items-center gap-2">
          <span className="font-mono text-[13px]">{reference ?? 'Refund'}</span>
          {reference ? <CopyButton value={reference} /> : null}
        </span>
      }
      description="Refund request, provider timeline and audit trail."
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] text-muted">
            {data?.simulationOnly
              ? 'Simulated refund · demo transitions only'
              : 'Provider-controlled refund'}
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            {data?.canAdvance && data.simulationOnly && nextStatus ? (
              <Button onClick={handleAdvance} loading={advance.isPending}>
                <RotateCw className="h-3.5 w-3.5" /> Advance to {nextStatus.toLowerCase()}
              </Button>
            ) : null}
          </div>
        </div>
      }
    >
      {isPending ? (
        <div className="space-y-4 p-5">
          <Skeleton className="h-28 w-full rounded-xl" />
          <SkeletonText lines={4} />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      ) : isError || !data ? (
        <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />
      ) : (
        <div className="space-y-4 p-4 sm:p-5">
          <div className="rounded-xl border border-line bg-surface p-4 shadow-card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
                  Refund amount
                </p>
                <p className="mt-1 text-2xl font-semibold tracking-tight text-ink tabular">
                  {formatMoney(data.refund.amountMinor, data.refund.currency)}
                </p>
                <p className="mt-1 text-[11px] text-muted">
                  Requested {formatDateTime(data.refund.createdAt)}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <StatusBadge meta={refundRecordStatusMeta[data.refund.status]} />
                {data.simulationOnly ? <Badge tone="warning">Simulated refund</Badge> : null}
              </div>
            </div>
          </div>

          {data.simulationOnly ? (
            <Callout tone="warning" title="Demo refund lifecycle">
              Refund requests do not auto-complete. Use the explicit demo transition to move
              REQUESTED → PROCESSING → REFUNDED. No real money moves.
            </Callout>
          ) : (
            <Callout tone="info" title="Provider-controlled refund">
              Refund transitions are driven by trusted provider events. LedgerLens does not expose a
              manual mutation for real refunds.
            </Callout>
          )}

          {data.refund.status === 'FAILED' ? (
            <Callout tone="danger" title="Refund failed">
              {data.refund.failureReason ?? 'No failure reason was recorded.'} The original payment
              remains captured until a refund completes.
            </Callout>
          ) : null}

          <Card>
            <CardHeader
              title="Refund timeline"
              description="Each recorded transition is append-only."
            />
            <CardBody>
              <ol className="relative ml-1.5 space-y-4 border-l border-line pl-5">
                {data.refund.timeline.map((entry, index) => (
                  <li key={`${entry.status}-${entry.at}-${index}`} className="relative">
                    <span className="absolute -left-[26px] top-1 h-2.5 w-2.5 rounded-full border-2 border-surface bg-brand-500 ring-1 ring-brand-100" />
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge meta={refundRecordStatusMeta[entry.status]} />
                      <span className="text-[10px] text-muted">{formatDateTime(entry.at)}</span>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted">{entry.note}</p>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Linked records" description="The refund does not rewrite the payment." />
            <CardBody className="space-y-3">
              {data.payment ? (
                <div className="rounded-lg border border-line p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link
                      to={`/transactions?transaction=${encodeURIComponent(data.payment.transactionRef)}`}
                      className="inline-flex items-center gap-1 font-mono text-[11px] font-medium text-brand-700 hover:underline"
                    >
                      {data.payment.transactionRef} <ArrowRight className="h-3 w-3" />
                    </Link>
                    <StatusBadge meta={paymentStatusMeta[data.payment.status]} />
                  </div>
                  <p className="mt-1 text-[11px] text-muted">
                    Captured {formatMoney(data.payment.amountMinor, data.payment.currency)} · refund
                    state {data.payment.refundStatus.replaceAll('_', ' ').toLowerCase()}
                  </p>
                </div>
              ) : (
                <Callout tone="warning">The referenced payment record is not available.</Callout>
              )}
              <DetailList
                dense
                items={[
                  { label: 'Provider refund', value: data.refund.providerRefundRef ?? '—', mono: true },
                  { label: 'Payment ref', value: data.refund.paymentRef, mono: true },
                  { label: 'Order', value: data.refund.orderRef ?? '—', mono: true },
                  { label: 'Reason', value: data.refund.reason },
                  { label: 'Source', value: `${data.refund.source} / ${data.refund.environment}` },
                ]}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Audit trail" description="Operator and system actions for this refund." />
            {data.audits.length === 0 ? (
              <p className="px-4 py-4 text-[11px] text-muted">No audit records yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {data.audits.map((audit) => (
                  <li key={audit.id} className="flex gap-3 px-4 py-2.5">
                    <div className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-semibold text-ink">{audit.action}</span>
                        <span className="text-[10px] text-muted-light">{audit.actor}</span>
                      </div>
                      {audit.note ? (
                        <p className="mt-0.5 text-[11px] leading-relaxed text-muted">{audit.note}</p>
                      ) : null}
                      <p className="mt-0.5 text-[10px] text-muted-light">
                        {formatDateTime(audit.createdAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <p className="flex items-center gap-1.5 px-1 pb-2 text-[10px] leading-relaxed text-muted">
            <Undo2 className="h-3 w-3 shrink-0" />
            Refund completion is separate from payment, settlement and reconciliation states.
            Captured revenue is not silently reduced by a requested refund.
          </p>
        </div>
      )}
    </Drawer>
  );
}
