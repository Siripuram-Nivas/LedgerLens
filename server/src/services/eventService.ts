import type {
  Environment,
  EventDelivery,
  Payment,
  PaymentEvent,
  PaymentProvider,
  PaymentStatus,
  SignatureStatus,
  Source,
} from '../domain/types';
import type { LedgerRepository } from '../repositories/ledgerRepository';
import type { Logger } from '../logger';
import type { RealtimeBus } from '../realtime/bus';
import type { ReconciliationService } from './reconciliationService';
import { DuplicateKeyError } from '../db/store';
import { ApiError } from '../utils/http';
import { createId, newDeliveryId, newEventKey, newRefundRef } from '../utils/ids';
import { nowIso } from '../utils/dates';

export interface NormalizedLedgerEvent {
  eventKey: string;
  providerEventId: string;
  provider: PaymentProvider;
  type: string;
  providerStatus: string | null;
  paymentRef: string | null;
  orderRef: string | null;
  transactionRef: string | null;
  amountMinor: number | null;
  currency: string | null;
  providerCreatedAt: string | null;
  signatureStatus: SignatureStatus;
  source: Source;
  environment: Environment;
  payloadSummary: Record<string, unknown>;
  customerRef?: string | null;
  method?: string | null;
}

export interface EventProcessResult {
  event: PaymentEvent;
  duplicate: boolean;
  applied: boolean;
  transactionRef: string | null;
  reconciliationRunRef: string | null;
}

const PAYMENT_EVENT_STATUS: Record<string, PaymentStatus> = {
  'payment.pending': 'PENDING',
  'payment.authorized': 'PROCESSING',
  'payment.captured': 'PAID',
  'payment.failed': 'FAILED',
  'payment.cancelled': 'CANCELLED',
};

const REFUND_EVENT_STATUS = {
  'refund.created': 'PROCESSING',
  'refund.processed': 'REFUNDED',
  'refund.failed': 'FAILED',
} as const;

export class EventService {
  constructor(
    private readonly repo: LedgerRepository,
    private readonly logger: Logger,
    private readonly bus: RealtimeBus,
    private readonly reconciliation: ReconciliationService,
  ) {}

  async process(normalized: NormalizedLedgerEvent, receivedAt = nowIso()): Promise<EventProcessResult> {
    this.validate(normalized);

    const existing = await this.repo.findEventByKey(normalized.eventKey);
    if (existing) {
      return this.handleDuplicate(existing, normalized, receivedAt);
    }

    const event: PaymentEvent = {
      id: createId(),
      eventKey: normalized.eventKey,
      provider: normalized.provider,
      providerEventId: normalized.providerEventId,
      type: normalized.type,
      providerStatus: normalized.providerStatus,
      paymentRef: normalized.paymentRef,
      orderRef: normalized.orderRef,
      transactionRef: normalized.transactionRef,
      amountMinor: normalized.amountMinor,
      currency: normalized.currency,
      receivedAt,
      providerCreatedAt: normalized.providerCreatedAt,
      signatureStatus: normalized.signatureStatus,
      processingStatus: 'RECEIVED',
      processingError: null,
      processingNote: null,
      applied: false,
      duplicateDeliveryCount: 0,
      lastDeliveryAt: receivedAt,
      reconciliationTriggered: false,
      source: normalized.source,
      environment: normalized.environment,
      payloadSummary: normalized.payloadSummary,
      createdAt: receivedAt,
      updatedAt: receivedAt,
    };

    try {
      await this.repo.insertEvent(event);
    } catch (error) {
      if (error instanceof DuplicateKeyError) {
        const raced = await this.repo.findEventByKey(normalized.eventKey);
        if (raced) return this.handleDuplicate(raced, normalized, receivedAt);
      }
      throw error;
    }

    await this.recordDelivery(event.eventKey, normalized, receivedAt, 'ACCEPTED', null);

    try {
      const applied = await this.apply(event, normalized);
      let runRef: string | null = null;
      if (applied.transactionRef) {
        try {
          const result = await this.reconciliation.runForPayment(
            applied.transactionRef,
            normalized.environment,
            `event:${normalized.type}`,
          );
          runRef = result.run.runRef;
        } catch (reconcileError) {
          // The event itself is persisted. Reconciliation can be retried safely.
          this.logger.error(
            { err: reconcileError, eventKey: event.eventKey },
            'Post-event reconciliation failed',
          );
        }
      }

      const updated = await this.repo.updateEvent(event.id, {
        processingStatus: 'PROCESSED',
        applied: applied.applied,
        transactionRef: applied.transactionRef ?? event.transactionRef,
        processingNote: applied.note ?? null,
        processingError: null,
        reconciliationTriggered: runRef !== null,
        lastDeliveryAt: receivedAt,
      });
      this.bus.publish('event.processed', normalized.environment, {
        eventKey: updated.eventKey,
        type: updated.type,
        duplicate: false,
        applied: updated.applied,
      });
      if (applied.transactionRef) {
        this.bus.publish('transaction.updated', normalized.environment, {
          transactionRef: applied.transactionRef,
          reason: normalized.type,
        });
      }
      return {
        event: updated,
        duplicate: false,
        applied: applied.applied,
        transactionRef: applied.transactionRef,
        reconciliationRunRef: runRef,
      };
    } catch (error) {
      const safeMessage = this.safeError(error);
      const failed = await this.repo.updateEvent(event.id, {
        processingStatus: 'FAILED',
        processingError: safeMessage,
        processingNote: null,
      });
      await this.recordDelivery(
        event.eventKey,
        normalized,
        receivedAt,
        'INVALID',
        safeMessage,
      );
      this.bus.publish('event.processed', normalized.environment, {
        eventKey: failed.eventKey,
        type: failed.type,
        duplicate: false,
        applied: false,
        error: safeMessage,
      });
      this.logger.warn(
        { eventKey: event.eventKey, err: error },
        'Event processing failed and remains retryable',
      );
      throw new ApiError(422, 'EVENT_PROCESSING_FAILED', 'The event was stored but could not be applied. It can be retried safely.');
    }
  }

