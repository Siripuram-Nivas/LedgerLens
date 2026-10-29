import type {
  Environment,
  Payment,
  RefundRecordStatus,
  SettlementRecordStatus,
} from '../domain/types';
import { SETTLEMENT_RECORD_STATUSES } from '../domain/types';
import type { LedgerRepository } from '../repositories/ledgerRepository';
import type { EventService, NormalizedLedgerEvent } from './eventService';
import type { SeedService } from './seedService';
import type { Logger } from '../logger';
import type { RealtimeBus } from '../realtime/bus';
import type { AppConfig } from '../config';
import { ApiError } from '../utils/http';
import { createDemoRef, newEventKey } from '../utils/ids';
import { addDays, nowIso } from '../utils/dates';

export const DEMO_SCENARIOS = [
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
] as const;

export type DemoScenario = (typeof DEMO_SCENARIOS)[number];

export const RESET_CONFIRMATION = 'RESET DEMO DATA';

interface ScenarioInput {
  amountMinor?: number;
  note?: string;
}

interface ScenarioContext {
  orderRef: string | null;
  transactionRef: string;
  providerPaymentId: string;
  amountMinor: number;
  eventKey: string;
  eventResult: Awaited<ReturnType<EventService['process']>>;
}

export class DemoService {
  constructor(
    private readonly repo: LedgerRepository,
    private readonly config: AppConfig,
    private readonly eventService: EventService,
    private readonly seedService: SeedService,
    private readonly bus: RealtimeBus,
    private readonly logger: Logger,
  ) {}

  private requireDemo(): void {
    if (!this.config.DEMO_MODE) {
      throw new ApiError(
        403,
        'DEMO_DISABLED',
        'Demo scenarios are disabled. Set DEMO_MODE=true and restart to use the local demo provider.',
      );
    }
  }

  async runScenario(
    scenario: DemoScenario,
    input: ScenarioInput,
    actor = 'demo:operator',
  ): Promise<Record<string, unknown>> {
    this.requireDemo();
    const env: Environment = 'demo';
    const amount = input.amountMinor;

    switch (scenario) {
      case 'payment_success':
        return this.successScenario('payment_success', amount ?? 149900, actor);
      case 'payment_processing':
        return this.simpleStatusScenario('payment_processing', 'payment.authorized', amount ?? 79900, actor);
      case 'payment_pending':
        return this.simpleStatusScenario('payment_pending', 'payment.pending', amount ?? 129900, actor);
      case 'payment_failed':
        return this.simpleStatusScenario('payment_failed', 'payment.failed', amount ?? 54900, actor);
      case 'duplicate_webhook':
        return this.duplicateScenario(amount ?? 89900, actor);
      case 'amount_mismatch':
        return this.mismatchScenario(amount, actor);
      case 'missing_order':
        return this.missingOrderScenario(amount ?? 99900, actor);
      case 'settlement_pending':
        return this.settlementPendingScenario(amount ?? 249900, actor);
      case 'settlement_confirmed':
        return this.confirmSettlementScenario(actor);
      case 'refund':
        return this.refundScenario(amount, actor);
      default:
        throw new ApiError(400, 'UNKNOWN_SCENARIO', `Unknown demo scenario '${scenario}'`);
    }
  }

  async reset(confirm: string | undefined, actor = 'demo:operator') {
    this.requireDemo();
    if (confirm !== RESET_CONFIRMATION) {
      throw new ApiError(
        400,
        'CONFIRMATION_REQUIRED',
        `Type exactly "${RESET_CONFIRMATION}" to reset the simulated dataset.`,
      );
    }
    const deleted = await this.seedService.resetAndSeed();
    await this.repo.appendAudit({
      actor,
      action: 'demo.reset',
      entityType: 'environment',
      entityId: 'demo',
      note: 'Demo dataset reset and reseeded. Provider/sandbox data was not touched.',
      metadata: { deleted },
      environment: 'demo',
    });
    this.logger.warn({ deleted }, 'Demo dataset reset by operator');
    return {
      deleted,
      reseeded: true,
      message: 'Demo dataset reset. Only records tagged environment=demo were removed.',
    };
  }

