import type {
  Environment,
  PaymentStatus,
  RefundRecordStatus,
  SettlementRecordStatus,
} from '../domain/types';
import { DAY_MS } from '../utils/dates';
import type { LedgerRepository } from '../repositories/ledgerRepository';
import type { Logger } from '../logger';
import type { RealtimeBus } from '../realtime/bus';
import type { ReconciliationService } from './reconciliationService';

interface SeedOrder {
  ref: string;
  amountMinor: number;
  currency: string;
  daysAgo: number;
  customerRef: string;
  description: string;
}

interface SeedPayment {
  suffix: string;
  orderRef: string | null;
  amountMinor: number;
  currency?: string;
  method: string;
  status: PaymentStatus;
  daysAgo: number;
  attempt?: number;
  duplicateDelivery?: boolean;
  duplicateEvent?: boolean;
}

interface SeedSettlement {
  ref: string;
  paySuffix: string;
  status: SettlementRecordStatus;
  daysAgo: number;
  notes: string;
}

interface SeedRefund {
  ref: string;
  paySuffix: string;
  amountMinor: number;
  status: RefundRecordStatus;
  daysAgo: number;
}

const EVENT_TYPE: Record<PaymentStatus, string> = {
  PENDING: 'payment.pending',
  PROCESSING: 'payment.authorized',
  PAID: 'payment.captured',
  FAILED: 'payment.failed',
  CANCELLED: 'payment.cancelled',
};

const PROVIDER_STATUS: Record<PaymentStatus, string> = {
  PENDING: 'pending',
  PROCESSING: 'authorized',
  PAID: 'captured',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
};

const ORDERS: SeedOrder[] = [
  { ref: 'ORD-DEMO-1001', amountMinor: 149900, currency: 'INR', daysAgo: 0.15, customerRef: 'CUST-DEMO-1001', description: 'Order #1001 — workspace license' },
  { ref: 'ORD-DEMO-1002', amountMinor: 89900, currency: 'INR', daysAgo: 0.5, customerRef: 'CUST-DEMO-1002', description: 'Order #1002 — annual support' },
  { ref: 'ORD-DEMO-1003', amountMinor: 249900, currency: 'INR', daysAgo: 1.2, customerRef: 'CUST-DEMO-1003', description: 'Order #1003 — implementation package' },
  { ref: 'ORD-DEMO-1004', amountMinor: 49900, currency: 'INR', daysAgo: 2.2, customerRef: 'CUST-DEMO-1004', description: 'Order #1004 — analytics add-on' },
  { ref: 'ORD-DEMO-1005', amountMinor: 129900, currency: 'INR', daysAgo: 0.35, customerRef: 'CUST-DEMO-1005', description: 'Order #1005 — onboarding service' },
  { ref: 'ORD-DEMO-1006', amountMinor: 79900, currency: 'INR', daysAgo: 1.8, customerRef: 'CUST-DEMO-1006', description: 'Order #1006 — team seats' },
  { ref: 'ORD-DEMO-1007', amountMinor: 54900, currency: 'INR', daysAgo: 0.6, customerRef: 'CUST-DEMO-1007', description: 'Order #1007 — data export' },
  { ref: 'ORD-DEMO-1008', amountMinor: 99900, currency: 'INR', daysAgo: 4, customerRef: 'CUST-DEMO-1008', description: 'Order #1008 — cancelled renewal' },
  { ref: 'ORD-DEMO-1009', amountMinor: 149900, currency: 'INR', daysAgo: 1.5, customerRef: 'CUST-DEMO-1009', description: 'Order #1009 — priority plan' },
  { ref: 'ORD-DEMO-1011', amountMinor: 189900, currency: 'INR', daysAgo: 5, customerRef: 'CUST-DEMO-1011', description: 'Order #1011 — unconfirmed checkout' },
  { ref: 'ORD-DEMO-1012', amountMinor: 149900, currency: 'INR', daysAgo: 6.4, customerRef: 'CUST-DEMO-1012', description: 'Order #1012 — retried payment' },
  { ref: 'ORD-DEMO-1013', amountMinor: 69900, currency: 'INR', daysAgo: 8, customerRef: 'CUST-DEMO-1013', description: 'Order #1013 — currency review' },
  { ref: 'ORD-DEMO-1014', amountMinor: 219900, currency: 'INR', daysAgo: 9, customerRef: 'CUST-DEMO-1014', description: 'Order #1014 — services bundle' },
  { ref: 'ORD-DEMO-1015', amountMinor: 99900, currency: 'INR', daysAgo: 10, customerRef: 'CUST-DEMO-1015', description: 'Order #1015 — training workshop' },
  { ref: 'ORD-DEMO-1016', amountMinor: 159900, currency: 'INR', daysAgo: 11, customerRef: 'CUST-DEMO-1016', description: 'Order #1016 — migration support' },
  { ref: 'ORD-DEMO-1017', amountMinor: 129900, currency: 'INR', daysAgo: 12, customerRef: 'CUST-DEMO-1017', description: 'Order #1017 — failed settlement' },
  { ref: 'ORD-DEMO-1018', amountMinor: 349900, currency: 'INR', daysAgo: 13, customerRef: 'CUST-DEMO-1018', description: 'Order #1018 — duplicate event review' },
  { ref: 'ORD-DEMO-1020', amountMinor: 59900, currency: 'INR', daysAgo: 16, customerRef: 'CUST-DEMO-1020', description: 'Order #1020 — monthly plan' },
  { ref: 'ORD-DEMO-1021', amountMinor: 74900, currency: 'INR', daysAgo: 19, customerRef: 'CUST-DEMO-1021', description: 'Order #1021 — monthly plan' },
  { ref: 'ORD-DEMO-1022', amountMinor: 19900, currency: 'INR', daysAgo: 24, customerRef: 'CUST-DEMO-1022', description: 'Order #1022 — usage top-up' },
  { ref: 'ORD-DEMO-1023', amountMinor: 499900, currency: 'INR', daysAgo: 21, customerRef: 'CUST-DEMO-1023', description: 'Order #1023 — duplicate capture review' },
  { ref: 'ORD-DEMO-1025', amountMinor: 129900, currency: 'INR', daysAgo: 27, customerRef: 'CUST-DEMO-1025', description: 'Order #1025 — annual renewal' },
];

