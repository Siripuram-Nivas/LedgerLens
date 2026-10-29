import { Link } from 'react-router-dom';
import { Landmark, ReceiptText } from 'lucide-react';
import { useSettlement } from '../../lib/queries';
import { errorMessage } from '../../lib/api';
import {
  paymentStatusMeta,
  reconciliationStatusMeta,
  settlementRecordStatusMeta,
} from '../../lib/status';
import { formatDateTime, formatMoney } from '../../lib/format';
import { Drawer } from '../ui/Drawer';
import { Badge, StatusBadge } from '../ui/Badge';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { DetailList } from '../ui/DetailList';
import { Callout } from '../ui/Callout';
import { Skeleton, SkeletonText } from '../ui/Skeleton';
import { ErrorState } from '../ui/States';
import { CopyButton } from '../ui/CopyButton';
import { Table, TBody, Td, Th, THead, Tr } from '../ui/Table';

export function SettlementDrawer({
  reference,
  onClose,
}: {
  reference: string | null;
  onClose: () => void;
}) {
  const { data, isPending, isError, error, refetch } = useSettlement(reference);

  return (
    <Drawer
      open={Boolean(reference)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      width="xl"
      title={
        <span className="flex items-center gap-2">
          <span className="font-mono text-[13px]">{reference ?? 'Settlement'}</span>
          {reference ? <CopyButton value={reference} /> : null}
        </span>
      }
      description="Settlement batch and the captured payments it references."
    >
      {isPending ? (
        <div className="space-y-4 p-5">
          <Skeleton className="h-28 w-full rounded-xl" />
          <SkeletonText lines={4} />
          <Skeleton className="h-44 w-full rounded-xl" />
        </div>
      ) : isError || !data ? (
        <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />
      ) : (
        <div className="space-y-4 p-4 sm:p-5">
          <div className="rounded-xl border border-line bg-surface p-4 shadow-card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
                  Gross settlement
                </p>
                <p className="mt-1 text-2xl font-semibold tracking-tight text-ink tabular">
                  {formatMoney(data.settlement.grossMinor, data.settlement.currency)}
                </p>
                <p className="mt-1 text-[11px] text-muted">
                  {data.payments.length} payment{data.payments.length === 1 ? '' : 's'} · expected{' '}
                  {formatDateTime(data.settlement.expectedAt)}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <StatusBadge meta={settlementRecordStatusMeta[data.settlement.status]} />
                {data.simulated ? <Badge tone="warning">Simulated batch</Badge> : null}
              </div>
            </div>
          </div>

          {data.simulated ? (
            <Callout tone="warning" title="Simulated settlement data">
              This batch belongs to the demo environment. Fees and net values are explicit simulated
              fixtures, not a bank deposit or provider report.
            </Callout>
          ) : null}

          <Card>
            <CardHeader title="Batch amounts" description="Fees are shown only when a provider or fixture explicitly records them." />
            <CardBody>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg border border-line p-3">
                  <p className="text-[9.5px] uppercase tracking-wide text-muted">Gross</p>
                  <p className="mt-1 text-sm font-semibold text-ink tabular">
                    {formatMoney(data.settlement.grossMinor, data.settlement.currency)}
                  </p>
                </div>
                <div className="rounded-lg border border-line p-3">
                  <p className="text-[9.5px] uppercase tracking-wide text-muted">Fees</p>
                  <p className="mt-1 text-sm font-semibold text-ink tabular">
                    {data.settlement.feesMinor === null
                      ? '—'
                      : formatMoney(data.settlement.feesMinor, data.settlement.currency)}
                  </p>
                </div>
                <div className="rounded-lg border border-line p-3">
                  <p className="text-[9.5px] uppercase tracking-wide text-muted">Net</p>
                  <p className="mt-1 text-sm font-semibold text-ink tabular">
                    {data.settlement.netMinor === null
                      ? '—'
                      : formatMoney(data.settlement.netMinor, data.settlement.currency)}
                  </p>
                </div>
              </div>
              <DetailList
                className="mt-3"
                dense
                items={[
                  {
                    label: 'Provider ref',
                    value: data.settlement.providerSettlementRef ?? '—',
                    mono: true,
                  },
                  {
                    label: 'Fee source',
                    value: data.settlement.feesSource
                      ? data.settlement.feesSource.replaceAll('_', ' ').toLowerCase()
                      : 'Not recorded',
                  },
                  { label: 'Expected at', value: formatDateTime(data.settlement.expectedAt) },
                  { label: 'Settled at', value: formatDateTime(data.settlement.settledAt) },
                  { label: 'Source', value: `${data.settlement.source} / ${data.settlement.environment}` },
                ]}
              />
              {data.settlement.notes ? (
                <p className="mt-3 rounded-lg bg-surface-sunken p-2.5 text-[11px] leading-relaxed text-muted">
                  {data.settlement.notes}
                </p>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Referenced payments"
              description="Payment capture and reconciliation states are independent of settlement."
            />
            {data.payments.length === 0 ? (
              <div className="flex items-center gap-2 px-4 py-5 text-[11px] text-muted">
                <ReceiptText className="h-4 w-4" /> No payment records currently resolve for this
                batch.
              </div>
            ) : (
              <Table minWidth={620}>
                <THead>
                  <Th>Payment</Th>
                  <Th align="right">Amount</Th>
                  <Th>Payment</Th>
                  <Th>Reconciliation</Th>
                </THead>
                <TBody>
                  {data.payments.map((payment) => (
                    <Tr key={payment.transactionRef}>
                      <Td>
                        <Link
                          to={`/transactions?transaction=${encodeURIComponent(payment.transactionRef)}`}
                          className="font-mono text-[10.5px] font-medium text-brand-700 hover:underline"
                        >
                          {payment.transactionRef}
                        </Link>
                        <p className="mt-0.5 font-mono text-[9.5px] text-muted-light">
                          {payment.providerPaymentId}
                        </p>
                      </Td>
                      <Td align="right" className="whitespace-nowrap text-[11px] font-medium text-ink tabular">
                        {formatMoney(payment.amountMinor, payment.currency)}
                      </Td>
                      <Td>
                        <StatusBadge meta={paymentStatusMeta[payment.status]} />
                      </Td>
                      <Td>
                        <StatusBadge meta={reconciliationStatusMeta[payment.reconciliationStatus]} />
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            )}
          </Card>

          <p className="flex items-center gap-1.5 px-1 pb-2 text-[10px] leading-relaxed text-muted">
            <Landmark className="h-3 w-3 shrink-0" />
            Settlement confirmation is recorded only from a trusted settlement record. A paid
            payment alone never proves the merchant received funds.
          </p>
        </div>
      )}
    </Drawer>
  );
}
