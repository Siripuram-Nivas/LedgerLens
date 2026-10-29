import type { Environment, Payment, ReconciliationException } from '../domain/types';
import { formatMinor } from '../domain/money';
import type { LedgerRepository, PaymentListQuery } from '../repositories/ledgerRepository';
import { notFound } from '../utils/http';

const FORBIDDEN_METADATA = /card|cvv|email|phone|contact|token|secret|auth|iban|account|address/i;

export function sanitizeMetadata(metadata: Record<string, unknown>): {
  values: Record<string, string | number | boolean>;
  redactedFields: string[];
} {
  const values: Record<string, string | number | boolean> = {};
  const redactedFields: string[] = [];
  for (const [key, value] of Object.entries(metadata)) {
    if (FORBIDDEN_METADATA.test(key)) {
      redactedFields.push(key);
      continue;
    }
    if (typeof value === 'string') values[key] = value.slice(0, 200);
    else if (typeof value === 'number' || typeof value === 'boolean') values[key] = value;
    else redactedFields.push(key);
  }
  return { values, redactedFields };
}

function differenceLabel(payment: Payment, orderAmount: number | undefined): string | null {
  if (orderAmount === undefined) return null;
  const difference = Math.abs(payment.amountMinor - orderAmount);
  if (difference === 0) return null;
  const direction = payment.amountMinor > orderAmount ? 'above' : 'below';
  return `${formatMinor(difference, payment.currency)} ${direction} the order total`;
}

export class TransactionService {
  constructor(private readonly repo: LedgerRepository) {}

  async list(query: PaymentListQuery, environment: Environment) {
    const page = await this.repo.listPayments(query, environment);
    return {
      ...page,
      totalPages: page.totalPages,
    };
  }

  async detail(reference: string, environment: Environment) {
    const payment = await this.repo.getPayment(reference);
    if (!payment || payment.environment !== environment) {
      throw notFound('Transaction', reference);
    }

    const [order, events, exceptions, refunds, settlements, relatedPayments] = await Promise.all([
      payment.orderRef ? this.repo.getOrder(payment.orderRef) : Promise.resolve(null),
      this.repo.eventsForPayment(payment.transactionRef),
      this.repo.exceptionsForPayment(payment.transactionRef),
      this.repo.refundsForPayment(payment.providerPaymentId),
      this.repo.settlementsForPayment(payment.providerPaymentId),
      payment.orderRef
        ? this.repo.listPaymentsByOrderRef(payment.orderRef)
        : Promise.resolve([payment]),
    ]);

    const metadata = sanitizeMetadata(payment.metadata as Record<string, unknown>);
    const activeException = exceptions.find((exception) => exception.status !== 'RESOLVED') ?? null;
    const insights = this.buildInsights(payment, order?.amountMinor, activeException, settlements);

    return {
      payment,
      order,
      orderComparison: order
        ? {
            expectedAmountMinor: order.amountMinor,
            observedAmountMinor: payment.amountMinor,
            differenceMinor: Math.abs(payment.amountMinor - order.amountMinor),
            expectedCurrency: order.currency,
            observedCurrency: payment.currency,
            amountMatched: payment.amountMinor === order.amountMinor,
            currencyMatched: payment.currency === order.currency,
            summary: differenceLabel(payment, order.amountMinor),
          }
        : null,
      events: events.map((event) => ({
        eventKey: event.eventKey,
        type: event.type,
        receivedAt: event.receivedAt,
        providerCreatedAt: event.providerCreatedAt,
        processingStatus: event.processingStatus,
        signatureStatus: event.signatureStatus,
        duplicateDeliveryCount: event.duplicateDeliveryCount,
        applied: event.applied,
        processingNote: event.processingNote,
        provider: event.provider,
      })),
      exceptions,
      refunds,
      settlements,
      relatedPayments: relatedPayments.map((attempt) => ({
        transactionRef: attempt.transactionRef,
        status: attempt.status,
        amountMinor: attempt.amountMinor,
        currency: attempt.currency,
        attempt: attempt.attempt,
        createdAt: attempt.createdAt,
      })),
      metadata: metadata.values,
      metadataRedacted: metadata.redactedFields,
      insights,
    };
  }