const PAYMENTS: SeedPayment[] = [
  { suffix: '0001', orderRef: 'ORD-DEMO-1001', amountMinor: 149900, method: 'card', status: 'PAID', daysAgo: 0.15, duplicateDelivery: true },
  { suffix: '0002', orderRef: 'ORD-DEMO-1002', amountMinor: 89900, method: 'upi', status: 'PAID', daysAgo: 0.5 },
  { suffix: '0003', orderRef: 'ORD-DEMO-1003', amountMinor: 249900, method: 'netbanking', status: 'PAID', daysAgo: 1.2 },
  { suffix: '0004', orderRef: 'ORD-DEMO-1004', amountMinor: 49900, method: 'card', status: 'PAID', daysAgo: 2.2 },
  { suffix: '0005', orderRef: 'ORD-DEMO-1005', amountMinor: 129900, method: 'upi', status: 'PENDING', daysAgo: 0.35 },
  { suffix: '0006', orderRef: 'ORD-DEMO-1006', amountMinor: 79900, method: 'card', status: 'PROCESSING', daysAgo: 1.8 },
  { suffix: '0007', orderRef: 'ORD-DEMO-1007', amountMinor: 54900, method: 'card', status: 'FAILED', daysAgo: 0.6 },
  { suffix: '0008', orderRef: 'ORD-DEMO-1008', amountMinor: 99900, method: 'netbanking', status: 'CANCELLED', daysAgo: 4 },
  { suffix: '0009', orderRef: 'ORD-DEMO-1009', amountMinor: 129900, method: 'upi', status: 'PAID', daysAgo: 1.5 },
  { suffix: '0010', orderRef: null, amountMinor: 99900, method: 'card', status: 'PAID', daysAgo: 3.2 },
  { suffix: '0012', orderRef: 'ORD-DEMO-1012', amountMinor: 149900, method: 'card', status: 'FAILED', daysAgo: 6.4, attempt: 1 },
  { suffix: '0013', orderRef: 'ORD-DEMO-1012', amountMinor: 149900, method: 'upi', status: 'PAID', daysAgo: 6.3, attempt: 2 },
  { suffix: '0014', orderRef: 'ORD-DEMO-1013', amountMinor: 69900, currency: 'USD', method: 'card', status: 'PAID', daysAgo: 8 },
  { suffix: '0015', orderRef: 'ORD-DEMO-1014', amountMinor: 219900, method: 'card', status: 'PAID', daysAgo: 9 },
  { suffix: '0016', orderRef: 'ORD-DEMO-1015', amountMinor: 99900, method: 'upi', status: 'PAID', daysAgo: 10 },
  { suffix: '0017', orderRef: 'ORD-DEMO-1016', amountMinor: 159900, method: 'netbanking', status: 'PAID', daysAgo: 11 },
  { suffix: '0018', orderRef: 'ORD-DEMO-1017', amountMinor: 129900, method: 'card', status: 'PAID', daysAgo: 12 },
  { suffix: '0019', orderRef: 'ORD-DEMO-1018', amountMinor: 349900, method: 'card', status: 'PAID', daysAgo: 13, duplicateEvent: true },
  { suffix: '0020', orderRef: 'ORD-DEMO-1020', amountMinor: 59900, method: 'upi', status: 'PAID', daysAgo: 16 },
  { suffix: '0021', orderRef: 'ORD-DEMO-1021', amountMinor: 74900, method: 'card', status: 'PAID', daysAgo: 19 },
  { suffix: '0022', orderRef: 'ORD-DEMO-1022', amountMinor: 19900, method: 'upi', status: 'PAID', daysAgo: 24 },
  { suffix: '0023', orderRef: 'ORD-DEMO-1023', amountMinor: 499900, method: 'card', status: 'PAID', daysAgo: 21, attempt: 1 },
  { suffix: '0024', orderRef: 'ORD-DEMO-1023', amountMinor: 499900, method: 'card', status: 'PAID', daysAgo: 20.9, attempt: 2 },
  { suffix: '0025', orderRef: 'ORD-DEMO-1025', amountMinor: 129900, method: 'netbanking', status: 'PAID', daysAgo: 27 },
];

