import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Lightbulb,
  Link2,
  Lock,
  UserCheck,
} from 'lucide-react';
import { useAssignException, useException, useResolveException } from '../../lib/queries';
import { errorMessage } from '../../lib/api';
import { useToast } from '../providers/ToastProvider';
import {
  exceptionStatusMeta,
  exceptionTypeLabel,
  paymentStatusMeta,
} from '../../lib/status';
import { formatDateTime, formatMoney, formatRelative } from '../../lib/format';
import { Drawer } from '../ui/Drawer';
import { Button } from '../ui/Button';
import { Badge, SeverityBadge, StatusBadge } from '../ui/Badge';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { DetailList } from '../ui/DetailList';
import { Callout } from '../ui/Callout';
import { Input, Select, Textarea } from '../ui/Field';
import { Skeleton, SkeletonText } from '../ui/Skeleton';
import { ErrorState } from '../ui/States';
import { CopyButton } from '../ui/CopyButton';

const resolutionLabels: Record<string, string> = {
  EVIDENCE_VERIFIED: 'Evidence verified',
  FALSE_POSITIVE: 'False positive',
  ADJUSTED_EXTERNALLY: 'Adjusted externally',
  ACCEPTED_AS_IS: 'Accepted as is',
};

const operatorIdentity = 'operator@ledgerlens.local';

