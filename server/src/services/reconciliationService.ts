import type {
  Environment,
  ExceptionEvidence,
  ExceptionType,
  Order,
  Payment,
  ReconciliationException,
  ReconciliationRun,
  ReconciliationStatus,
  Source,
} from '../domain/types';
import { formatMinor } from '../domain/money';
import type { LedgerRepository } from '../repositories/ledgerRepository';
import type { Logger } from '../logger';
import type { RealtimeBus } from '../realtime/bus';
import { nowIso } from '../utils/dates';

interface ExceptionDraft {
  fingerprint: string;
  type: ExceptionType;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  payment: Payment | null;
  order: Order | null;
  expectedAmountMinor: number | null;
  observedAmountMinor: number | null;
  differenceMinor: number | null;
  expectedCurrency: string | null;
  observedCurrency: string | null;
  evidence: ExceptionEvidence;
  explanation: string;
  suggestedAction: string;
}

export interface ReconciliationScope {
  type: 'all' | 'payment';
  transactionRef?: string;
}

export interface ReconciliationResult {
  run: ReconciliationRun;
  statuses: Record<string, number>;
  openExceptionCount: number;
}

function statusFromPayment(payment: Payment): ReconciliationStatus {
  if (payment.status === 'FAILED' || payment.status === 'CANCELLED') return 'NOT_APPLICABLE';
  if (payment.status === 'PENDING' || payment.status === 'PROCESSING') {
    return 'PENDING_RECONCILIATION';
  }
  return 'MATCHED';
}

export class ReconciliationService {
  constructor(
    private readonly repo: LedgerRepository,
    private readonly logger: Logger,
    private readonly bus: RealtimeBus,
  ) {}