  private buildInsights(
    payment: Payment,
    orderAmount: number | undefined,
    exception: ReconciliationException | null,
    settlements: Array<{ status: string; settlementRef: string; settledAt: string | null }>,
  ) {
    const insights: Array<{
      kind: string;
      severity: 'success' | 'info' | 'warning' | 'critical';
      title: string;
      detail: string;
      action?: string;
    }> = [];

    if (exception) {
      insights.push({
        kind: exception.type,
        severity: exception.severity === 'HIGH' ? 'critical' : 'warning',
        title: `${exception.type.replaceAll('_', ' ')} — ${exception.status}`,
        detail: exception.explanation,
        action: exception.suggestedAction,
      });
    }

    if (orderAmount !== undefined && payment.amountMinor !== orderAmount) {
      insights.push({
        kind: 'AMOUNT_DIFFERENCE',
        severity: 'warning',
        title: 'Payment amount differs from the order total',
        detail: `Expected ${formatMinor(orderAmount, payment.currency)}; observed ${formatMinor(payment.amountMinor, payment.currency)}.`,
        action: 'Open the reconciliation exception and compare the provider payment record.',
      });
    }

    if (payment.status === 'PAID') {
      if (payment.settlementStatus === 'PENDING') {
        insights.push({
          kind: 'SETTLEMENT_PENDING',
          severity: 'info',
          title: 'Payment captured, settlement pending',
          detail:
            'Capture is confirmed. The merchant has not been recorded as settled, so funds should not be treated as received.',
          action: 'Check the settlement batch and expected timeline.',
        });
      } else if (payment.settlementStatus === 'NOT_STARTED') {
        insights.push({
          kind: 'SETTLEMENT_NOT_STARTED',
          severity: 'info',
          title: 'No settlement record yet',
          detail:
            'The payment is captured, but no settlement batch references it. Success does not imply settlement.',
          action: 'Wait for a trusted provider settlement event or create a demo settlement to test the flow.',
        });
      } else if (payment.settlementStatus === 'FAILED') {
        insights.push({
          kind: 'SETTLEMENT_FAILED',
          severity: 'critical',
          title: 'Settlement failed',
          detail: settlements[0]
            ? `Settlement ${settlements[0].settlementRef} is marked failed. The payment itself remains captured.`
            : 'A settlement failure was recorded. The payment itself remains captured.',
          action: 'Review the settlement record and provider settlement report.',
        });
      } else if (payment.settlementStatus === 'SETTLED') {
        insights.push({
          kind: 'SETTLED',
          severity: 'success',
          title: 'Settlement confirmed',
          detail: settlements[0]
            ? `Settlement ${settlements[0].settlementRef} is recorded as settled.`
            : 'A settlement confirmation is recorded for this payment.',
        });
      }
    }

    if (payment.refundStatus === 'REQUESTED' || payment.refundStatus === 'PROCESSING') {
      insights.push({
        kind: 'REFUND_IN_PROGRESS',
        severity: 'info',
        title: 'Refund not complete',
        detail:
          'A refund request is recorded but the refund is not complete. The payment remains captured.',
        action: 'Track the refund timeline; do not reduce captured revenue yet.',
      });
    }

    if (payment.status === 'FAILED') {
      insights.push({
        kind: 'PAYMENT_FAILED',
        severity: 'warning',
        title: 'Payment failed',
        detail: 'No captured funds are associated with this attempt.',
      });
    }

    if (!exception && payment.status === 'PAID' && payment.reconciliationStatus === 'MATCHED') {
      insights.push({
        kind: 'MATCHED',
        severity: 'success',
        title: 'Order and payment match',
        detail: 'The captured amount and currency match the linked order.',
      });
    }

    return insights;
  }
}