export function ExceptionDrawer({
  reference,
  onClose,
}: {
  reference: string | null;
  onClose: () => void;
}) {
  const { data, isPending, isError, error, refetch } = useException(reference);
  const assign = useAssignException();
  const resolve = useResolveException();
  const { toast } = useToast();

  const [assignedTo, setAssignedTo] = useState(operatorIdentity);
  const [assignNote, setAssignNote] = useState('');
  const [resolutionType, setResolutionType] = useState('EVIDENCE_VERIFIED');
  const [resolutionNote, setResolutionNote] = useState('');

  const exception = data?.exception;
  const resolved = exception?.status === 'RESOLVED';

  function handleAssign(event: React.FormEvent) {
    event.preventDefault();
    if (!exception || assignedTo.trim().length < 2) return;
    assign.mutate(
      {
        reference: exception.exceptionRef,
        assignedTo: assignedTo.trim(),
        note: assignNote.trim() || undefined,
      },
      {
        onSuccess: () => {
          setAssignNote('');
          toast({
            title: 'Exception assigned',
            description: `${exception.exceptionRef} is now under review.`,
            tone: 'success',
          });
        },
        onError: (mutationError) =>
          toast({
            title: 'Could not assign exception',
            description: errorMessage(mutationError),
            tone: 'danger',
          }),
      },
    );
  }

  function handleResolve(event: React.FormEvent) {
    event.preventDefault();
    if (!exception || resolutionNote.trim().length < 8) return;
    resolve.mutate(
      {
        reference: exception.exceptionRef,
        resolutionType,
        note: resolutionNote.trim(),
      },
      {
        onSuccess: () => {
          setResolutionNote('');
          toast({
            title: 'Exception resolved',
            description: 'The operator decision was recorded. Original evidence is unchanged.',
            tone: 'success',
          });
        },
        onError: (mutationError) =>
          toast({
            title: 'Could not resolve exception',
            description: errorMessage(mutationError),
            tone: 'danger',
          }),
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
          <span className="font-mono text-[13px]">{reference ?? 'Exception'}</span>
          {reference ? <CopyButton value={reference} /> : null}
        </span>
      }
      description={
        exception
          ? `${exceptionTypeLabel[exception.type]} · ${exception.status.replaceAll('_', ' ').toLowerCase()}`
          : 'Reconciliation exception evidence and operator actions.'
      }
      footer={
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] text-muted">
            {exception?.assignedTo ? `Assigned to ${exception.assignedTo}` : 'Unassigned'}
          </p>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      {isPending ? (
        <div className="space-y-4 p-5">
          <Skeleton className="h-24 w-full rounded-xl" />
          <SkeletonText lines={5} />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      ) : isError || !data || !exception ? (
        <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />
      ) : (
        <div className="space-y-4 p-4 sm:p-5">
          <div className="rounded-xl border border-line bg-surface p-4 shadow-card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone="danger">{exceptionTypeLabel[exception.type]}</Badge>
                  <SeverityBadge severity={exception.severity} />
                  <StatusBadge meta={exceptionStatusMeta[exception.status]} />
                </div>
                <p className="mt-2.5 text-[13px] font-medium leading-relaxed text-ink">
                  {exception.explanation}
                </p>
                <p className="mt-1 text-[10.5px] text-muted">
                  First seen {formatDateTime(exception.firstDetectedAt)} · last seen{' '}
                  {formatRelative(exception.lastDetectedAt)} · detected {exception.timesSeen}×
                </p>
              </div>
            </div>
          </div>

          <Callout tone="info" title="Suggested next action">
            {exception.suggestedAction}
          </Callout>

          {resolved ? (
            <Callout tone="success" title="Resolved by an operator">
              <p>
                {exception.resolutionType
                  ? resolutionLabels[exception.resolutionType] ?? exception.resolutionType
                  : 'Resolution recorded'}
                {exception.resolvedAt ? ` · ${formatDateTime(exception.resolvedAt)}` : ''}
              </p>
              {exception.resolutionNote ? (
                <p className="mt-1 leading-relaxed">{exception.resolutionNote}</p>
              ) : null}
              <p className="mt-1.5 flex items-center gap-1 text-[10px] opacity-80">
                <Lock className="h-3 w-3" /> The original discrepancy and evidence remain visible.
              </p>
            </Callout>
          ) : null}

          <Card>
            <CardHeader
              title="Amount and currency evidence"
              description="Integer minor units. No currency is summed or converted with another."
            />
            <CardBody className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-line bg-surface-sunken p-3">
                  <p className="text-[9.5px] font-semibold uppercase tracking-wide text-muted">
                    Expected (order)
                  </p>
                  <p className="mt-1 text-base font-semibold text-ink tabular">
                    {exception.expectedAmountMinor === null
                      ? '—'
                      : formatMoney(
                          exception.expectedAmountMinor,
                          exception.expectedCurrency ?? 'INR',
                        )}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted">
                    {exception.expectedCurrency ?? 'No order currency'}
                  </p>
                </div>
                <div className="rounded-lg border border-line bg-surface-sunken p-3">
                  <p className="text-[9.5px] font-semibold uppercase tracking-wide text-muted">
                    Observed (payment)
                  </p>
                  <p className="mt-1 text-base font-semibold text-ink tabular">
                    {exception.observedAmountMinor === null
                      ? '—'
                      : formatMoney(
                          exception.observedAmountMinor,
                          exception.observedCurrency ?? 'INR',
                        )}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted">
                    {exception.observedCurrency ?? 'No payment currency'}
                  </p>
                </div>
              </div>
              {exception.differenceMinor !== null ? (
                <div className="flex items-center justify-between rounded-lg border border-danger-100 bg-danger-50 px-3 py-2">
                  <span className="text-[11px] font-medium text-danger-700">Difference</span>
                  <span className="text-[13px] font-semibold text-danger-700 tabular">
                    {formatMoney(
                      exception.differenceMinor,
                      exception.observedCurrency ?? exception.expectedCurrency ?? 'INR',
                    )}
                  </span>
                </div>
              ) : null}
              <DetailList
                dense
                items={[
                  { label: 'Transaction', value: exception.transactionRef ?? '—', mono: true },
                  { label: 'Order', value: exception.orderRef ?? '—', mono: true },
                  { label: 'Payment reference', value: exception.paymentRef ?? '—', mono: true },
                  { label: 'Fingerprint', value: exception.fingerprint, mono: true },
                  { label: 'Run', value: exception.runId ?? '—', mono: true },
                ]}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Linked records"
              description="Only records actually observed by reconciliation appear here."
            />
            <CardBody className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-line p-3">
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                  Order
                </p>
                {exception.evidence.order ? (
                  <>
                    <p className="font-mono text-[11.5px] text-ink">
                      {exception.evidence.order.orderRef}
                    </p>
                    <p className="mt-1 text-[11px] text-muted">
                      {formatMoney(
                        exception.evidence.order.amountMinor,
                        exception.evidence.order.currency,
                      )}{' '}
                      · {exception.evidence.order.customerRef}
                    </p>
                  </>
                ) : (
                  <p className="text-[11px] text-danger-700">No order record found</p>
                )}
              </div>
              <div className="rounded-lg border border-line p-3">
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                  Payment
                </p>
                {exception.evidence.payment ? (
                  <>
                    <p className="font-mono text-[11.5px] text-ink">
                      {exception.evidence.payment.transactionRef}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] text-muted">
                        {formatMoney(
                          exception.evidence.payment.amountMinor,
                          exception.evidence.payment.currency,
                        )}
                      </span>
                      <StatusBadge meta={paymentStatusMeta[exception.evidence.payment.status]} />
                    </div>
                  </>
                ) : (
                  <p className="text-[11px] text-danger-700">No payment record found</p>
                )}
              </div>

              {exception.evidence.relatedPayments && exception.evidence.relatedPayments.length > 0 ? (
                <div className="sm:col-span-2">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                    Payments grouped by this order
                  </p>
                  <ul className="divide-y divide-line rounded-lg border border-line">
                    {exception.evidence.relatedPayments.map((related) => (
                      <li
                        key={related.transactionRef}
                        className="flex flex-wrap items-center gap-2 px-3 py-2"
                      >
                        <Link2 className="h-3 w-3 text-muted-light" />
                        <span className="font-mono text-[10.5px] text-ink">
                          {related.transactionRef}
                        </span>
                        <span className="flex-1" />
                        <span className="text-[11px] font-medium text-ink tabular">
                          {formatMoney(related.amountMinor, related.currency)}
                        </span>
                        <StatusBadge meta={paymentStatusMeta[related.status]} />
                        <span className="text-[10px] text-muted">
                          {formatDateTime(related.createdAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {exception.evidence.eventKeys && exception.evidence.eventKeys.length > 0 ? (
                <div className="sm:col-span-2">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                    Event keys used as evidence
                  </p>
                  <ul className="space-y-1 rounded-lg border border-line bg-surface-sunken p-2.5">
                    {exception.evidence.eventKeys.map((key) => (
                      <li key={key} className="font-mono text-[10px] text-ink-soft">
                        {key}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </CardBody>
          </Card>

          {!resolved ? (
            <>
              <Card>
                <CardHeader
                  title="Assign for review"
                  description="Assignment changes exception workflow state, not financial records."
                />
                <CardBody>
                  <form onSubmit={handleAssign} className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label
                          htmlFor="assigned-to"
                          className="mb-1.5 block text-xs font-semibold text-ink-soft"
                        >
                          Assigned to
                        </label>
                        <Input
                          id="assigned-to"
                          value={assignedTo}
                          onChange={(event) => setAssignedTo(event.target.value)}
                          maxLength={80}
                          required
                          minLength={2}
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="assign-note"
                          className="mb-1.5 block text-xs font-semibold text-ink-soft"
                        >
                          Note <span className="font-normal text-muted">(optional)</span>
                        </label>
                        <Input
                          id="assign-note"
                          value={assignNote}
                          onChange={(event) => setAssignNote(event.target.value)}
                          placeholder="What should the reviewer check?"
                          maxLength={300}
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="flex items-center gap-1 text-[10px] text-muted">
                        <UserCheck className="h-3 w-3" /> Current:{' '}
                        {exception.assignedTo ?? 'unassigned'}
                      </p>
                      <Button
                        type="submit"
                        variant="secondary"
                        size="sm"
                        loading={assign.isPending}
                        disabled={assignedTo.trim().length < 2}
                      >
                        Save assignment
                      </Button>
                    </div>
                  </form>
                </CardBody>
              </Card>

              <Card>
                <CardHeader
                  title="Record a resolution"
                  description="A resolution requires an explicit decision and a note. It never rewrites the underlying discrepancy."
                />
                <CardBody>
                  <form onSubmit={handleResolve} className="space-y-3">
                    <div>
                      <label
                        htmlFor="resolution-type"
                        className="mb-1.5 block text-xs font-semibold text-ink-soft"
                      >
                        Resolution type
                      </label>
                      <Select
                        id="resolution-type"
                        value={resolutionType}
                        onChange={(event) => setResolutionType(event.target.value)}
                      >
                        {(data.resolutionTypes ?? Object.keys(resolutionLabels)).map((value) => (
                          <option key={value} value={value}>
                            {resolutionLabels[value] ?? value}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <label
                        htmlFor="resolution-note"
                        className="mb-1.5 block text-xs font-semibold text-ink-soft"
                      >
                        Resolution note
                      </label>
                      <Textarea
                        id="resolution-note"
                        value={resolutionNote}
                        onChange={(event) => setResolutionNote(event.target.value)}
                        placeholder="Explain what was verified or adjusted, and where the evidence is recorded. (minimum 8 characters)"
                        maxLength={1000}
                        rows={3}
                      />
                      <p className="mt-1 text-right text-[10px] text-muted">
                        {resolutionNote.trim().length}/8 minimum
                      </p>
                    </div>
                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        loading={resolve.isPending}
                        disabled={resolutionNote.trim().length < 8}
                      >
                        <ClipboardCheck className="h-3.5 w-3.5" /> Resolve exception
                      </Button>
                    </div>
                  </form>
                </CardBody>
              </Card>
            </>
          ) : null}

          <Card>
            <CardHeader
              title="Audit trail"
              description="Operator actions are append-only and tied to this exception."
            />
            {data.audits.length === 0 ? (
              <div className="flex items-center gap-2 px-4 py-4 text-[11px] text-muted">
                <AlertTriangle className="h-3.5 w-3.5" />
                No operator actions recorded yet.
              </div>
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
            <CheckCircle2 className="h-3 w-3 shrink-0 text-success-600" />
            Re-running reconciliation updates active exceptions in place. Resolutions are preserved
            and never auto-reopened.
          </p>
          <p className="flex items-center gap-1.5 px-1 pb-2 text-[10px] leading-relaxed text-muted">
            <Lightbulb className="h-3 w-3 shrink-0 text-warning-600" />
            Amounts use {exception.observedCurrency ?? exception.expectedCurrency ?? 'the recorded'}{' '}
            currency. No exchange-rate conversion is applied.
          </p>
        </div>
      )}
    </Drawer>
  );
}
