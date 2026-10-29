import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  FlaskConical,
  Layers,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Undo2,
  Wallet,
  XCircle,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  useDemoScenario,
  useDemoStatus,
  useMeta,
  useResetDemo,
} from '../lib/queries';
import { errorMessage } from '../lib/api';
import { formatMoney } from '../lib/format';
import type { DemoScenario } from '../types/api';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Callout } from '../components/ui/Callout';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Input, Label } from '../components/ui/Field';
import { Skeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/States';
import { useToast } from '../components/providers/ToastProvider';

const RESET_PHRASE = 'RESET DEMO DATA';

interface ScenarioMeta {
  label: string;
  description: string;
  demonstrates: string;
  icon: LucideIcon;
  tone: 'brand' | 'success' | 'warning' | 'danger' | 'neutral' | 'info';
}

const scenarioMeta: Record<DemoScenario, ScenarioMeta> = {
  payment_success: {
    label: 'Payment success',
    description: 'Creates an order and a captured payment, then processes a simulated capture event.',
    demonstrates: 'Paid state without inferring settlement.',
    icon: CheckCircle2,
    tone: 'success',
  },
  payment_processing: {
    label: 'Payment processing',
    description: 'Simulates an authorization event so the payment stays processing.',
    demonstrates: 'Capture has not happened; reconciliation waits.',
    icon: Clock3,
    tone: 'info',
  },
  payment_pending: {
    label: 'Payment pending',
    description: 'Records a pending provider event on a new order and payment.',
    demonstrates: 'Pending is distinct from failed and paid.',
    icon: Clock3,
    tone: 'neutral',
  },
  payment_failed: {
    label: 'Payment failed',
    description: 'Simulates a failed attempt with no captured funds.',
    demonstrates: 'Settlement and reconciliation become NOT_APPLICABLE.',
    icon: XCircle,
    tone: 'danger',
  },
  duplicate_webhook: {
    label: 'Duplicate webhook',
    description: 'Processes the same event key twice and retains both deliveries.',
    demonstrates: 'Idempotent processing without a second financial effect.',
    icon: Layers,
    tone: 'warning',
  },
  amount_mismatch: {
    label: 'Amount mismatch',
    description: 'Captures a payment amount that differs from the linked order total.',
    demonstrates: 'An explainable reconciliation exception with evidence.',
    icon: AlertTriangle,
    tone: 'danger',
  },
  missing_order: {
    label: 'Missing order',
    description: 'Captures a payment that has no linked order record.',
    demonstrates: 'Missing-order exception, not a silent match.',
    icon: ShieldAlert,
    tone: 'danger',
  },
  settlement_pending: {
    label: 'Settlement pending',
    description: 'Captures a payment and records a pending settlement batch.',
    demonstrates: 'Captured funds are not automatically settled.',
    icon: Wallet,
    tone: 'warning',
  },
  settlement_confirmed: {
    label: 'Settlement confirmed',
    description: 'Confirms the newest pending demo settlement with simulated fees.',
    demonstrates: 'Settlement success recorded separately, fees labeled simulated.',
    icon: Wallet,
    tone: 'success',
  },
  refund: {
    label: 'Refund requested',
    description: 'Captures a payment and records a partial refund request.',
    demonstrates: 'A request is not a completed refund until advanced.',
    icon: Undo2,
    tone: 'info',
  },
};

const scenarioOrder: DemoScenario[] = [
  'payment_success',
  'payment_processing',
  'payment_pending',
  'payment_failed',
  'duplicate_webhook',
  'amount_mismatch',
  'missing_order',
  'settlement_pending',
  'settlement_confirmed',
  'refund',
];

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function DemoLabPage() {
  const { data: meta } = useMeta();
  const status = useDemoStatus();
  const runScenario = useDemoScenario();
  const resetDemo = useResetDemo();
  const { toast } = useToast();
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [resetInput, setResetInput] = useState('');
  const [resetOpen, setResetOpen] = useState(false);

  const scenarios = useMemo(
    () => scenarioOrder.filter((scenario) => !status.data || status.data.scenarios.includes(scenario)),
    [status.data],
  );
  const pending = status.data?.pendingSettlements;
  const disabled = meta ? !meta.demoMode : status.data ? !status.data.enabled : false;

  function run(scenario: DemoScenario) {
    setResult(null);
    runScenario.mutate(
      { scenario },
      {
        onSuccess: (data) => {
          setResult(data);
          toast({
            title: `${scenarioMeta[scenario].label} recorded`,
            description: 'Demo-only records were created and reconciled.',
            tone: 'success',
          });
        },
        onError: (error) => {
          toast({
            title: 'Scenario could not run',
            description: errorMessage(error),
            tone: 'danger',
          });
        },
      },
    );
  }

  function confirmReset() {
    resetDemo.mutate(resetInput, {
      onSuccess: () => {
        setResetOpen(false);
        setResetInput('');
        setResult(null);
        toast({
          title: 'Demo dataset reset',
          description: 'Only records tagged environment=demo were removed and reseeded.',
          tone: 'success',
        });
      },
      onError: (error) => {
        toast({
          title: 'Reset failed',
          description: errorMessage(error),
          tone: 'danger',
        });
      },
    });
  }

  if (status.isPending) {
    return (
      <div className="space-y-5">
        <PageHeader title="Demo lab" description="Loading demo controls…" />
        <Skeleton className="h-24 w-full rounded-card" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-36 w-full rounded-card" />
          ))}
        </div>
      </div>
    );
  }

  if (status.isError) {
    return (
      <div className="space-y-5">
        <PageHeader title="Demo lab" />
        <Card>
          <ErrorState
            message={errorMessage(status.error)}
            onRetry={() => void status.refetch()}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Demo lab"
        eyebrow={
          <Badge tone={disabled ? 'neutral' : 'warning'} dot>
            {disabled ? 'Demo disabled' : 'Simulated data only'}
          </Badge>
        }
        description="Run deterministic payment scenarios without provider credentials. Every record is tagged source=demo and environment=demo, persists in the configured store, and is excluded from sandbox or live data."
        actions={
          <Button variant="secondary" size="sm" onClick={() => void status.refetch()}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        }
      />

      <Callout tone="warning" title="No real funds move here">
        These scenarios call the same event pipeline and reconciliation engine as production code
        paths, but they publish simulated events. Signatures are labeled SIMULATED, fees are explicit
        fixtures, and no provider API is contacted. A successful demo payment does not imply that a
        real Razorpay integration is configured.
      </Callout>

      {disabled ? (
        <Card>
          <ErrorState
            title="Demo mode is turned off"
            message="Set DEMO_MODE=true in the server environment and restart to use the local demo provider. Sandbox/live data is never replaced by demo records."
          />
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {scenarios.map((scenario) => {
              const item = scenarioMeta[scenario];
              const Icon = item.icon;
              const running =
                runScenario.isPending && runScenario.variables?.scenario === scenario;
              return (
                <Card key={scenario} className="flex flex-col p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                        <h2 className="text-[13px] font-semibold text-ink">{item.label}</h2>
                      </div>
                      <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
                        {item.description}
                      </p>
                    </div>
                    <Badge tone={item.tone}>{scenario.replaceAll('_', ' ')}</Badge>
                  </div>
                  <p className="mt-2.5 rounded-lg bg-surface-sunken px-2.5 py-2 text-[10.5px] leading-relaxed text-ink-soft">
                    <span className="font-semibold">Shows:</span> {item.demonstrates}
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="font-mono text-[9.5px] text-muted-light">{scenario}</span>
                    <Button
                      variant="subtle"
                      size="sm"
                      loading={running}
                      disabled={runScenario.isPending}
                      onClick={() => run(scenario)}
                    >
                      <Zap className="h-3.5 w-3.5" /> Run
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>

          {result ? (
            <Card>
              <CardHeader
                title="Last scenario result"
                description="Returned by the API for this run. A demo scenario is not a provider report."
                action={
                  <Button variant="ghost" size="sm" onClick={() => setResult(null)}>
                    Dismiss
                  </Button>
                }
              />
              <CardBody className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="brand">
                    {stringValue(result.scenario) ?? 'scenario'}
                  </Badge>
                  {numberValue(result.amountMinor) !== null ? (
                    <Badge tone="neutral">
                      {formatMoney(
                        numberValue(result.amountMinor) as number,
                        'INR',
                      )}
                    </Badge>
                  ) : null}
                  {stringValue(result.settlementStatus) ? (
                    <Badge tone="warning">
                      settlement {stringValue(result.settlementStatus)?.toLowerCase()}
                    </Badge>
                  ) : null}
                  {stringValue(result.refundStatus) ? (
                    <Badge tone="info">
                      refund {stringValue(result.refundStatus)?.toLowerCase()}
                    </Badge>
                  ) : null}
                </div>
                <p className="text-[12px] leading-relaxed text-ink-soft">
                  {stringValue(result.message) ?? 'The scenario completed.'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {stringValue(result.transactionRef) ? (
                    <Link
                      to={`/transactions?transaction=${encodeURIComponent(
                        stringValue(result.transactionRef) as string,
                      )}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-brand-100 bg-brand-50 px-2.5 py-1.5 text-[11px] font-semibold text-brand-700 hover:bg-brand-100"
                    >
                      Transaction <ArrowRight className="h-3 w-3" />
                    </Link>
                  ) : null}
                  {stringValue(result.exceptionRef) ? (
                    <Link
                      to={`/reconciliation?exception=${encodeURIComponent(
                        stringValue(result.exceptionRef) as string,
                      )}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-danger-100 bg-danger-50 px-2.5 py-1.5 text-[11px] font-semibold text-danger-700 hover:bg-danger-100"
                    >
                      Exception <ArrowRight className="h-3 w-3" />
                    </Link>
                  ) : null}
                  {stringValue(result.settlementRef) ? (
                    <Link
                      to={`/settlements?settlement=${encodeURIComponent(
                        stringValue(result.settlementRef) as string,
                      )}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[11px] font-semibold text-ink-soft hover:bg-surface-sunken"
                    >
                      Settlement <ArrowRight className="h-3 w-3" />
                    </Link>
                  ) : null}
                  {stringValue(result.refundRef) ? (
                    <Link
                      to={`/refunds?refund=${encodeURIComponent(
                        stringValue(result.refundRef) as string,
                      )}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[11px] font-semibold text-ink-soft hover:bg-surface-sunken"
                    >
                      Refund <ArrowRight className="h-3 w-3" />
                    </Link>
                  ) : null}
                  {stringValue(result.eventKey) ? (
                    <Link
                      to={`/events?event=${encodeURIComponent(
                        stringValue(result.eventKey) as string,
                      )}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[11px] font-semibold text-ink-soft hover:bg-surface-sunken"
                    >
                      Event <ArrowRight className="h-3 w-3" />
                    </Link>
                  ) : null}
                </div>
                {stringValue(result.refundRef) ? (
                  <Callout tone="info" title="Advance the refund explicitly">
                    The refund was only requested. Open it from the Refunds page to advance the
                    simulated lifecycle; completion is never inferred.
                  </Callout>
                ) : null}
                <details className="rounded-lg border border-line bg-surface-sunken p-3">
                  <summary className="cursor-pointer text-[11px] font-semibold text-ink-soft">
                    Raw scenario response
                  </summary>
                  <pre className="scrollbar-thin mt-2 max-h-64 overflow-auto font-mono text-[10px] leading-relaxed text-ink-soft">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </details>
              </CardBody>
            </Card>
          ) : null}

          <div className="grid gap-3 lg:grid-cols-2">
            <Card>
              <CardHeader
                title="Pending demo settlements"
                description="Recorded batches that have not been confirmed. Captured payments are not counted as settled."
                action={<Wallet className="h-4 w-4 text-muted" aria-hidden />}
              />
              <CardBody>
                {!pending || pending.count === 0 ? (
                  <p className="text-[11px] text-muted">
                    No pending demo settlements. Run “Settlement pending” to create one, then
                    “Settlement confirmed” to advance it.
                  </p>
                ) : (
                  <ul className="divide-y divide-line rounded-lg border border-line">
                    {pending.settlements.map((settlement) => (
                      <li key={settlement.settlementRef}>
                        <Link
                          to={`/settlements?settlement=${encodeURIComponent(
                            settlement.settlementRef,
                          )}`}
                          className="flex items-center justify-between gap-3 px-3 py-2.5 transition hover:bg-surface-sunken"
                        >
                          <span className="font-mono text-[10.5px] text-brand-700">
                            {settlement.settlementRef}
                          </span>
                          <span className="text-[11px] font-semibold text-ink tabular">
                            {formatMoney(settlement.grossMinor, settlement.currency)}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>

            <Card className="border-danger-100">
              <CardHeader
                title="Reset demo data"
                description="Deletes only demo-tagged records, then reseeds the demonstration dataset."
                action={<RotateCcw className="h-4 w-4 text-danger-600" aria-hidden />}
              />
              <CardBody className="space-y-3">
                <Callout tone="danger" title="Demo isolation is enforced">
                  Reset removes documents with environment=demo only. It does not delete sandbox or
                  live records, and it cannot run when demo mode is disabled.
                </Callout>
                <div>
                  <Label htmlFor="reset-confirmation" hint={`Type: ${RESET_PHRASE}`}>
                    Confirmation phrase
                  </Label>
                  <Input
                    id="reset-confirmation"
                    value={resetInput}
                    onChange={(event) => setResetInput(event.target.value)}
                    placeholder={RESET_PHRASE}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  disabled={resetInput !== RESET_PHRASE}
                  onClick={() => setResetOpen(true)}
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Reset demo dataset
                </Button>
              </CardBody>
            </Card>
          </div>

          <Card>
            <CardHeader
              title="What demo mode does and does not prove"
              description="This is a local prototype. The demo path is real code; the provider integration is separate."
            />
            <CardBody className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-success-100 bg-success-50 p-3">
                <p className="text-[11px] font-semibold text-success-700">Exercised end to end</p>
                <p className="mt-1 text-[10.5px] leading-relaxed text-success-700/90">
                  Event idempotency, payment state, reconciliation rules, exceptions, settlements,
                  refunds, audits and realtime updates.
                </p>
              </div>
              <div className="rounded-lg border border-warning-100 bg-warning-50 p-3">
                <p className="text-[11px] font-semibold text-warning-700">Clearly simulated</p>
                <p className="mt-1 text-[10.5px] leading-relaxed text-warning-700/90">
                  Provider events, signatures, fees, settlement confirmation and refund progress.
                </p>
              </div>
              <div className="rounded-lg border border-danger-100 bg-danger-50 p-3">
                <p className="text-[11px] font-semibold text-danger-700">Not proven by demo mode</p>
                <p className="mt-1 text-[10.5px] leading-relaxed text-danger-700/90">
                  Razorpay credentials, live webhook delivery, bank settlement, authentication,
                  authorization or production readiness.
                </p>
              </div>
            </CardBody>
          </Card>
        </>
      )}

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Reset the demo dataset?"
        description={`This deletes demo-tagged records and reseeds fixtures. The exact phrase "${RESET_PHRASE}" has been supplied.`}
        confirmLabel="Reset demo data"
        tone="danger"
        loading={resetDemo.isPending}
        confirmDisabled={resetInput !== RESET_PHRASE}
        onConfirm={confirmReset}
      >
        <div className="flex items-start gap-2 rounded-lg border border-warning-100 bg-warning-50 p-3 text-[11px] leading-relaxed text-warning-700">
          <FlaskConical className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          Records from sandbox or live environments are never touched.
        </div>
      </ConfirmDialog>
    </div>
  );
}