  private async createDemoOrderPayment(options: {
    amountMinor: number;
    status: Payment['status'];
    withOrder: boolean;
    method: string;
    scenario: string;
    attempt?: number;
  }): Promise<{ orderRef: string | null; payment: Payment; customerRef: string }> {
    const customerRef = `CUST-${createDemoRef('C')}`;
    let orderRef: string | null = null;
    if (options.withOrder) {
      const order = await this.repo.createOrder({
        orderRef: createDemoRef('ORD'),
        customerRef,
        description: `Simulated ${options.scenario.replaceAll('_', ' ')} order`,
        amountMinor: options.amountMinor,
        currency: 'INR',
        source: 'demo',
        environment: 'demo',
      });
      orderRef = order.orderRef;
    }
    const payment = await this.repo.createPayment({
      transactionRef: createDemoRef('TXN'),
      orderRef,
      customerRef,
      amountMinor: options.amountMinor,
      currency: 'INR',
      status: options.status,
      provider: 'demo',
      providerPaymentId: `pay_DEMO_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      method: options.method,
      attempt: options.attempt ?? 1,
      source: 'demo',
      environment: 'demo',
      metadata: { channel: options.method, simulated: true, scenario: options.scenario },
    });
    return { orderRef, payment, customerRef };
  }

  private eventFor(
    payment: Payment,
    type: string,
    providerStatus: string,
  ): NormalizedLedgerEvent {
    return {
      eventKey: newEventKey(),
      providerEventId: `demo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      provider: 'demo',
      type,
      providerStatus,
      paymentRef: payment.providerPaymentId,
      orderRef: payment.orderRef,
      transactionRef: payment.transactionRef,
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      providerCreatedAt: nowIso(),
      signatureStatus: 'SIMULATED',
      source: 'demo',
      environment: 'demo',
      payloadSummary: {
        simulated: true,
        paymentId: payment.providerPaymentId,
        orderId: payment.orderRef,
        status: providerStatus,
        amountMinor: payment.amountMinor,
        currency: payment.currency,
        method: payment.method,
      },
    };
  }

  private async successScenario(
    scenario: DemoScenario,
    amountMinor: number,
    actor: string,
  ): Promise<Record<string, unknown>> {
    const context = await this.createPaymentAndProcess(
      scenario,
      amountMinor,
      'card',
      'PAID',
      'payment.captured',
      'captured',
    );
    await this.auditScenario(actor, scenario, context);
    return {
      scenario,
      ...context,
      message: `Simulated successful payment of INR ${(amountMinor / 100).toFixed(2)}. Settlement has not been inferred.`,
    };
  }

  private async simpleStatusScenario(
    scenario: DemoScenario,
    eventType: string,
    amountMinor: number,
    actor: string,
  ): Promise<Record<string, unknown>> {
    const statusMap: Record<string, Payment['status']> = {
      'payment.authorized': 'PROCESSING',
      'payment.pending': 'PENDING',
      'payment.failed': 'FAILED',
    };
    const providerStatusMap: Record<string, string> = {
      'payment.authorized': 'authorized',
      'payment.pending': 'pending',
      'payment.failed': 'failed',
    };
    const context = await this.createPaymentAndProcess(
      scenario,
      amountMinor,
      'card',
      statusMap[eventType] ?? 'PENDING',
      eventType,
      providerStatusMap[eventType] ?? 'pending',
    );
    await this.auditScenario(actor, scenario, context);
    return {
      scenario,
      ...context,
      message: `Simulated ${scenario.replaceAll('_', ' ')} event persisted and reconciled.`,
    };
  }

  private async createPaymentAndProcess(
    scenario: DemoScenario,
    amountMinor: number,
    method: string,
    initialStatus: Payment['status'],
    eventType: string,
    providerStatus: string,
  ): Promise<ScenarioContext> {
    const { orderRef, payment } = await this.createDemoOrderPayment({
      amountMinor,
      status: initialStatus,
      withOrder: true,
      method,
      scenario,
    });
    const normalized = this.eventFor(payment, eventType, providerStatus);
    const eventResult = await this.eventService.process(normalized);
    return {
      orderRef,
      transactionRef: payment.transactionRef,
      providerPaymentId: payment.providerPaymentId,
      amountMinor: payment.amountMinor,
      eventKey: normalized.eventKey,
      eventResult,
    };
  }

  private async duplicateScenario(
    amountMinor: number,
    actor: string,
  ): Promise<Record<string, unknown>> {
    const { orderRef, payment } = await this.createDemoOrderPayment({
      amountMinor,
      status: 'PAID',
      withOrder: true,
      method: 'upi',
      scenario: 'duplicate_webhook',
    });
    const normalized = this.eventFor(payment, 'payment.captured', 'captured');
    const first = await this.eventService.process(normalized);
    const duplicate = await this.eventService.process(normalized);
    await this.auditScenario(actor, 'duplicate_webhook', {
      orderRef,
      transactionRef: payment.transactionRef,
      providerPaymentId: payment.providerPaymentId,
      amountMinor,
      eventKey: normalized.eventKey,
      eventResult: first,
    });
    return {
      scenario: 'duplicate_webhook',
      orderRef,
      transactionRef: payment.transactionRef,
      providerPaymentId: payment.providerPaymentId,
      amountMinor,
      eventKey: normalized.eventKey,
      eventResult: first,
      duplicate: {
        eventKey: duplicate.event.eventKey,
        duplicate: duplicate.duplicate,
        applied: duplicate.applied,
        duplicateDeliveryCount: duplicate.event.duplicateDeliveryCount,
      },
      message:
        'The same event key was delivered twice. The second delivery was recorded as a duplicate and did not apply a second financial effect.',
    };
  }

  private async mismatchScenario(
    amountMinor: number | undefined,
    actor: string,
  ): Promise<Record<string, unknown>> {
    const orderAmount = 149900;
    const paymentAmount = amountMinor && amountMinor !== orderAmount ? amountMinor : 129900;
    if (paymentAmount === orderAmount) {
      throw new ApiError(400, 'NOT_A_MISMATCH', 'Choose a payment amount different from the order total');
    }
    const customerRef = `CUST-${createDemoRef('C')}`;
    const order = await this.repo.createOrder({
      orderRef: createDemoRef('ORD'),
      customerRef,
      description: 'Simulated amount mismatch order',
      amountMinor: orderAmount,
      currency: 'INR',
      source: 'demo',
      environment: 'demo',
    });
    const payment = await this.repo.createPayment({
      transactionRef: createDemoRef('TXN'),
      orderRef: order.orderRef,
      customerRef,
      amountMinor: paymentAmount,
      currency: 'INR',
      status: 'PAID',
      provider: 'demo',
      providerPaymentId: `pay_DEMO_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      method: 'card',
      source: 'demo',
      environment: 'demo',
      metadata: { simulated: true, scenario: 'amount_mismatch' },
    });
    const normalized = this.eventFor(payment, 'payment.captured', 'captured');
    const eventResult = await this.eventService.process(normalized);
    await this.auditScenario(actor, 'amount_mismatch', {
      orderRef: order.orderRef,
      transactionRef: payment.transactionRef,
      providerPaymentId: payment.providerPaymentId,
      amountMinor: paymentAmount,
      eventKey: normalized.eventKey,
      eventResult,
    });
    const exceptions = await this.repo.exceptionsForPayment(payment.transactionRef);
    return {
      scenario: 'amount_mismatch',
      orderRef: order.orderRef,
      transactionRef: payment.transactionRef,
      providerPaymentId: payment.providerPaymentId,
      amountMinor: paymentAmount,
      eventKey: normalized.eventKey,
      eventResult,
      orderAmountMinor: orderAmount,
      differenceMinor: Math.abs(orderAmount - paymentAmount),
      exceptionRef: exceptions[0]?.exceptionRef ?? null,
      message: `Simulated captured amount INR ${(paymentAmount / 100).toFixed(2)} against an order of INR ${(orderAmount / 100).toFixed(2)}.`,
    };
  }

  private async missingOrderScenario(
    amountMinor: number,
    actor: string,
  ): Promise<Record<string, unknown>> {
    const { payment, customerRef } = await this.createDemoOrderPayment({
      amountMinor,
      status: 'PAID',
      withOrder: false,
      method: 'card',
      scenario: 'missing_order',
    });
    const normalized = this.eventFor(payment, 'payment.captured', 'captured');
    const eventResult = await this.eventService.process(normalized);
    await this.auditScenario(actor, 'missing_order', {
      orderRef: null,
      transactionRef: payment.transactionRef,
      providerPaymentId: payment.providerPaymentId,
      amountMinor,
      eventKey: normalized.eventKey,
      eventResult,
    });
    const exceptions = await this.repo.exceptionsForPayment(payment.transactionRef);
    return {
      scenario: 'missing_order',
      orderRef: null,
      customerRef,
      transactionRef: payment.transactionRef,
      providerPaymentId: payment.providerPaymentId,
      amountMinor,
      eventKey: normalized.eventKey,
      eventResult,
      exceptionRef: exceptions[0]?.exceptionRef ?? null,
      message: 'Simulated captured payment with no matching order record.',
    };
  }

  private async settlementPendingScenario(
    amountMinor: number,
    actor: string,
  ): Promise<Record<string, unknown>> {
    const context = await this.createPaymentAndProcess(
      'settlement_pending',
      amountMinor,
      'netbanking',
      'PAID',
      'payment.captured',
      'captured',
    );
    const payment = await this.repo.getPayment(context.transactionRef);
    if (!payment) throw new Error('Demo payment disappeared during settlement setup');
    const settlement = await this.repo.createSettlement({
      settlementRef: createDemoRef('SET'),
      providerSettlementRef: null,
      status: 'PENDING',
      paymentRefs: [payment.providerPaymentId],
      transactionRefs: [payment.transactionRef],
      grossMinor: payment.amountMinor,
      feesMinor: null,
      netMinor: null,
      currency: payment.currency,
      expectedAt: addDays(nowIso(), 2),
      settledAt: null,
      feesSource: null,
      notes: 'Simulated pending settlement batch. No fees or deposit date are claimed.',
      source: 'demo',
      environment: 'demo',
    });
    await this.repo.updatePayment(payment.id, { settlementStatus: 'PENDING' });
    await this.auditScenario(actor, 'settlement_pending', context);
    this.bus.publish('settlement.updated', 'demo', {
      settlementRef: settlement.settlementRef,
      status: settlement.status,
    });
    this.bus.publish('transaction.updated', 'demo', {
      transactionRef: payment.transactionRef,
      reason: 'settlement.pending',
    });
    return {
      scenario: 'settlement_pending',
      ...context,
      settlementRef: settlement.settlementRef,
      settlementStatus: settlement.status,
      message:
        'Payment is captured, but the settlement is only pending. LedgerLens does not treat the funds as received.',
    };
  }

  private async confirmSettlementScenario(actor: string): Promise<Record<string, unknown>> {
    const settlement = await this.repo.latestPendingSettlement('demo');
    if (!settlement) {
      throw new ApiError(
        409,
        'NO_PENDING_SETTLEMENT',
        'There is no pending demo settlement. Run the "Simulated settlement pending" scenario first.',
      );
    }
    const fees = Math.round(settlement.grossMinor * 0.02);
    const updated = await this.repo.updateSettlement(settlement.id, {
      status: 'SETTLED',
      settledAt: nowIso(),
      expectedAt: settlement.expectedAt ?? nowIso(),
      providerSettlementRef: createDemoRef('setl'),
      feesMinor: fees,
      netMinor: settlement.grossMinor - fees,
      feesSource: 'SIMULATED_FIXTURE',
      notes: 'Simulated settlement confirmation. Fee and net values are explicitly simulated fixtures.',
    });
    const provider = settlement.source === 'demo' ? 'demo' : 'razorpay';
    for (const paymentRef of updated.paymentRefs) {
      const payment = await this.repo.getPaymentByProviderId(provider, paymentRef);
      if (payment) {
        await this.repo.updatePayment(payment.id, { settlementStatus: 'SETTLED' });
      }
    }
    await this.repo.appendAudit({
      actor,
      action: 'demo.settlement_confirmed',
      entityType: 'settlement',
      entityId: updated.settlementRef,
      note: 'Simulated settlement confirmation recorded.',
      metadata: { paymentRefs: updated.paymentRefs, grossMinor: updated.grossMinor },
      environment: 'demo',
    });
    this.bus.publish('settlement.updated', 'demo', {
      settlementRef: updated.settlementRef,
      status: updated.status,
    });
    for (const transactionRef of updated.transactionRefs) {
      this.bus.publish('transaction.updated', 'demo', {
        transactionRef,
        reason: 'settlement.settled',
      });
    }
    return {
      scenario: 'settlement_confirmed',
      settlementRef: updated.settlementRef,
      settlementStatus: updated.status,
      grossMinor: updated.grossMinor,
      feesMinor: updated.feesMinor,
      netMinor: updated.netMinor,
      feesSource: updated.feesSource,
      message: 'Simulated settlement confirmed. Fees and net amount are labeled simulated fixtures.',
    };
  }

  private async refundScenario(
    requestedAmount: number | undefined,
    actor: string,
  ): Promise<Record<string, unknown>> {
    const paymentAmount = 219900;
    const amount = requestedAmount ?? 109950;
    if (amount <= 0 || amount > paymentAmount) {
      throw new ApiError(400, 'INVALID_REFUND_AMOUNT', 'Refund amount must be within the payment amount');
    }
    const context = await this.createPaymentAndProcess(
      'refund',
      paymentAmount,
      'card',
      'PAID',
      'payment.captured',
      'captured',
    );
    const payment = await this.repo.getPayment(context.transactionRef);
    if (!payment) throw new Error('Demo payment disappeared during refund setup');
    const refund = await this.repo.createRefund({
      refundRef: createDemoRef('REF'),
      providerRefundRef: null,
      paymentRef: payment.providerPaymentId,
      transactionRef: payment.transactionRef,
      orderRef: payment.orderRef,
      amountMinor: amount,
      currency: payment.currency,
      status: 'REQUESTED',
      reason: 'Simulated customer refund request.',
      failureReason: null,
      timeline: [
        {
          at: nowIso(),
          status: 'REQUESTED',
          note: 'Simulated refund request recorded. Not yet completed.',
        },
      ],
      source: 'demo',
      environment: 'demo',
    });
    await this.repo.updatePayment(payment.id, { refundStatus: 'REQUESTED' });
    await this.auditScenario(actor, 'refund', context);
    await this.repo.appendAudit({
      actor,
      action: 'demo.refund_requested',
      entityType: 'refund',
      entityId: refund.refundRef,
      note: 'Simulated partial refund requested; completion requires an explicit demo transition.',
      metadata: { paymentRef: payment.providerPaymentId, amountMinor: amount },
      environment: 'demo',
    });
    this.bus.publish('refund.updated', 'demo', {
      refundRef: refund.refundRef,
      status: refund.status,
      paymentRef: payment.providerPaymentId,
    });
    this.bus.publish('transaction.updated', 'demo', {
      transactionRef: payment.transactionRef,
      reason: 'refund.requested',
    });
    return {
      scenario: 'refund',
      ...context,
      refundRef: refund.refundRef,
      refundStatus: refund.status,
      refundAmountMinor: refund.amountMinor,
      paymentAmountMinor: payment.amountMinor,
      message:
        'Refund requested for part of the payment. It is not marked complete; advance it from the Refunds page.',
    };
  }

  private async auditScenario(
    actor: string,
    scenario: DemoScenario,
    context: ScenarioContext,
  ): Promise<void> {
    await this.repo.appendAudit({
      actor,
      action: `demo.scenario.${scenario}`,
      entityType: 'transaction',
      entityId: context.transactionRef,
      note: `Simulated scenario '${scenario}' created demo-only records.`,
      metadata: {
        eventKey: context.eventKey,
        duplicate: context.eventResult.duplicate,
        applied: context.eventResult.applied,
      },
      environment: 'demo',
    });
    this.bus.publish('demo.scenario', 'demo', {
      scenario,
      transactionRef: context.transactionRef,
      eventKey: context.eventKey,
      duplicate: context.eventResult.duplicate,
    });
  }

  async pendingSettlementSummary() {
    const settlements = await this.repo.listSettlementsByStatus('demo', 'PENDING');
    return {
      count: settlements.length,
      settlements: settlements.map((settlement) => ({
        settlementRef: settlement.settlementRef,
        grossMinor: settlement.grossMinor,
        currency: settlement.currency,
      })),
    };
  }

  parseSettlementStatus(value: string): SettlementRecordStatus {
    return SETTLEMENT_RECORD_STATUSES.includes(value as SettlementRecordStatus)
      ? (value as SettlementRecordStatus)
      : 'UNKNOWN';
  }

  parseRefundStatus(value: string): RefundRecordStatus {
    return ['REQUESTED', 'PROCESSING', 'PARTIALLY_REFUNDED', 'REFUNDED', 'FAILED'].includes(value)
      ? (value as RefundRecordStatus)
      : 'REQUESTED';
  }
}
