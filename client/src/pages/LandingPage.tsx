import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  CircleDollarSign,
  FlaskConical,
  GitCompareArrows,
  Layers,
  ScrollText,
  ShieldCheck,
  Split,
  Undo2,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import HeroPage from '../components/ui/hero-page';
import { BrandMark } from '../components/layout/BrandMark';
import { buttonClassName } from '../components/ui/Button';

const dimensions = [
  {
    label: 'Payment',
    question: 'Did the provider capture funds?',
    states: 'PENDING · PROCESSING · PAID · FAILED · CANCELLED',
    icon: CircleDollarSign,
    tone: 'text-success-700 bg-success-50 border-success-100',
  },
  {
    label: 'Settlement',
    question: 'Has a provider batch paid out?',
    states: 'NOT_STARTED · PENDING · SETTLED · FAILED',
    icon: Wallet,
    tone: 'text-warning-700 bg-warning-50 border-warning-100',
  },
  {
    label: 'Reconciliation',
    question: 'Does the payment agree with its order?',
    states: 'MATCHED · UNDER_REVIEW · AMOUNT_MISMATCH',
    icon: ShieldCheck,
    tone: 'text-brand-700 bg-brand-50 border-brand-100',
  },
  {
    label: 'Refund',
    question: 'Was money returned to the customer?',
    states: 'NONE · REQUESTED · PROCESSING · REFUNDED',
    icon: Undo2,
    tone: 'text-info-700 bg-info-50 border-info-100',
  },
];

const capabilities: Array<{
  icon: LucideIcon;
  title: string;
  description: string;
}> = [
  {
    icon: GitCompareArrows,
    title: 'Deterministic reconciliation',
    description:
      'Payments are matched to orders by stable reference. Captured amounts and currencies are compared in integer minor units, and every run stores the evidence it used.',
  },
  {
    icon: Layers,
    title: 'Explainable exceptions',
    description:
      'Amount mismatch, currency mismatch, missing order, missing payment and duplicate events become reviewable exceptions with expected and observed values — not a generic failure badge.',
  },
  {
    icon: ScrollText,
    title: 'Complete event history',
    description:
      'Every provider event and every delivery is retained, including duplicate deliveries and rejected signatures. The financial effect is applied once; the audit trail keeps both.',
  },
  {
    icon: Wallet,
    title: 'Settlement visibility',
    description:
      'Settlement batches record gross, fees and net as their own dimension. A captured payment does not silently become settled, and a batch status does not rewrite capture.',
  },
  {
    icon: Undo2,
    title: 'Refund lifecycle',
    description:
      'Requests, processing, partial refunds, completion and failure are tracked separately from payment status. Nothing infers a refund from a captured payment.',
  },
  {
    icon: FlaskConical,
    title: 'Reproducible demo lab',
    description:
      'Ten deterministic scenarios exercise the real event and reconciliation pipeline. Demo records are tagged, isolated, and resettable with an explicit confirmation phrase.',
  },
];

const workflow = [
  {
    step: '01',
    title: 'Run a scenario',
    description:
      'Trigger a payment success, amount mismatch, duplicate webhook, settlement update or refund request from the demo lab.',
  },
  {
    step: '02',
    title: 'Follow the evidence',
    description:
      'Open the transaction, exception or event record. Compare what the order expected with what the provider actually reported.',
  },
  {
    step: '03',
    title: 'Resolve with a trail',
    description:
      'Assign or resolve an exception without rewriting financial records. Re-runs update active findings instead of duplicating or reopening them.',
  },
];

const footerNav = [
  { label: 'Overview', to: '/overview' },
  { label: 'Transactions', to: '/transactions' },
  { label: 'Reconciliation', to: '/reconciliation' },
  { label: 'Settlements', to: '/settlements' },
  { label: 'Refunds', to: '/refunds' },
  { label: 'Event log', to: '/events' },
  { label: 'Demo lab', to: '/demo' },
  { label: 'Settings', to: '/settings' },
];

