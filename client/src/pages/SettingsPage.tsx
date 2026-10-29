import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  Database,
  FlaskConical,
  Gauge,
  KeyRound,
  Radio,
  RefreshCw,
  ScrollText,
  ServerCog,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { useHealth, useMeta } from '../lib/queries';
import { errorMessage } from '../lib/api';
import { formatDateTime, formatDurationMs } from '../lib/format';
import {
  paymentStatusMeta,
  reconciliationStatusMeta,
  refundStatusMeta,
  settlementStatusMeta,
} from '../lib/status';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge, StatusBadge } from '../components/ui/Badge';
import { Callout } from '../components/ui/Callout';
import { DetailList } from '../components/ui/DetailList';
import { CopyButton } from '../components/ui/CopyButton';
import { Skeleton, SkeletonText } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/States';

export function SettingsPage() {
  const metaQuery = useMeta();
  const healthQuery = useHealth();
  const meta = metaQuery.data;
  const health = healthQuery.data;

  if (metaQuery.isPending) {
    return (
      <div className="space-y-5">
        <PageHeader title="Settings" description="Loading runtime configuration…" />
        <div className="grid gap-3 lg:grid-cols-2">
          <Skeleton className="h-64 w-full rounded-card" />
          <Skeleton className="h-64 w-full rounded-card" />
        </div>
        <SkeletonText lines={6} />
      </div>
    );
  }

  if (metaQuery.isError || !meta) {
    return (
      <div className="space-y-5">
        <PageHeader title="Settings" />
        <Card>
          <ErrorState
            message={errorMessage(metaQuery.error)}
            onRetry={() => void metaQuery.refetch()}
          />
        </Card>
      </div>
    );
  }

  const currencyNote =
    'LedgerLens stores amounts in integer minor units. Aggregates are grouped by currency and never summed across currencies.';

  return (
    <div className="space-y-5">
      <PageHeader
        title="Settings"
        eyebrow={
          <Badge tone={meta.demoMode ? 'warning' : 'neutral'} dot>
            {meta.demoMode ? 'Demo environment' : `${meta.environment} environment`}
          </Badge>
        }
        description="Runtime configuration reported by the API. Values are read-only in this view; change them through environment variables and restart the server."
        actions={
          <Button variant="secondary" size="sm" onClick={() => void healthQuery.refetch()}>
            <RefreshCw
              className={healthQuery.isFetching ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'}
            />
            Refresh health
          </Button>
        }
      />

      <Callout tone="danger" title="No authentication is enabled">
        {meta.accessControlNote}
      </Callout>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Environment"
            description="This instance only serves one environment scope."
            action={<FlaskConical className="h-4 w-4 text-muted" aria-hidden />}
          />
          <CardBody>
            <DetailList
              dense
              items={[
                { label: 'Application', value: `${meta.name} ${meta.version}` },
                { label: 'Tagline', value: meta.tagline },
                {
                  label: 'Environment',
                  value: <Badge tone={meta.demoMode ? 'warning' : 'neutral'}>{meta.environment}</Badge>,
                },
                {
                  label: 'Demo mode',
                  value: meta.demoMode ? 'Enabled (simulated provider)' : 'Disabled',
                },
                { label: 'Payment provider', value: meta.provider, mono: true },
                {
                  label: 'Razorpay environment',
                  value: meta.razorpayEnvironment,
                  mono: true,
                },
                {
                  label: 'Access control',
                  value: (
                    <span className="flex items-center gap-1.5 text-danger-700">
                      <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
                      {meta.accessControl === 'none' ? 'None' : meta.accessControl}
                    </span>
                  ),
                },
              ]}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Persistence"
            description="The configured store is reported explicitly; there is no silent fallback."
            action={<Database className="h-4 w-4 text-muted" aria-hidden />}
          />
          <CardBody className="space-y-3">
            <DetailList
              dense
              items={[
                {
                  label: 'Engine',
                  value: (
                    <Badge tone="brand">
                      {meta.persistence === 'sqlite'
                        ? 'SQLite (file-backed)'
                        : 'MongoDB (Mongoose)'}
                    </Badge>
                  ),
                },
                { label: 'Description', value: meta.persistenceLabel },
              ]}
            />
            <p className="text-[11px] leading-relaxed text-muted">
              SQLite keeps data in a local file, so demo and operator changes survive a server
              restart. It is not an in-memory store. MongoDB is an optional adapter selected through
              <code className="mx-1 font-mono text-ink">PERSISTENCE=mongodb</code>; the server refuses
              to start if that database cannot be reached.
            </p>
            <p className="text-[11px] leading-relaxed text-muted">{currencyNote}</p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Realtime"
            description="Socket.IO carries invalidation signals; the client also polls when disconnected."
            action={<Radio className="h-4 w-4 text-muted" aria-hidden />}
          />
          <CardBody>
            <DetailList
              dense
              items={[
                { label: 'Transport', value: meta.realtime.transport, mono: true },
                { label: 'Namespace', value: meta.realtime.namespace, mono: true },
                { label: 'Path', value: meta.realtime.path, mono: true },
                { label: 'Fallback', value: meta.realtime.fallback },
              ]}
            />
            <p className="mt-3 text-[11px] leading-relaxed text-muted">
              Realtime messages are notifications only. Financial state changes come from
              server-side processing, never from browser events.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Webhook configuration"
            description="The real Razorpay endpoint never skips signature verification."
            action={<KeyRound className="h-4 w-4 text-muted" aria-hidden />}
          />
          <CardBody className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge tone={meta.webhook.providerEnabled ? 'success' : 'neutral'} dot>
                {meta.webhook.providerEnabled ? 'Provider enabled' : 'Provider not enabled'}
              </Badge>
              <Badge tone={meta.webhook.secretConfigured ? 'success' : 'danger'} dot>
                {meta.webhook.secretConfigured ? 'Secret configured' : 'Secret missing'}
              </Badge>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-sunken px-3 py-2">
              <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-ink">
                {meta.webhook.endpoint}
              </span>
              <CopyButton value={meta.webhook.endpoint} label="Copy webhook endpoint" />
            </div>
            <DetailList
              dense
              items={[
                { label: 'Signature', value: meta.webhook.signature },
                { label: 'Idempotency', value: meta.webhook.idempotency },
              ]}
            />
            <p className="text-[11px] leading-relaxed text-muted">{meta.webhook.note}</p>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Status model"
          description="Payment, settlement, reconciliation and refund are independent dimensions. One never implies another."
          action={<ScrollText className="h-4 w-4 text-muted" aria-hidden />}
        />
        <CardBody className="space-y-4">
          {[
            {
              title: 'Payment',
              statuses: meta.statusModel.payment,
              meta: paymentStatusMeta,
            },
            {
              title: 'Settlement',
              statuses: meta.statusModel.settlement,
              meta: settlementStatusMeta,
            },
            {
              title: 'Reconciliation',
              statuses: meta.statusModel.reconciliation,
              meta: reconciliationStatusMeta,
            },
            {
              title: 'Refund',
              statuses: meta.statusModel.refund,
              meta: refundStatusMeta,
            },
          ].map((group) => (
            <div key={group.title}>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                {group.title}
              </p>
              <div className="flex flex-wrap gap-2">
                {group.statuses.map((status) => {
                  const statusMeta = (
                    group.meta as Record<string, { label: string; tone: never; description: string }>
                  )[status];
                  return statusMeta ? (
                    <StatusBadge key={status} meta={statusMeta} />
                  ) : (
                    <Badge key={status}>{status}</Badge>
                  );
                })}
              </div>
            </div>
          ))}
          <p className="rounded-lg bg-surface-sunken p-3 text-[11px] leading-relaxed text-muted">
            {meta.statusModel.note}
          </p>
        </CardBody>
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Reconciliation rules"
            description="Deterministic matching rules applied by the server. Evidence is stored with every exception."
            action={<ShieldCheck className="h-4 w-4 text-muted" aria-hidden />}
          />
          <CardBody>
            <ol className="space-y-2.5">
              {meta.reconciliationRules.map((rule, index) => (
                <li key={rule} className="flex gap-2.5 text-[11.5px] leading-relaxed text-ink-soft">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-50 font-mono text-[9.5px] font-semibold text-brand-700">
                    {index + 1}
                  </span>
                  <span>{rule}</span>
                </li>
              ))}
            </ol>
          </CardBody>
        </Card>

        <div className="space-y-3">
          <Card>
            <CardHeader
              title="API limits"
              description="Applied by request validation, body parsing and rate limiting."
              action={<Gauge className="h-4 w-4 text-muted" aria-hidden />}
            />
            <CardBody>
              <DetailList
                dense
                items={Object.entries(meta.limits).map(([key, value]) => ({
                  label: key.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase()),
                  value: String(value),
                  mono: typeof value === 'number',
                }))}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Runtime health"
              description="Read from the health endpoint. A green status says the API and store respond; it does not certify provider connectivity."
              action={<Activity className="h-4 w-4 text-muted" aria-hidden />}
            />
            <CardBody>
              {healthQuery.isPending ? (
                <SkeletonText lines={4} />
              ) : healthQuery.isError || !health ? (
                <ErrorState
                  title="Health check failed"
                  message={errorMessage(healthQuery.error)}
                  onRetry={() => void healthQuery.refetch()}
                />
              ) : (
                <DetailList
                  dense
                  items={[
                    {
                      label: 'Status',
                      value: (
                        <Badge tone={health.status === 'ok' ? 'success' : 'danger'} dot>
                          {health.status}
                        </Badge>
                      ),
                    },
                    { label: 'Version', value: health.version, mono: true },
                    { label: 'Uptime', value: formatDurationMs(health.uptimeSeconds * 1000) },
                    { label: 'Store latency', value: `${health.dbLatencyMs} ms`, mono: true },
                    { label: 'Persistence', value: health.persistence, mono: true },
                    { label: 'Realtime', value: health.realtime, mono: true },
                    { label: 'Checked at', value: formatDateTime(health.timestamp) },
                  ]}
                />
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader
          title="Useful next steps"
          description="The prototype is intended for local evaluation, not unsupervised production use."
          action={<ServerCog className="h-4 w-4 text-muted" aria-hidden />}
        />
        <CardBody className="grid gap-2 sm:grid-cols-3">
          <Link
            to="/demo"
            className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3 py-2.5 text-[11.5px] font-semibold text-ink-soft transition hover:bg-surface-sunken"
          >
            <span className="flex items-center gap-2">
              <FlaskConical className="h-3.5 w-3.5" /> Demo lab
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-muted" />
          </Link>
          <Link
            to="/events"
            className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3 py-2.5 text-[11.5px] font-semibold text-ink-soft transition hover:bg-surface-sunken"
          >
            <span className="flex items-center gap-2">
              <ScrollText className="h-3.5 w-3.5" /> Event log
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-muted" />
          </Link>
          <Link
            to="/reconciliation"
            className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3 py-2.5 text-[11.5px] font-semibold text-ink-soft transition hover:bg-surface-sunken"
          >
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5" /> Reconciliation
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-muted" />
          </Link>
        </CardBody>
      </Card>

      <p className="px-1 text-[10px] leading-relaxed text-muted">
        Configuration snapshot generated {formatDateTime(meta.timestamp)}. No secrets are exposed by
        this endpoint; only whether a webhook secret is configured.
      </p>
    </div>
  );
}