  async recordRejectedDelivery(input: {
    eventKey: string | null;
    environment: Environment;
    source: Source;
    signatureStatus: SignatureStatus;
    note: string;
  }): Promise<EventDelivery> {
    const at = nowIso();
    const deliveryId = newDeliveryId();
    const syntheticKey = `rejected:${input.eventKey ?? 'unknown'}:${deliveryId}`;
    await this.repo.insertEvent({
      id: createId(),
      eventKey: syntheticKey,
      provider: 'razorpay',
      providerEventId: input.eventKey ?? 'unknown',
      type: 'webhook.signature_rejected',
      providerStatus: null,
      paymentRef: null,
      orderRef: null,
      transactionRef: null,
      amountMinor: null,
      currency: null,
      receivedAt: at,
      providerCreatedAt: null,
      signatureStatus: 'INVALID',
      processingStatus: 'FAILED',
      processingError: 'Signature verification failed. The payload was not trusted or applied.',
      processingNote: null,
      applied: false,
      duplicateDeliveryCount: 0,
      lastDeliveryAt: at,
      reconciliationTriggered: false,
      source: input.source,
      environment: input.environment,
      payloadSummary: { rejected: true },
      createdAt: at,
      updatedAt: at,
    });
    const delivery: EventDelivery = {
      id: createId(),
      deliveryId,
      eventKey: syntheticKey,
      receivedAt: at,
      outcome: 'REJECTED_SIGNATURE',
      signatureStatus: input.signatureStatus,
      source: input.source,
      environment: input.environment,
      note: input.note.slice(0, 300),
    };
    await this.repo.insertDelivery(delivery);
    this.bus.publish('event.processed', input.environment, {
      eventKey: syntheticKey,
      duplicate: false,
      applied: false,
      rejected: true,
    });
    return delivery;
  }

