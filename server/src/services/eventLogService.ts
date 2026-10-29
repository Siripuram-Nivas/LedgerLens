import type { Environment, PaymentEvent } from '../domain/types';
import type { EventListQuery, LedgerRepository } from '../repositories/ledgerRepository';
import { notFound } from '../utils/http';

export class EventLogService {
  constructor(private readonly repo: LedgerRepository) {}

  async list(query: EventListQuery, environment: Environment) {
    return this.repo.listEvents(query, environment);
  }

  async detail(reference: string, environment: Environment) {
    const event = await this.repo.getEvent(reference);
    if (!event || event.environment !== environment) {
      throw notFound('Event', reference);
    }
    const [deliveries, transaction, order] = await Promise.all([
      this.repo.listDeliveries(event.eventKey),
      event.transactionRef ? this.repo.getPayment(event.transactionRef) : Promise.resolve(null),
      event.orderRef ? this.repo.getOrder(event.orderRef) : Promise.resolve(null),
    ]);
    return {
      event,
      deliveries,
      transaction,
      order,
      stages: this.stages(event, deliveries.length),
    };
  }

  private stages(event: PaymentEvent, deliveryCount: number) {
    return [
      {
        stage: 'received',
        complete: true,
        at: event.receivedAt,
        detail: `${deliveryCount} delivery record${deliveryCount === 1 ? '' : 's'} retained.`,
      },
      {
        stage: 'signature',
        complete: event.signatureStatus === 'VERIFIED',
        at: event.receivedAt,
        detail:
          event.signatureStatus === 'VERIFIED'
            ? 'HMAC signature verified against the configured webhook secret.'
            : event.signatureStatus === 'SIMULATED'
              ? 'Simulated demo event — no provider signature was involved.'
              : 'Signature was not verified. This event must not be treated as trusted.',
      },
      {
        stage: 'persisted',
        complete: true,
        at: event.createdAt,
        detail: `Idempotency key ${event.eventKey}.`,
      },
      {
        stage: 'processed',
        complete: event.processingStatus === 'PROCESSED',
        at: event.updatedAt,
        detail:
          event.processingStatus === 'PROCESSED'
            ? event.applied
              ? 'Financial effect applied exactly once.'
              : event.processingNote ?? 'Retained without a financial effect.'
            : event.processingError ?? 'Processing has not completed.',
      },
      {
        stage: 'reconciliation',
        complete: event.reconciliationTriggered,
        at: event.reconciliationTriggered ? event.updatedAt : null,
        detail: event.reconciliationTriggered
          ? 'A reconciliation run was triggered after processing.'
          : 'No post-event reconciliation run is linked to this record.',
      },
    ];
  }
}