const SETTLEMENTS: SeedSettlement[] = [
  { ref: 'SET-DEMO-0001', paySuffix: '0001', status: 'SETTLED', daysAgo: 0.12, notes: 'Simulated settlement confirmation. Not a bank deposit.' },
  { ref: 'SET-DEMO-0002', paySuffix: '0002', status: 'SETTLED', daysAgo: 0.45, notes: 'Simulated settlement confirmation. Not a bank deposit.' },
  { ref: 'SET-DEMO-0003', paySuffix: '0003', status: 'PENDING', daysAgo: 1.1, notes: 'Simulated pending settlement batch.' },
  { ref: 'SET-DEMO-0004', paySuffix: '0015', status: 'SETTLED', daysAgo: 8.9, notes: 'Simulated settlement confirmation. Not a bank deposit.' },
  { ref: 'SET-DEMO-0005', paySuffix: '0018', status: 'FAILED', daysAgo: 11.9, notes: 'Simulated failed settlement for review.' },
  { ref: 'SET-DEMO-0006', paySuffix: '0020', status: 'SETTLED', daysAgo: 15.8, notes: 'Simulated settlement confirmation. Not a bank deposit.' },
  { ref: 'SET-DEMO-0007', paySuffix: '0021', status: 'SETTLED', daysAgo: 18.8, notes: 'Simulated settlement confirmation. Not a bank deposit.' },
  { ref: 'SET-DEMO-0008', paySuffix: '0022', status: 'SETTLED', daysAgo: 23.8, notes: 'Simulated settlement confirmation. Not a bank deposit.' },
  { ref: 'SET-DEMO-0009', paySuffix: '0025', status: 'SETTLED', daysAgo: 26.8, notes: 'Simulated settlement confirmation. Not a bank deposit.' },
];