  private async handleDuplicate(
    existing: PaymentEvent,
    normalized: NormalizedLedgerEvent,
    receivedAt: string,
  ): Promise<EventProcessResult> {
    const deliver = async (outcome: 'DUPLICATE' | 'REPROCESSED', note: string | null) => {
      await this.recordDelivery(existing.eventKey, normalized, receivedAt, outcome, note);
      return this.repo.updateEvent(existing.id, {
        duplicateDeliveryCount: existing.duplicateDeliveryCount + 1,
        lastDeliveryAt: receivedAt,
      });
    };

    if (existing.processingStatus === 'FAILED') {
      const event = await deliver('REPROCESSED', 'Retry of a previously failed delivery.');
      try {
        const applied = await this.apply(event, normalized);
        let runRef: string | null = null;
        if (applied.transactionRef) {
          try {
            const result = await this.reconciliation.runForPayment(
              applied.transactionRef,
              normalized.environment,
              `event-retry:${normalized.type}`,
            );
            runRef = result.run.runRef;
          } catch (reconcileError) {
            this.logger.error(
              { err: reconcileError, eventKey: event.eventKey },
              'Retry reconciliation failed',
            );
          }
        }
        const updated = await this.repo.updateEvent(event.id, {
          processingStatus: 'PROCESSED',
          applied: applied.applied,
          transactionRef: applied.transactionRef ?? event.transactionRef,
          processingError: null,
          processingNote: applied.note ?? null,
          reconciliationTriggered: runRef !== null,
        });
        return {
          event: updated,
          duplicate: true,
          applied: applied.applied,
          transactionRef: applied.transactionRef,
          reconciliationRunRef: runRef,
        };
      } catch (error) {
        const failed = await this.repo.updateEvent(event.id, {
          processingStatus: 'FAILED',
          processingError: this.safeError(error),
        });
        this.bus.publish('event.processed', normalized.environment, {
          eventKey: failed.eventKey,
          type: failed.type,
          duplicate: true,
          applied: false,
        });
        throw new ApiError(
          422,
          'EVENT_PROCESSING_FAILED',
          'The retried event could not be applied. It remains available for another retry.',
        );
      }
    }

    const event = await deliver(
      'DUPLICATE',
      'Duplicate delivery acknowledged. Financial effects were applied only once.',
    );
    this.bus.publish('event.processed', normalized.environment, {
      eventKey: event.eventKey,
      type: event.type,
      duplicate: true,
      applied: false,
    });
    return {
      event,
      duplicate: true,
      applied: false,
      transactionRef: event.transactionRef,
      reconciliationRunRef: null,
    };
  }

  private async apply(
    event: PaymentEvent,
    normalized: NormalizedLedgerEvent,
  ): Promise<{ applied: boolean; transactionRef: string | null; note?: string }> {
    if (event.type in REFUND_EVENT_STATUS) {
      return this.applyRefundEvent(event, normalized);
    }

    const mappedStatus = PAYMENT_EVENT_STATUS[event.type];
    if (!mappedStatus) {
      return {
        applied: false,
        transactionRef: event.transactionRef,
        note: `Event type '${event.type}' is retained for audit but has no modeled financial effect.`,
      };
    }

    let payment: Payment | null = null;
    if (event.transactionRef) {
      payment = await this.repo.getPayment(event.transactionRef);
    }
    if (!payment && event.paymentRef) {
      payment = await this.repo.getPaymentByProviderId(event.provider, event.paymentRef);
    }
    if (!payment && event.provider === 'razorpay' && event.paymentRef && event.amountMinor && event.currency) {
      payment = await this.repo.createPayment({
        orderRef: event.orderRef,
        customerRef: normalized.customerRef ?? 'Provider customer',
        amountMinor: event.amountMinor,
        currency: event.currency,
        status: mappedStatus,
        provider: event.provider,
        providerPaymentId: event.paymentRef,
        method: normalized.method ?? 'unknown',
        source: event.source,
        environment: event.environment,
        createdAt: event.providerCreatedAt ?? event.receivedAt,
      });
      this.logger.info(
        { eventKey: event.eventKey, transactionRef: payment.transactionRef },
        'Created payment from provider webhook',
      );
    }

    if (!payment) {
      return {
        applied: false,
        transactionRef: null,
        note: 'No local payment matched this event. The event is retained for investigation.',
      };
    }

    if (payment.environment !== event.environment) {
      throw new Error('Refusing to apply an event across environments');
    }

    const eventAt = event.providerCreatedAt ?? event.receivedAt;
    if (payment.lastEventAt && Date.parse(eventAt) < Date.parse(payment.lastEventAt)) {
      return {
        applied: false,
        transactionRef: payment.transactionRef,
        note: `Out-of-order event retained for audit. Payment state was last changed at ${payment.lastEventAt}, which is newer than this event.`,
      };
    }

    if (
      payment.status === 'PAID' &&
      ['PENDING', 'PROCESSING', 'FAILED', 'CANCELLED'].includes(mappedStatus)
    ) {
      return {
        applied: false,
        transactionRef: payment.transactionRef,
        note: `Event ignored to prevent a captured payment from regressing to ${mappedStatus}.`,
      };
    }

    const terminalFailure = mappedStatus === 'FAILED' || mappedStatus === 'CANCELLED';
    await this.repo.updatePayment(payment.id, {
      status: mappedStatus,
      lastEventAt: eventAt,
      lastEventKey: event.eventKey,
      reconciliationStatus:
        terminalFailure ? 'NOT_APPLICABLE' : 'PENDING_RECONCILIATION',
      settlementStatus: terminalFailure
        ? 'NOT_APPLICABLE'
        : payment.settlementStatus === 'NOT_APPLICABLE'
          ? 'NOT_STARTED'
          : payment.settlementStatus,
      ...(event.amountMinor !== null ? { amountMinor: event.amountMinor } : {}),
      ...(event.currency !== null ? { currency: event.currency } : {}),
      ...(event.provider === 'razorpay' && normalized.method
        ? { method: normalized.method }
        : {}),
    });

    return { applied: true, transactionRef: payment.transactionRef };
  }