  async run(options: {
    environment: Environment;
    triggeredBy: string;
    scope?: ReconciliationScope;
  }): Promise<ReconciliationResult> {
    const scope = options.scope ?? { type: 'all' };
    const scopeLabel = scope.type === 'all' ? 'all' : `payment:${scope.transactionRef}`;
    const run = await this.repo.createRun({
      environment: options.environment,
      scope: scopeLabel,
      status: 'RUNNING',
      triggeredBy: options.triggeredBy,
      startedAt: nowIso(),
      finishedAt: null,
      counts: {
        paymentsEvaluated: 0,
        ordersEvaluated: 0,
        matched: 0,
        pending: 0,
        notApplicable: 0,
        exceptionsCreated: 0,
        exceptionsUpdated: 0,
        exceptionsAutoResolved: 0,
        duplicateEventsDetected: 0,
      },
      error: null,
    });

    try {
      const { payments, orders } = await this.loadScope(options.environment, scope);
      const now = nowIso();
      const statusUpdates = new Map<string, ReconciliationStatus>();
      const drafts = new Map<string, ExceptionDraft>();
      const evaluatedTransactionRefs = new Set<string>();
      const evaluatedOrderRefs = new Set<string>();

      for (const payment of payments) evaluatedTransactionRefs.add(payment.transactionRef);
      for (const order of orders) evaluatedOrderRefs.add(order.orderRef);

      const ordersByRef = new Map(orders.map((order) => [order.orderRef, order]));
      const paymentsByOrder = new Map<string, Payment[]>();
      for (const payment of payments) {
        if (!payment.orderRef) continue;
        const list = paymentsByOrder.get(payment.orderRef) ?? [];
        list.push(payment);
        paymentsByOrder.set(payment.orderRef, list);
      }

      // Every payment receives a dimension value, independently of settlement.
      for (const payment of payments) {
        if (payment.status === 'FAILED' || payment.status === 'CANCELLED') {
          statusUpdates.set(payment.id, 'NOT_APPLICABLE');
          continue;
        }
        const order = payment.orderRef ? ordersByRef.get(payment.orderRef) : null;
        if (!order) {
          statusUpdates.set(payment.id, 'MISSING_ORDER');
          this.addDraft(drafts, {
            fingerprint: `${options.environment}:MISSING_ORDER:${payment.providerPaymentId}`,
            type: 'MISSING_ORDER',
            severity: 'HIGH',
            payment,
            order: null,
            expectedAmountMinor: null,
            observedAmountMinor: payment.amountMinor,
            differenceMinor: null,
            expectedCurrency: null,
            observedCurrency: payment.currency,
            evidence: {
              order: null,
              payment: {
                transactionRef: payment.transactionRef,
                providerPaymentId: payment.providerPaymentId,
                amountMinor: payment.amountMinor,
                currency: payment.currency,
                status: payment.status,
                orderRef: payment.orderRef,
              },
            },
            explanation: `Payment ${formatMinor(payment.amountMinor, payment.currency)} has no matching order record.`,
            suggestedAction:
              'Search the order reference and provider payment metadata, then import or relink the missing order.',
          });
          continue;
        }
        if (payment.status === 'PAID') {
          // Captured payments are evaluated at order level so split captures
          // and multiple attempts are compared together.
          continue;
        }
        statusUpdates.set(payment.id, 'PENDING_RECONCILIATION');
      }

      for (const order of orders) {
        const orderPayments = paymentsByOrder.get(order.orderRef) ?? [];
        if (orderPayments.length === 0) {
          this.addDraft(drafts, {
            fingerprint: `${options.environment}:MISSING_PAYMENT:${order.orderRef}`,
            type: 'MISSING_PAYMENT',
            severity: 'MEDIUM',
            payment: null,
            order,
            expectedAmountMinor: order.amountMinor,
            observedAmountMinor: null,
            differenceMinor: null,
            expectedCurrency: order.currency,
            observedCurrency: null,
            evidence: {
              order: {
                orderRef: order.orderRef,
                amountMinor: order.amountMinor,
                currency: order.currency,
                customerRef: order.customerRef,
              },
              payment: null,
            },
            explanation: `Order ${order.orderRef} expects ${formatMinor(order.amountMinor, order.currency)} but has no payment attempt.`,
            suggestedAction:
              'Verify whether the customer abandoned checkout or the provider payment record failed to arrive.',
          });
          continue;
        }

        const paid = orderPayments.filter((payment) => payment.status === 'PAID');
        if (paid.length === 0) continue;

        const mismatchedCurrency = paid.find((payment) => payment.currency !== order.currency);
        if (mismatchedCurrency) {
          for (const payment of paid) statusUpdates.set(payment.id, 'CURRENCY_MISMATCH');
          this.addDraft(drafts, {
            fingerprint: `${options.environment}:CURRENCY_MISMATCH:${order.orderRef}`,
            type: 'CURRENCY_MISMATCH',
            severity: 'HIGH',
            payment: mismatchedCurrency,
            order,
            expectedAmountMinor: order.amountMinor,
            observedAmountMinor: mismatchedCurrency.amountMinor,
            differenceMinor: null,
            expectedCurrency: order.currency,
            observedCurrency: mismatchedCurrency.currency,
            evidence: {
              order: {
                orderRef: order.orderRef,
                amountMinor: order.amountMinor,
                currency: order.currency,
                customerRef: order.customerRef,
              },
              payment: {
                transactionRef: mismatchedCurrency.transactionRef,
                providerPaymentId: mismatchedCurrency.providerPaymentId,
                amountMinor: mismatchedCurrency.amountMinor,
                currency: mismatchedCurrency.currency,
                status: mismatchedCurrency.status,
                orderRef: mismatchedCurrency.orderRef,
              },
              relatedPayments: paid.map((payment) => ({
                transactionRef: payment.transactionRef,
                amountMinor: payment.amountMinor,
                currency: payment.currency,
                status: payment.status,
                createdAt: payment.createdAt,
              })),
            },
            explanation: `Order ${order.orderRef} is denominated in ${order.currency}, but the captured payment is in ${mismatchedCurrency.currency}. Amounts are not comparable until currency is resolved.`,
            suggestedAction:
              'Confirm the order currency with the merchant and check whether the provider captured the payment under the wrong currency.',
          });
          continue;
        }

        const observedTotal = paid.reduce((total, payment) => total + payment.amountMinor, 0);
        const expectedTotal = order.amountMinor;
        const difference = Math.abs(observedTotal - expectedTotal);
        const representative = paid[0];

        if (observedTotal > expectedTotal) {
          const duplicatePayment = paid.length > 1;
          const type: ExceptionType = duplicatePayment ? 'DUPLICATE_PAYMENT' : 'AMOUNT_MISMATCH';
          for (const payment of paid) statusUpdates.set(payment.id, type);
          this.addDraft(drafts, {
            fingerprint: `${options.environment}:${type}:${order.orderRef}`,
            type,
            severity: 'HIGH',
            payment: representative,
            order,
            expectedAmountMinor: expectedTotal,
            observedAmountMinor: observedTotal,
            differenceMinor: difference,
            expectedCurrency: order.currency,
            observedCurrency: paid[0].currency,
            evidence: {
              order: {
                orderRef: order.orderRef,
                amountMinor: order.amountMinor,
                currency: order.currency,
                customerRef: order.customerRef,
              },
              payment: {
                transactionRef: representative.transactionRef,
                providerPaymentId: representative.providerPaymentId,
                amountMinor: representative.amountMinor,
                currency: representative.currency,
                status: representative.status,
                orderRef: representative.orderRef,
              },
              relatedPayments: paid.map((payment) => ({
                transactionRef: payment.transactionRef,
                amountMinor: payment.amountMinor,
                currency: payment.currency,
                status: payment.status,
                createdAt: payment.createdAt,
              })),
            },
            explanation: duplicatePayment
              ? `${paid.length} captured payments total ${formatMinor(observedTotal, order.currency)}, over the order total of ${formatMinor(expectedTotal, order.currency)} by ${formatMinor(difference, order.currency)}.`
              : `Captured payment ${formatMinor(observedTotal, order.currency)} exceeds the order total of ${formatMinor(expectedTotal, order.currency)} by ${formatMinor(difference, order.currency)}.`,
            suggestedAction: duplicatePayment
              ? 'Compare provider payment IDs and capture timestamps. Refund any genuinely duplicated capture after verification.'
              : 'Compare the order record with provider payment details and adjust or refund the excess after verification.',
          });
          continue;
        }

        if (observedTotal < expectedTotal) {
          for (const payment of paid) statusUpdates.set(payment.id, 'AMOUNT_MISMATCH');
          this.addDraft(drafts, {
            fingerprint: `${options.environment}:AMOUNT_MISMATCH:${order.orderRef}`,
            type: 'AMOUNT_MISMATCH',
            severity: 'HIGH',
            payment: representative,
            order,
            expectedAmountMinor: expectedTotal,
            observedAmountMinor: observedTotal,
            differenceMinor: difference,
            expectedCurrency: order.currency,
            observedCurrency: paid[0].currency,
            evidence: {
              order: {
                orderRef: order.orderRef,
                amountMinor: order.amountMinor,
                currency: order.currency,
                customerRef: order.customerRef,
              },
              payment: {
                transactionRef: representative.transactionRef,
                providerPaymentId: representative.providerPaymentId,
                amountMinor: representative.amountMinor,
                currency: representative.currency,
                status: representative.status,
                orderRef: representative.orderRef,
              },
              relatedPayments: paid.map((payment) => ({
                transactionRef: payment.transactionRef,
                amountMinor: payment.amountMinor,
                currency: payment.currency,
                status: payment.status,
                createdAt: payment.createdAt,
              })),
            },
            explanation: `Captured ${formatMinor(observedTotal, order.currency)} against an order total of ${formatMinor(expectedTotal, order.currency)} — a shortfall of ${formatMinor(difference, order.currency)}.`,
            suggestedAction:
              'Check whether a partial capture, discount, or additional payment attempt explains the shortfall.',
          });
          continue;
        }

        for (const payment of paid) statusUpdates.set(payment.id, 'MATCHED');

        // Distinct canonical capture events for one payment are different from
        // repeated deliveries of the same event key and warrant review.
        for (const payment of paid) {
          const events = await this.repo.eventsForPayment(payment.transactionRef);
          const captureKeys = [
            ...new Set(
              events
                .filter(
                  (event) =>
                    event.type === 'payment.captured' &&
                    event.processingStatus === 'PROCESSED' &&
                    event.applied,
                )
                .map((event) => event.eventKey),
            ),
          ];
          if (captureKeys.length > 1) {
            statusUpdates.set(payment.id, 'DUPLICATE_EVENT');
            this.addDraft(drafts, {
              fingerprint: `${options.environment}:DUPLICATE_EVENT:${payment.providerPaymentId}`,
              type: 'DUPLICATE_EVENT',
              severity: 'LOW',
              payment,
              order,
              expectedAmountMinor: null,
              observedAmountMinor: null,
              differenceMinor: null,
              expectedCurrency: payment.currency,
              observedCurrency: payment.currency,
              evidence: {
                order: {
                  orderRef: order.orderRef,
                  amountMinor: order.amountMinor,
                  currency: order.currency,
                  customerRef: order.customerRef,
                },
                payment: {
                  transactionRef: payment.transactionRef,
                  providerPaymentId: payment.providerPaymentId,
                  amountMinor: payment.amountMinor,
                  currency: payment.currency,
                  status: payment.status,
                  orderRef: payment.orderRef,
                },
                eventKeys: captureKeys,
              },
              explanation: `${captureKeys.length} distinct capture events reference the same provider payment. Repeated delivery of one event ID is handled idempotently, but distinct event IDs require review.`,
              suggestedAction:
                'Inspect both provider events. Keep one financial effect if they describe the same capture; no duplicate amount was applied by LedgerLens.',
            });
          }
        }
      }

      let matched = 0;
      let pending = 0;
      let notApplicable = 0;
      for (const payment of payments) {
        const status = statusUpdates.get(payment.id) ?? statusFromPayment(payment);
        if (status === 'MATCHED') matched += 1;
        if (status === 'PENDING_RECONCILIATION') pending += 1;
        if (status === 'NOT_APPLICABLE') notApplicable += 1;
        if (payment.reconciliationStatus !== status) {
          await this.repo.updatePayment(payment.id, { reconciliationStatus: status });
        }
      }

      const active = await this.repo.listActiveExceptions(options.environment);
      const presentFingerprints = new Set<string>();
      let created = 0;
      let updated = 0;
      for (const draft of drafts.values()) {
        presentFingerprints.add(draft.fingerprint);
        const existing = await this.repo.findExceptionByFingerprint(draft.fingerprint);
        const source: Source =
          draft.payment?.source ?? draft.order?.source ?? (options.environment === 'demo' ? 'demo' : 'razorpay');
        if (!existing) {
          await this.repo.createException({
            fingerprint: draft.fingerprint,
            runId: run.id,
            type: draft.type,
            status: 'OPEN',
            severity: draft.severity,
            paymentRef: draft.payment?.providerPaymentId ?? null,
            transactionRef: draft.payment?.transactionRef ?? null,
            orderRef: draft.order?.orderRef ?? draft.payment?.orderRef ?? null,
            expectedAmountMinor: draft.expectedAmountMinor,
            observedAmountMinor: draft.observedAmountMinor,
            differenceMinor: draft.differenceMinor,
            expectedCurrency: draft.expectedCurrency,
            observedCurrency: draft.observedCurrency,
            evidence: draft.evidence,
            explanation: draft.explanation,
            suggestedAction: draft.suggestedAction,
            assignedTo: null,
            resolutionType: null,
            resolutionNote: null,
            firstDetectedAt: now,
            lastDetectedAt: now,
            timesSeen: 1,
            resolvedAt: null,
            environment: options.environment,
            source,
          });
          created += 1;
        } else if (existing.status !== 'RESOLVED') {
          await this.repo.updateException(existing.id, {
            runId: run.id,
            lastDetectedAt: now,
            timesSeen: existing.timesSeen + 1,
            evidence: draft.evidence,
            explanation: draft.explanation,
            suggestedAction: draft.suggestedAction,
            severity: draft.severity,
            expectedAmountMinor: draft.expectedAmountMinor,
            observedAmountMinor: draft.observedAmountMinor,
            differenceMinor: draft.differenceMinor,
            expectedCurrency: draft.expectedCurrency,
            observedCurrency: draft.observedCurrency,
          });
          updated += 1;
        }
      }

      let autoResolved = 0;
      for (const exception of active) {
        if (presentFingerprints.has(exception.fingerprint)) continue;
        const relevant =
          (exception.transactionRef && evaluatedTransactionRefs.has(exception.transactionRef)) ||
          (exception.orderRef && evaluatedOrderRefs.has(exception.orderRef));
        if (!relevant) continue;
        await this.repo.updateException(exception.id, {
          status: 'RESOLVED',
          resolutionType: 'AUTO_CLEARED',
          resolutionNote: `The discrepancy was no longer present when reconciliation run ${run.runRef} completed.`,
          resolvedAt: now,
          runId: run.id,
        });
        autoResolved += 1;
        this.bus.publish('exception.updated', options.environment, {
          exceptionRef: exception.exceptionRef,
          status: 'RESOLVED',
        });
      }

      const statuses: Record<string, number> = {};
      for (const status of statusUpdates.values()) {
        statuses[status] = (statuses[status] ?? 0) + 1;
      }

      const duplicateEventsDetected = [...drafts.values()].filter(
        (draft) => draft.type === 'DUPLICATE_EVENT',
      ).length;

      const finished = await this.repo.updateRun(run.id, {
        status: 'COMPLETED',
        finishedAt: nowIso(),
        counts: {
          paymentsEvaluated: payments.length,
          ordersEvaluated: orders.length,
          matched,
          pending,
          notApplicable,
          exceptionsCreated: created,
          exceptionsUpdated: updated,
          exceptionsAutoResolved: autoResolved,
          duplicateEventsDetected,
        },
      });

      await this.repo.appendAudit({
        actor: 'system:reconciliation',
        action: 'reconciliation.run',
        entityType: 'reconciliation_run',
        entityId: finished.runRef,
        note: `Run completed for ${payments.length} payments. ${created} exceptions created, ${updated} updated, ${autoResolved} auto-cleared.`,
        metadata: { scope: scopeLabel, counts: finished.counts },
        environment: options.environment,
      });

      const openExceptionCount = await this.repo.countOpenExceptions(options.environment);
      this.bus.publish('reconciliation.completed', options.environment, {
        runRef: finished.runRef,
        scope: scopeLabel,
        counts: finished.counts,
        openExceptionCount,
      });

      return { run: finished, statuses, openExceptionCount };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown reconciliation failure';
      this.logger.error({ err: error, runRef: run.runRef }, 'Reconciliation run failed');
      await this.repo.updateRun(run.id, {
        status: 'FAILED',
        finishedAt: nowIso(),
        error: message.slice(0, 300),
      });
      throw error;
    }
  }