const REFUNDS: SeedRefund[] = [
  { ref: 'REF-DEMO-0001', paySuffix: '0015', amountMinor: 50000, status: 'REFUNDED', daysAgo: 8.8 },
  { ref: 'REF-DEMO-0002', paySuffix: '0016', amountMinor: 99900, status: 'REQUESTED', daysAgo: 9.8 },
  { ref: 'REF-DEMO-0003', paySuffix: '0017', amountMinor: 159900, status: 'FAILED', daysAgo: 10.8 },
];

export class SeedService {
  constructor(
    private readonly repo: LedgerRepository,
    private readonly reconciliation: ReconciliationService,
    private readonly logger: Logger,
    private readonly bus: RealtimeBus,
  ) {}

  async seedIfEmpty(): Promise<boolean> {
    const count = await this.repo.countCollection('payments', { environment: 'demo' });
    if (count > 0) return false;
    await this.seed();
    return true;
  }

  async resetAndSeed(): Promise<Record<string, number>> {
    const counts = await this.repo.resetDemoData();
    await this.seed();
    this.bus.publish('demo.reset', 'demo', { counts });
    return counts;
  }

  async seed(): Promise<void> {
    const base = Date.now();
    const at = (daysAgo: number, offsetMs = 0) =>
      new Date(base - daysAgo * DAY_MS + offsetMs).toISOString();
    const environment: Environment = 'demo';

    const orderMap = new Map<
      string,
      { id: string; ref: string; amountMinor: number; currency: string; customerRef: string }
    >();
    for (const order of ORDERS) {
      const created = await this.repo.createOrder({
        orderRef: order.ref,
        customerRef: order.customerRef,
        description: order.description,
        amountMinor: order.amountMinor,
        currency: order.currency,
        source: 'demo',
        environment,
        createdAt: at(order.daysAgo, -120_000),
      });
      orderMap.set(order.ref, {
        id: created.id,
        ref: created.orderRef,
        amountMinor: created.amountMinor,
        currency: created.currency,
        customerRef: created.customerRef,
      });
    }

    const paymentMap = new Map<
      string,
      { id: string; transactionRef: string; providerPaymentId: string; amountMinor: number; currency: string }
    >();

    for (const fixture of PAYMENTS) {
      const createdAt = at(fixture.daysAgo);
      const eventAt = at(fixture.daysAgo, 60_000);
      const currency = fixture.currency ?? 'INR';
      const transactionRef = `TXN-DEMO-${fixture.suffix}`;
      const providerPaymentId = `pay_DEMO_SEED_${fixture.suffix}`;
      const order = fixture.orderRef ? orderMap.get(fixture.orderRef) : null;
      const payment = await this.repo.createPayment({
        transactionRef,
        orderRef: fixture.orderRef,
        customerRef: order?.customerRef ?? `CUST-DEMO-${fixture.suffix}`,
        amountMinor: fixture.amountMinor,
        currency,
        status: fixture.status,
        provider: 'demo',
        providerPaymentId,
        method: fixture.method,
        attempt: fixture.attempt ?? 1,
        source: 'demo',
        environment,
        metadata: { channel: fixture.method, simulated: true },
        createdAt,
        lastEventAt: eventAt,
      });
      paymentMap.set(fixture.suffix, {
        id: payment.id,
        transactionRef,
        providerPaymentId,
        amountMinor: payment.amountMinor,
        currency: payment.currency,
      });

      const eventKey = `evt_DEMO_SEED_${fixture.suffix}`;
      const eventId = `demo_seed_event_${fixture.suffix}`;
      await this.repo.insertEvent({
        id: `seed-event-${fixture.suffix}`,
        eventKey,
        provider: 'demo',
        providerEventId: eventId,
        type: EVENT_TYPE[fixture.status],
        providerStatus: PROVIDER_STATUS[fixture.status],
        paymentRef: providerPaymentId,
        orderRef: fixture.orderRef,
        transactionRef,
        amountMinor: fixture.amountMinor,
        currency,
        receivedAt: eventAt,
        providerCreatedAt: eventAt,
        signatureStatus: 'SIMULATED',
        processingStatus: 'PROCESSED',
        processingError: null,
        processingNote: 'Seeded demo event. No provider signature was involved.',
        applied: true,
        duplicateDeliveryCount: fixture.duplicateDelivery ? 1 : 0,
        lastDeliveryAt: fixture.duplicateDelivery ? at(fixture.daysAgo, 180_000) : eventAt,
        reconciliationTriggered: false,
        source: 'demo',
        environment,
        payloadSummary: {
          simulated: true,
          paymentId: providerPaymentId,
          orderId: fixture.orderRef,
          status: PROVIDER_STATUS[fixture.status],
          amountMinor: fixture.amountMinor,
          currency,
          method: fixture.method,
        },
        createdAt: eventAt,
        updatedAt: eventAt,
      });
      await this.repo.insertDelivery({
        id: `seed-delivery-${fixture.suffix}-a`,
        deliveryId: `DLV-DEMO-SEED-${fixture.suffix}-A`,
        eventKey,
        receivedAt: eventAt,
        outcome: 'ACCEPTED',
        signatureStatus: 'SIMULATED',
        source: 'demo',
        environment,
        note: 'Seeded simulation — no signature available.',
      });
      if (fixture.duplicateDelivery) {
        await this.repo.insertDelivery({
          id: `seed-delivery-${fixture.suffix}-b`,
          deliveryId: `DLV-DEMO-SEED-${fixture.suffix}-B`,
          eventKey,
          receivedAt: at(fixture.daysAgo, 180_000),
          outcome: 'DUPLICATE',
          signatureStatus: 'SIMULATED',
          source: 'demo',
          environment,
          note: 'Duplicate delivery acknowledged; no additional financial effect.',
        });
      }

      if (fixture.duplicateEvent) {
        const secondKey = `evt_DEMO_SEED_${fixture.suffix}_B`;
        await this.repo.insertEvent({
          id: `seed-event-${fixture.suffix}-b`,
          eventKey: secondKey,
          provider: 'demo',
          providerEventId: `demo_seed_event_${fixture.suffix}_b`,
          type: 'payment.captured',
          providerStatus: 'captured',
          paymentRef: providerPaymentId,
          orderRef: fixture.orderRef,
          transactionRef,
          amountMinor: fixture.amountMinor,
          currency,
          receivedAt: at(fixture.daysAgo, 300_000),
          providerCreatedAt: at(fixture.daysAgo, 300_000),
          signatureStatus: 'SIMULATED',
          processingStatus: 'PROCESSED',
          processingError: null,
          processingNote: 'Second distinct capture event used to demonstrate duplicate-event detection.',
          applied: true,
          duplicateDeliveryCount: 0,
          lastDeliveryAt: at(fixture.daysAgo, 300_000),
          reconciliationTriggered: false,
          source: 'demo',
          environment,
          payloadSummary: {
            simulated: true,
            paymentId: providerPaymentId,
            status: 'captured',
            amountMinor: fixture.amountMinor,
            currency,
          },
          createdAt: at(fixture.daysAgo, 300_000),
          updatedAt: at(fixture.daysAgo, 300_000),
        });
        await this.repo.insertDelivery({
          id: `seed-delivery-${fixture.suffix}-b-event`,
          deliveryId: `DLV-DEMO-SEED-${fixture.suffix}-C`,
          eventKey: secondKey,
          receivedAt: at(fixture.daysAgo, 300_000),
          outcome: 'ACCEPTED',
          signatureStatus: 'SIMULATED',
          source: 'demo',
          environment,
          note: 'Seeded distinct event with a new event key.',
        });
        await this.repo.updatePayment(payment.id, {
          lastEventAt: at(fixture.daysAgo, 300_000),
          lastEventKey: secondKey,
        });
      }
    }

    for (const fixture of SETTLEMENTS) {
      const payment = paymentMap.get(fixture.paySuffix);
      if (!payment) continue;
      const gross = payment.amountMinor;
      const fees = fixture.status === 'SETTLED' ? Math.round(gross * 0.02) : null;
      const net = fees === null ? null : gross - fees;
      const createdAt = at(fixture.daysAgo, 3_600_000);
      const settledAt =
        fixture.status === 'SETTLED' ? at(Math.max(0, fixture.daysAgo - 0.05), 3_600_000) : null;
      const expectedAt = at(Math.max(0, fixture.daysAgo - 1), 3_600_000);
      await this.repo.createSettlement({
        settlementRef: fixture.ref,
        providerSettlementRef: null,
        status: fixture.status,
        paymentRefs: [payment.providerPaymentId],
        transactionRefs: [payment.transactionRef],
        grossMinor: gross,
        feesMinor: fees,
        netMinor: net,
        currency: payment.currency,
        expectedAt,
        settledAt,
        feesSource: fees === null ? null : 'SIMULATED_FIXTURE',
        notes: fixture.notes,
        source: 'demo',
        environment,
      });
      await this.repo.updatePayment(payment.id, {
        settlementStatus: fixture.status,
      });
    }

    for (const fixture of REFUNDS) {
      const payment = paymentMap.get(fixture.paySuffix);
      if (!payment) continue;
      const requestedAt = at(fixture.daysAgo, 7_200_000);
      const timeline: Array<{ at: string; status: RefundRecordStatus; note: string }> = [
        { at: requestedAt, status: 'REQUESTED', note: 'Simulated refund request recorded.' },
      ];
      if (fixture.status === 'REFUNDED' || fixture.status === 'PARTIALLY_REFUNDED') {
        timeline.push({ at: at(fixture.daysAgo, 10_800_000), status: 'PROCESSING', note: 'Simulated provider processing.' });
        timeline.push({ at: at(fixture.daysAgo, 14_400_000), status: 'REFUNDED', note: 'Simulated refund completion event.' });
      } else if (fixture.status === 'PROCESSING') {
        timeline.push({ at: at(fixture.daysAgo, 10_800_000), status: 'PROCESSING', note: 'Simulated provider processing.' });
      } else if (fixture.status === 'FAILED') {
        timeline.push({ at: at(fixture.daysAgo, 10_800_000), status: 'FAILED', note: 'Simulated provider failure event.' });
      }
      const refund = await this.repo.createRefund({
        refundRef: fixture.ref,
        providerRefundRef: null,
        paymentRef: payment.providerPaymentId,
        transactionRef: payment.transactionRef,
        orderRef: PAYMENTS.find((candidate) => candidate.suffix === fixture.paySuffix)?.orderRef ?? null,
        amountMinor: fixture.amountMinor,
        currency: payment.currency,
        status: fixture.status,
        reason: 'Simulated customer refund request.',
        failureReason:
          fixture.status === 'FAILED' ? 'Simulated provider rejection for demo purposes.' : null,
        timeline,
        source: 'demo',
        environment,
        createdAt: requestedAt,
      });
      await this.repo.updatePayment(payment.id, {
        refundStatus: await this.repo.deriveRefundStatus(refund.paymentRef),
      });
    }

    await this.repo.appendAudit({
      actor: 'system:seed',
      action: 'demo.seed',
      entityType: 'environment',
      entityId: 'demo',
      note: 'Seeded deterministic demo fixtures. All records are simulated.',
      metadata: { payments: PAYMENTS.length, orders: ORDERS.length, settlements: SETTLEMENTS.length, refunds: REFUNDS.length },
      environment,
    });

    await this.reconciliation.run({
      environment,
      triggeredBy: 'seed',
      scope: { type: 'all' },
    });

    this.logger.info(
      { payments: PAYMENTS.length, orders: ORDERS.length },
      'Demo dataset seeded and reconciled',
    );
  }
}

export const seedCounts = {
  orders: ORDERS.length,
  payments: PAYMENTS.length,
  settlements: SETTLEMENTS.length,
  refunds: REFUNDS.length,
};