export function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-clip">
      <a
        href="#landing-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-xl focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:shadow-float"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 px-3 pt-3 sm:px-5">
        <div className="clay-panel-lifted mx-auto flex h-16 max-w-7xl items-center gap-3 rounded-[1.4rem] px-3 sm:px-5">
          <Link
            to="/"
            className="flex min-w-0 items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            aria-label="LedgerLens landing page"
          >
            <BrandMark className="h-9 w-9" />
            <span className="min-w-0">
              <span className="block text-[15px] font-semibold leading-tight tracking-tight text-ink">
                LedgerLens
              </span>
              <span className="hidden text-[9px] uppercase tracking-[0.16em] text-muted sm:block">
                Payment reconciliation
              </span>
            </span>
          </Link>

          <nav aria-label="Landing sections" className="ml-auto hidden items-center gap-0.5 md:flex">
            <a
              href="#dimensions"
              className="whitespace-nowrap rounded-xl px-2.5 py-2 text-[11.5px] font-semibold text-ink-soft transition hover:bg-white/60 hover:text-ink"
            >
              Status model
            </a>
            <a
              href="#capabilities"
              className="whitespace-nowrap rounded-xl px-2.5 py-2 text-[11.5px] font-semibold text-ink-soft transition hover:bg-white/60 hover:text-ink"
            >
              Capabilities
            </a>
            <a
              href="#workflow"
              className="whitespace-nowrap rounded-xl px-2.5 py-2 text-[11.5px] font-semibold text-ink-soft transition hover:bg-white/60 hover:text-ink"
            >
              How it works
            </a>
            <a
              href="#demo"
              className="whitespace-nowrap rounded-xl px-2.5 py-2 text-[11.5px] font-semibold text-ink-soft transition hover:bg-white/60 hover:text-ink"
            >
              Demo lab
            </a>
          </nav>

          <div className="ml-auto flex items-center gap-2 md:ml-3">
            <Link
              to="/overview"
              className={buttonClassName({
                variant: 'primary',
                size: 'sm',
                className: 'whitespace-nowrap',
              })}
            >
              Open dashboard
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
        </div>
      </header>

      <main id="landing-main">
        <HeroPage />

        <section
          id="dimensions"
          aria-labelledby="dimensions-heading"
          className="scroll-mt-24 px-4 pb-16 sm:px-6 sm:pb-24"
        >
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-700">
                Operating model
              </p>
              <h2
                id="dimensions-heading"
                className="mt-3 text-balance text-3xl font-semibold tracking-[-0.04em] text-ink sm:text-4xl"
              >
                Four questions, answered independently.
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-pretty text-[14px] leading-7 text-muted">
                A payment can be captured while settlement is still pending and reconciliation is
                under review. LedgerLens keeps each dimension on its own evidence instead of
                collapsing everything into one status.
              </p>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {dimensions.map((dimension) => (
                <article
                  key={dimension.label}
                  className="clay-panel rounded-card p-5 transition-shadow duration-200 hover:shadow-float"
                >
                  <div
                    className={`clay-pill flex h-10 w-10 items-center justify-center rounded-2xl border ${dimension.tone}`}
                  >
                    <dimension.icon className="h-4 w-4" aria-hidden />
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-ink">{dimension.label}</h3>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
                    {dimension.question}
                  </p>
                  <p className="mt-4 border-t border-white/70 pt-3 font-mono text-[10px] leading-relaxed text-muted-light">
                    {dimension.states}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          id="capabilities"
          aria-labelledby="capabilities-heading"
          className="scroll-mt-24 px-4 pb-16 sm:px-6 sm:pb-24"
        >
          <div className="mx-auto max-w-6xl">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-2xl">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-700">
                  Built into the workspace
                </p>
                <h2
                  id="capabilities-heading"
                  className="mt-3 text-balance text-3xl font-semibold tracking-[-0.04em] text-ink sm:text-4xl"
                >
                  Reconciliation you can inspect.
                </h2>
                <p className="mt-4 text-pretty text-[14px] leading-7 text-muted">
                  These are the workflows implemented in this repository, from provider event
                  ingestion to operator resolution.
                </p>
              </div>
              <Link
                to="/overview"
                className="inline-flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-[12.5px] font-semibold text-brand-700 transition hover:bg-brand-50"
              >
                View the live workspace
                <ArrowUpRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>

            <div className="mt-9 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {capabilities.map((capability) => (
                <article key={capability.title} className="clay-panel rounded-card p-5">
                  <div className="flex items-start gap-3">
                    <div className="clay-pill flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                      <capability.icon className="h-4 w-4" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold tracking-tight text-ink">
                        {capability.title}
                      </h3>
                      <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
                        {capability.description}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          id="workflow"
          aria-labelledby="workflow-heading"
          className="scroll-mt-24 px-4 pb-16 sm:px-6 sm:pb-24"
        >
          <div className="mx-auto max-w-6xl">
            <div className="clay-panel-lifted overflow-hidden rounded-[2rem]">
              <div className="grid gap-8 p-6 sm:p-9 lg:grid-cols-[0.9fr_1.4fr] lg:items-center">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-700">
                    A controlled walkthrough
                  </p>
                  <h2
                    id="workflow-heading"
                    className="mt-3 text-balance text-3xl font-semibold tracking-[-0.04em] text-ink"
                  >
                    From event to resolution, with the evidence intact.
                  </h2>
                  <p className="mt-4 text-pretty text-[13px] leading-relaxed text-muted">
                    The demo pipeline uses the real event, idempotency and reconciliation code
                    paths. It publishes simulated events, so no live provider credentials are
                    required.
                  </p>
                  <Link
                    to="/demo"
                    className={buttonClassName({ variant: 'secondary', className: 'mt-6' })}
                  >
                    <FlaskConical className="h-4 w-4 text-warning-600" aria-hidden />
                    Open the demo lab
                  </Link>
                </div>

                <ol className="space-y-3">
                  {workflow.map((item) => (
                    <li
                      key={item.step}
                      className="clay-inset flex gap-4 rounded-2xl p-4 sm:items-start"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/80 bg-surface font-mono text-[11px] font-semibold text-brand-700 shadow-clay-sm">
                        {item.step}
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-ink">{item.title}</h3>
                        <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
                          {item.description}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </section>

        <section
          id="demo"
          aria-labelledby="demo-heading"
          className="scroll-mt-24 px-4 pb-16 sm:px-6 sm:pb-24"
        >
          <div className="mx-auto max-w-6xl">
            <div className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-[linear-gradient(135deg,#26315c_0%,#3045aa_52%,#277f74_100%)] p-6 text-white shadow-float sm:p-10">
              <div
                aria-hidden
                className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-white/10 blur-2xl"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-teal-400/20 blur-3xl"
              />
              <div className="relative grid gap-8 lg:grid-cols-[1.35fr_0.9fr] lg:items-center">
                <div>
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/85">
                    <FlaskConical className="h-3 w-3" aria-hidden />
                    Demo environment
                  </span>
                  <h2
                    id="demo-heading"
                    className="mt-4 text-balance text-3xl font-semibold tracking-[-0.04em] sm:text-4xl"
                  >
                    Try the reconciliation paths yourself.
                  </h2>
                  <p className="mt-4 max-w-2xl text-pretty text-[13.5px] leading-relaxed text-white/80">
                    Ten deterministic scenarios cover successful capture, mismatches, missing
                    records, duplicate deliveries, settlements and refunds. Reset the demo store at
                    any time with an explicit confirmation.
                  </p>
                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <Link
                      to="/demo"
                      className="clay-pressable inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/70 bg-white px-5 text-sm font-semibold text-brand-900 shadow-[0_14px_28px_-16px_rgb(0_0_0/0.65)] transition hover:-translate-y-0.5"
                    >
                      Launch demo scenarios
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </Link>
                    <Link
                      to="/settings"
                      className="clay-pressable inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/25 bg-white/10 px-5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white/15"
                    >
                      Inspect runtime settings
                    </Link>
                  </div>
                </div>

                <ul className="space-y-2.5 text-[12.5px]">
                  {[
                    'No account or payment credentials required',
                    'Demo-tagged records, isolated from other environments',
                    'Real event, idempotency and reconciliation paths',
                    'Simulated events only — no real funds move',
                  ].map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2.5 rounded-xl border border-white/15 bg-white/[0.07] px-3.5 py-2.5 text-white/85"
                    >
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-200" aria-hidden />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="scope-heading" className="px-4 pb-16 sm:px-6 sm:pb-20">
          <div className="clay-panel mx-auto flex max-w-6xl flex-col gap-4 rounded-card p-5 sm:flex-row sm:items-start sm:p-6">
            <div className="clay-pill flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-surface-sunken text-muted">
              <Split className="h-4 w-4" aria-hidden />
            </div>
            <div>
              <h2 id="scope-heading" className="text-sm font-semibold text-ink">
                Clear scope, by design
              </h2>
              <p className="mt-1.5 max-w-4xl text-pretty text-[12.5px] leading-relaxed text-muted">
                LedgerLens is a local prototype. It has no authentication, no live provider
                credentials, and no bank settlement feed. Settlement and fee values are fixtures.
                Screens show simulated demo records, not production financial data. See the
                repository README for the full limitations.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="px-4 pb-6 sm:px-6">
        <div className="clay-panel mx-auto max-w-7xl rounded-card p-6 sm:p-8">
          <div className="flex flex-col gap-7 lg:flex-row lg:justify-between">
            <div className="max-w-sm">
              <div className="flex items-center gap-2.5">
                <BrandMark className="h-9 w-9" />
                <span>
                  <span className="block text-sm font-semibold leading-tight text-ink">
                    LedgerLens
                  </span>
                  <span className="block text-[9px] uppercase tracking-[0.16em] text-muted">
                    Payment reconciliation
                  </span>
                </span>
              </div>
              <p className="mt-3 text-[12px] leading-relaxed text-muted">
                Captured payments, settlements, reconciliation and refunds kept separate and
                explainable.
              </p>
            </div>

            <nav aria-label="Application views" className="grid grid-cols-2 gap-x-10 gap-y-2 sm:grid-cols-4">
              {footerNav.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="rounded-lg py-1 text-[12px] font-medium text-ink-soft transition hover:text-brand-700"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="mt-7 flex flex-col gap-2 border-t border-white/70 pt-5 text-[10px] text-muted-light sm:flex-row sm:items-center sm:justify-between">
            <span>Local prototype · no authentication · amounts in integer minor units</span>
            <span className="font-mono">demo environment · no real funds</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