  private async applyRefundEvent(
    event: PaymentEvent,
    normalized: NormalizedLedgerEvent,
  ): Promise<{ applied: boolean; transactionRef: string | null; note?: string }> {
    if (!event.paymentRef) {
      return {
        applied: false,
        transactionRef: null,
        note: 'Refund event has no payment reference.',
      };
    }
    const payment = await this.repo.getPaymentByProviderId(event.provider, event.paymentRef);
    if (!payment) {
      return {
        applied: false,
        transactionRef: null,
        note: 'Refund event does not match a local payment.',
      };
    }
    const refunds = await this.repo.refundsForPayment(event.paymentRef);
    const refundRef =
      typeof normalized.payloadSummary.refundRef === 'string'
        ? normalized.payloadSummary.refundRef
        : null;
    const providerRef =
      typeof normalized.payloadSummary.providerRefundRef === 'string'
        ? normalized.payloadSummary.providerRefundRef
        : null;
    const refund =
      refunds.find((candidate) => candidate.refundRef === refundRef) ??
      refunds.find((candidate) => candidate.providerRefundRef === providerRef) ??
      refunds[0];
    if (!refund) {
      return {
        applied: false,
        transactionRef: payment.transactionRef,
        note: 'Refund event has no local refund record; no refund state was invented.',
      };
    }
    const status = REFUND_EVENT_STATUS[event.type as keyof typeof REFUND_EVENT_STATUS];
    if (refund.status === 'REFUNDED' && status !== 'REFUNDED') {
      return {
        applied: false,
        transactionRef: payment.transactionRef,
        note: 'Completed refunds are terminal; the event was retained without changing state.',
      };
    }
    await this.repo.updateRefund(refund.id, {
      status,
      providerRefundRef: providerRef ?? refund.providerRefundRef,
      timeline: [
        ...refund.timeline,
        {
          at: event.receivedAt,
          status,
          note: `Provider event ${event.type}${event.signatureStatus === 'SIMULATED' ? ' (simulated demo event)' : ''}.`,
        },
      ],
      ...(status === 'FAILED'
        ? { failureReason: 'The provider reported that the refund failed.' }
        : {}),
    });
    await this.repo.refreshPaymentRefundStatus(payment);
    return { applied: true, transactionRef: payment.transactionRef };
  }

  private validate(event: NormalizedLedgerEvent): void {
    if (!event.eventKey || event.eventKey.length > 200) {
      throw new ApiError(400, 'INVALID_EVENT', 'A stable event key is required');
    }
    if (event.amountMinor !== null) {
      if (
        !Number.isSafeInteger(event.amountMinor) ||
        event.amountMinor <= 0 ||
        event.amountMinor > 10_000_000_000_000
      ) {
        throw new ApiError(400, 'INVALID_AMOUNT', 'Event amount must be a positive integer in minor units');
      }
    }
    if (event.currency !== null && !/^[A-Z]{3}$/.test(event.currency)) {
      throw new ApiError(400, 'INVALID_CURRENCY', 'Event currency must be a three-letter ISO code');
    }
    if (!event.type || event.type.length > 100) {
      throw new ApiError(400, 'INVALID_EVENT', 'Event type is required');
    }
  }

  private async recordDelivery(
    eventKey: string | null,
    event: NormalizedLedgerEvent,
    receivedAt: string,
    outcome: EventDelivery['outcome'],
    note: string | null,
  ): Promise<void> {
    await this.repo.insertDelivery({
      id: createId(),
      deliveryId: newDeliveryId(),
      eventKey,
      receivedAt,
      outcome,
      signatureStatus: event.signatureStatus,
      source: event.source,
      environment: event.environment,
      note,
    });
  }

  private safeError(error: unknown): string {
    const message = error instanceof Error ? error.message : 'Unknown processing error';
    return message.replace(/\s+/g, ' ').slice(0, 180);
  }

  createDemoEventKey(): string {
    return newEventKey();
  }

  newDemoRefundRef(): string {
    return newRefundRef();
  }
}
