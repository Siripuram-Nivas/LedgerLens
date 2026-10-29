import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Play,
  RefreshCw,
  ScrollText,
  ShieldAlert,
  Wallet,
} from 'lucide-react';
import { useDashboard, useRunReconciliation } from '../lib/queries';
import { errorMessage } from '../lib/api';
import { useToast } from '../components/providers/ToastProvider';
import type { DashboardRange } from '../lib/api';
import {
  exceptionTypeLabel,
  exceptionTypeTone,
  paymentStatusMeta,
  reconciliationStatusMeta,
  settlementStatusMeta,
} from '../lib/status';
import {
  formatDateTime,
  formatMoney,
  formatNumber,
  formatRelative,
} from '../lib/format';
import { cn } from '../lib/cn';
import { PageHeader } from '../components/ui/PageHeader';
import { MetricCard } from '../components/ui/MetricCard';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge, StatusBadge } from '../components/ui/Badge';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { ChartSkeleton, MetricsSkeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/States';
import { Table, TBody, Td, Th, THead, Tr } from '../components/ui/Table';
import { Tooltip } from '../components/ui/Tooltip';
import { ActivityChart } from '../components/charts/ActivityChart';
import { PaymentStatusDonut } from '../components/charts/PaymentStatusDonut';
import type { SettlementStatus } from '../types/api';

const rangeOptions = [
  { value: '24h' as const, label: '24h' },
  { value: '7d' as const, label: '7 days' },
  { value: '30d' as const, label: '30 days' },
];

const settlementColors: Record<SettlementStatus, string> = {
  NOT_APPLICABLE: '#e2e8f0',
  NOT_STARTED: '#cbd5e1',
  PENDING: '#d97706',
  SETTLED: '#059669',
  FAILED: '#dc2626',
  UNKNOWN: '#94a3b8',
};

function processingTone(status: string) {
  if (status === 'PROCESSED') return 'success' as const;
  if (status === 'FAILED') return 'danger' as const;
  return 'info' as const;
}

export function OverviewPage() {
  const [range, setRange] = useState<DashboardRange>('7d');
  const { data, isPending, isFetching, isError, error, refetch } = useDashboard(range);
  const runReconciliation = useRunReconciliation();
  const { toast } = useToast();

  const settlementTotal = useMemo(
    () => data?.settlementDistribution.reduce((total, entry) => total + entry.count, 0) ?? 0,
    [data],
  );

  function handleRun() {
    runReconciliation.mutate(
      { scope: 'all' },
      {
        onSuccess: (run) => {
          toast({
            title: 'Reconciliation run completed',
            description: `${run.counts.paymentsEvaluated} payments evaluated · ${run.counts.exceptionsCreated} new · ${run.counts.exceptionsAutoResolved} auto-cleared.`,
            tone: 'success',
          });
        },
        onError: (mutationError) => {
          toast({
            title: 'Reconciliation failed',
            description: errorMessage(mutationError),
            tone: 'danger',
          });
        },
      },
    );
  }

  const header = (
    <PageHeader
      title="Overview"
      description={
        data
          ? `${data.range.label} · generated ${formatRelative(data.generatedAt)}. Payment, settlement and reconciliation states are tracked independently.`
          : 'Payment capture, settlement visibility and explainable reconciliation exceptions in one place.'
      }
      actions={
        <>
          <SegmentedControl
            value={range}
            options={rangeOptions}
            onChange={setRange}
            label="Dashboard time range"
          />
          <Tooltip content="Refresh dashboard data">
            <Button
              variant="secondary"
              size="icon"
              onClick={() => void refetch()}
              aria-label="Refresh dashboard"
            >
              <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
            </Button>
          </Tooltip>
          <Button onClick={handleRun} loading={runReconciliation.isPending}>
            <Play className="h-3.5 w-3.5" /> Run reconciliation
          </Button>
        </>
      }
    />
  );

  if (!data && isPending) {
    return (
      <div className="space-y-5">
        {header}
        <MetricsSkeleton />
        <div className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <ChartSkeleton className="h-64" />
          <ChartSkeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-5">
        {header}
        <Card>
          <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />
        </Card>
      </div>
    );
  }

  const { metrics, range: rangeInfo } = data;
  const primaryCurrency = metrics.valueProcessedCurrency;
  const settlementCurrency = metrics.settlementPendingCurrency;
  const multiCurrencyValue = metrics.valueByCurrency.length > 1;
  const settlementDistribution = data.settlementDistribution.filter((entry) => entry.count > 0);

  return (
    <div className="space-y-5">
      {header}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Key metrics">
        <MetricCard
          label="Transactions"
          value={formatNumber(metrics.totalTransactions)}
          icon={ArrowLeftRight}
          tone="brand"
          hint={`${formatNumber(metrics.successfulPayments)} paid · ${formatNumber(metrics.pendingPayments)} pending · ${formatNumber(metrics.failedPayments)} failed`}
        />
        <MetricCard
          label="Value captured"
          value={formatMoney(metrics.valueProcessedMinor, primaryCurrency)}
          icon={CircleDollarSign}
          tone="success"
          hint={
            multiCurrencyValue ? (
              <span>
                {metrics.valueByCurrency
                  .map((entry) => `${entry.currency} ${formatMoney(entry.amountMinor, entry.currency)}`)
                  .join(' · ')}
              </span>
            ) : (
              `${formatNumber(metrics.successfulPayments)} PAID payments · gross`
            )
          }
        />
        <MetricCard
          label="Open exceptions"
          value={formatNumber(metrics.openExceptions)}
          icon={ShieldAlert}
          tone={metrics.openExceptions > 0 ? 'danger' : 'success'}
          hint={
            metrics.openExceptions > 0
              ? `${formatNumber(metrics.pendingReconciliation)} pending reconciliation`
              : 'No unmatched or disputed records'
          }
          badge={
            metrics.openExceptions === 0 ? (
              <Badge tone="success" dot>
                All clear
              </Badge>
            ) : undefined
          }
        />
        <MetricCard
          label="Settlement pending"
          value={formatMoney(metrics.settlementPendingGrossMinor, settlementCurrency)}
          icon={Wallet}
          tone="warning"
          hint={`${formatNumber(metrics.settlementPendingPayments)} payment${
            metrics.settlementPendingPayments === 1 ? '' : 's'
          } in ${formatNumber(metrics.settlementPending)} pending batch${
            metrics.settlementPending === 1 ? '' : 'es'
          }`}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
        <Card>
          <CardHeader
            title="Payment activity"
            description="Attempt value and count per bucket. Value includes all attempt statuses, not only captures."
            action={
              <div className="flex items-center gap-3 text-[10px] text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-brand-600" aria-hidden /> Value
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm bg-slate-300" aria-hidden /> Attempts
                </span>
              </div>
            }
          />
          <CardBody className="pt-4">
            <ActivityChart
              trend={data.trend}
              currency={primaryCurrency}
              granularity={rangeInfo.granularity}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Payment status"
            description="Independent payment dimension."
            action={<Badge tone="neutral">{rangeInfo.preset}</Badge>}
          />
          <CardBody>
            <PaymentStatusDonut data={data.statusDistribution} total={metrics.totalTransactions} />
          </CardBody>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1.15fr]">
        <Card>
          <CardHeader
            title="Settlement position"
            description="Recorded batches only. Never inferred from payment success."
            action={
              <Link
                to="/settlements"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:text-brand-900"
              >
                Settlements <ArrowRight className="h-3 w-3" />
              </Link>
            }
          />
          <CardBody className="space-y-4">
            <div className="rounded-lg border border-line bg-surface-sunken p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-muted">
                    Awaiting settlement
                  </p>
                  <p className="mt-1 text-xl font-semibold tracking-tight text-ink tabular">
                    {formatMoney(metrics.settlementPendingGrossMinor, settlementCurrency)}
                  </p>
                </div>
                <Badge tone="warning" dot>
                  {formatNumber(metrics.settlementPending)} batch
                  {metrics.settlementPending === 1 ? '' : 'es'}
                </Badge>
              </div>
              <p className="mt-1.5 text-[11px] text-muted">
                {formatNumber(metrics.settlementPendingPayments)} captured payments are not settled
                yet.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                ['Settled gross', metrics.settledGrossMinor],
                ['Fees', metrics.settledFeesMinor],
                ['Net settled', metrics.settledNetMinor],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-lg border border-line p-2.5">
                  <p className="text-[9.5px] uppercase tracking-wide text-muted">{label}</p>
                  <p className="mt-1 text-[12.5px] font-semibold text-ink tabular">
                    {formatMoney(Number(value), metrics.settlementCurrency)}
                  </p>
                </div>
              ))}
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between text-[10px] text-muted">
                <span>Settlement status distribution</span>
                <span>{formatNumber(settlementTotal)} payments</span>
              </div>
              <div className="flex h-2 overflow-hidden rounded-full bg-surface-sunken">
                {settlementDistribution.map((entry) => (
                  <span
                    key={entry.status}
                    style={{
                      width: `${settlementTotal > 0 ? (entry.count / settlementTotal) * 100 : 0}%`,
                      backgroundColor: settlementColors[entry.status],
                    }}
                    title={`${settlementStatusMeta[entry.status].label}: ${entry.count}`}
                  />
                ))}
              </div>
              <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                {data.settlementDistribution
                  .filter((entry) => entry.count > 0)
                  .map((entry) => (
                    <li key={entry.status} className="flex items-center gap-1.5 text-[10px] text-muted">
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: settlementColors[entry.status] }}
                        aria-hidden
                      />
                      <span className="flex-1 truncate">
                        {settlementStatusMeta[entry.status].label}
                      </span>
                      <span className="font-semibold text-ink-soft tabular">{entry.count}</span>
                    </li>
                  ))}
              </ul>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Newest exceptions"
            description="Explainable discrepancies with order and payment evidence."
            action={
              <Link
                to="/reconciliation"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:text-brand-900"
              >
                Workspace <ArrowRight className="h-3 w-3" />
              </Link>
            }
          />
          {data.recentExceptions.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-5 py-12 text-center">
              <CheckCircle2 className="h-8 w-8 text-success-600" />
              <p className="mt-2 text-sm font-semibold text-ink">No reconciliation exceptions</p>
              <p className="mt-1 text-xs text-muted">
                Every evaluated order and payment currently agrees.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {data.recentExceptions.slice(0, 4).map((exception) => (
                <li key={exception.exceptionRef}>
                  <Link
                    to={`/reconciliation?exception=${encodeURIComponent(exception.exceptionRef)}`}
                    className="group flex items-start gap-3 px-4 py-3 transition hover:bg-surface-sunken/70 sm:px-5"
                  >
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-danger-50 text-danger-600">
                      <AlertTriangle className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[12.5px] font-semibold text-ink">
                          {exceptionTypeLabel[exception.type]}
                        </span>
                        <Badge tone={exceptionTypeTone[exception.type]}>{exception.severity}</Badge>
                        <Badge tone={exception.status === 'OPEN' ? 'danger' : 'warning'}>
                          {exception.status.replaceAll('_', ' ')}
                        </Badge>
                      </div>
                      <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted">
                        {exception.explanation}
                      </p>
                      <p className="mt-1 text-[10px] text-muted-light">
                        {exception.transactionRef ?? exception.orderRef ?? exception.exceptionRef} ·{' '}
                        {formatRelative(exception.lastDetectedAt)}
                      </p>
                    </div>
                    <ChevronRight className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-light transition group-hover:text-ink" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader
            title="Recent payments"
            description="Latest attempts in the selected environment."
            action={
              <Link
                to="/transactions"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:text-brand-900"
              >
                All transactions <ArrowRight className="h-3 w-3" />
              </Link>
            }
          />
          <Table minWidth={960}>
            <THead>
              <Th>Payment</Th>
              <Th align="right">Amount</Th>
              <Th>Payment</Th>
              <Th>Settlement</Th>
              <Th>Reconciliation</Th>
              <Th>Refund</Th>
              <Th align="right">Created</Th>
            </THead>
            <TBody>
              {data.recentTransactions.map((payment) => (
                <Tr key={payment.transactionRef}>
                  <Td>
                    <Link
                      to={`/transactions?transaction=${encodeURIComponent(payment.transactionRef)}`}
                      className="font-mono text-[11.5px] font-medium text-brand-700 hover:text-brand-900 hover:underline"
                    >
                      {payment.transactionRef}
                    </Link>
                    <p className="mt-0.5 font-mono text-[10px] text-muted-light">
                      {payment.customerRef}
                    </p>
                  </Td>
                  <Td align="right" className="font-semibold text-ink tabular">
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
                    <span className="text-[11px] text-muted">
                      {payment.refundStatus === 'NONE'
                        ? '—'
                        : payment.refundStatus.replaceAll('_', ' ').toLowerCase()}
                    </span>
                  </Td>
                  <Td align="right" className="whitespace-nowrap text-[11px] text-muted">
                    {formatDateTime(payment.createdAt)}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Latest reconciliation run"
            description="Runs update active exceptions in place and preserve operator resolutions."
            action={
              <Link
                to="/reconciliation"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:text-brand-900"
              >
                Runs <ArrowRight className="h-3 w-3" />
              </Link>
            }
          />
          <CardBody>
            {data.latestRun ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-mono text-xs font-medium text-ink">
                      {data.latestRun.runRef}
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted">
                      {data.latestRun.scope} · {formatDateTime(data.latestRun.finishedAt)} ·{' '}
                      {data.latestRun.triggeredBy}
                    </p>
                  </div>
                  <Badge
                    tone={data.latestRun.status === 'COMPLETED' ? 'success' : 'warning'}
                    dot
                  >
                    {data.latestRun.status.toLowerCase()}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {[
                    ['Payments', data.latestRun.counts.paymentsEvaluated],
                    ['Orders', data.latestRun.counts.ordersEvaluated],
                    ['Matched', data.latestRun.counts.matched],
                    ['New exceptions', data.latestRun.counts.exceptionsCreated],
                    ['Auto-cleared', data.latestRun.counts.exceptionsAutoResolved],
                    ['Duplicate events', data.latestRun.counts.duplicateEventsDetected],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded-lg border border-line p-2.5">
                      <p className="text-[9.5px] uppercase tracking-wide text-muted">{label}</p>
                      <p className="mt-0.5 text-sm font-semibold text-ink tabular">
                        {formatNumber(Number(value))}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Clock3 className="h-7 w-7 text-muted-light" />
                <p className="mt-2 text-sm font-semibold text-ink">No reconciliation run yet</p>
                <p className="mt-1 text-xs text-muted">
                  Run reconciliation to evaluate every payment against its order.
                </p>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Recent webhook events"
            description="Idempotent event processing. Duplicate deliveries never repeat financial effects."
            action={
              <Link
                to="/events"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:text-brand-900"
              >
                Event log <ArrowRight className="h-3 w-3" />
              </Link>
            }
          />
          {data.recentEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <ScrollText className="h-7 w-7 text-muted-light" />
              <p className="mt-2 text-sm font-semibold text-ink">No events received</p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {data.recentEvents.slice(0, 4).map((event) => (
                <li key={event.eventKey} className="flex items-start gap-3 px-4 py-2.5 sm:px-5">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-surface-sunken text-muted">
                    <ScrollText className="h-3 w-3" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-[11px] font-medium text-ink">
                        {event.type}
                      </span>
                      <Badge tone={processingTone(event.processingStatus)}>
                        {event.processingStatus.toLowerCase()}
                      </Badge>
                      {event.duplicateDeliveryCount > 0 ? (
                        <Badge tone="warning">duplicate ×{event.duplicateDeliveryCount}</Badge>
                      ) : null}
                    </div>
                    <p className="mt-0.5 truncate font-mono text-[10px] text-muted-light">
                      {event.eventKey}
                    </p>
                  </div>
                  <span className="shrink-0 text-[10px] text-muted">
                    {formatRelative(event.receivedAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}