  async runForPayment(
    transactionRef: string,
    environment: Environment,
    triggeredBy: string,
  ): Promise<ReconciliationResult> {
    return this.run({
      environment,
      triggeredBy,
      scope: { type: 'payment', transactionRef },
    });
  }

  private async loadScope(
    environment: Environment,
    scope: ReconciliationScope,
  ): Promise<{ payments: Payment[]; orders: Order[] }> {
    if (scope.type === 'all') {
      const [payments, orders] = await Promise.all([
        this.repo.listPaymentsForEnvironment(environment),
        this.repo.listOrdersForEnvironment(environment),
      ]);
      return { payments, orders };
    }

    if (!scope.transactionRef) throw new Error('Payment-scoped reconciliation requires a transactionRef');
    const payment = await this.repo.getPayment(scope.transactionRef);
    if (!payment) throw new Error(`Payment ${scope.transactionRef} was not found`);
    if (payment.environment !== environment) {
      throw new Error('Payment does not belong to the requested environment');
    }
    let payments = [payment];
    let orders: Order[] = [];
    if (payment.orderRef) {
      const [order, orderPayments] = await Promise.all([
        this.repo.getOrder(payment.orderRef),
        this.repo.listPaymentsByOrderRef(payment.orderRef),
      ]);
      if (order && order.environment === environment) orders = [order];
      payments = orderPayments.filter((candidate) => candidate.environment === environment);
      if (!payments.some((candidate) => candidate.id === payment.id)) payments.push(payment);
    }
    return { payments, orders };
  }

  private addDraft(drafts: Map<string, ExceptionDraft>, draft: ExceptionDraft): void {
    if (!drafts.has(draft.fingerprint)) drafts.set(draft.fingerprint, draft);
  }
}

export function exceptionSummary(exception: ReconciliationException) {
  return {
    exceptionRef: exception.exceptionRef,
    type: exception.type,
    status: exception.status,
    severity: exception.severity,
    explanation: exception.explanation,
    suggestedAction: exception.suggestedAction,
    differenceMinor: exception.differenceMinor,
    expectedAmountMinor: exception.expectedAmountMinor,
    observedAmountMinor: exception.observedAmountMinor,
    currency: exception.expectedCurrency ?? exception.observedCurrency,
  };
}
