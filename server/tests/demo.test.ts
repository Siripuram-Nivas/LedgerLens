import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  closeTestContext,
  createTestContext,
  type TestContext,
} from './helpers';

let context: TestContext;

beforeEach(async () => {
  context = await createTestContext();
});

afterEach(async () => {
  await closeTestContext(context);
});

async function runScenario(scenario: string, extra: Record<string, unknown> = {}) {
  const response = await request(context.app)
    .post('/api/v1/demo/scenarios')
    .send({ scenario, ...extra })
    .expect(201);
  return response.body.data as Record<string, unknown>;
}

describe('demo scenarios', () => {
  it('creates a paid transaction without inferring settlement', async () => {
    const result = await runScenario('payment_success');
    const transactionRef = result.transactionRef as string;
    expect(transactionRef).toMatch(/^TXN-/);

    const detail = await request(context.app)
      .get(`/api/v1/transactions/${transactionRef}`)
      .expect(200);
    const payment = detail.body.data.payment;
    expect(payment.status).toBe('PAID');
    expect(payment.settlementStatus).toBe('NOT_STARTED');
    expect(payment.reconciliationStatus).toBe('MATCHED');
    expect(payment.refundStatus).toBe('NONE');
    expect(payment.source).toBe('demo');
    expect(payment.environment).toBe('demo');

    const event = await request(context.app)
      .get(`/api/v1/events/${result.eventKey as string}`)
      .expect(200);
    expect(event.body.data.event.processingStatus).toBe('PROCESSED');
    expect(event.body.data.event.signatureStatus).toBe('SIMULATED');
    expect(event.body.data.event.applied).toBe(true);
    expect(event.body.data.stages).toHaveLength(5);
    expect(event.body.data.deliveries).toHaveLength(1);
  });

  it('processes a duplicate webhook idempotently and exposes both deliveries', async () => {
    const result = await runScenario('duplicate_webhook');
    const duplicate = result.duplicate as {
      duplicate: boolean;
      applied: boolean;
      duplicateDeliveryCount: number;
    };
    expect(duplicate.duplicate).toBe(true);
    expect(duplicate.applied).toBe(false);
    expect(duplicate.duplicateDeliveryCount).toBe(1);

    const event = await request(context.app)
      .get(`/api/v1/events/${result.eventKey as string}`)
      .expect(200);
    expect(event.body.data.event.duplicateDeliveryCount).toBe(1);
    expect(event.body.data.deliveries).toHaveLength(2);
    expect(event.body.data.deliveries[0].outcome).toBe('ACCEPTED');
    expect(event.body.data.deliveries[1].outcome).toBe('DUPLICATE');
  });

  it('creates an amount mismatch exception with linked evidence', async () => {
    const result = await runScenario('amount_mismatch');
    const exceptionRef = result.exceptionRef as string;
    expect(exceptionRef).toBeTruthy();

    const detail = await request(context.app)
      .get(`/api/v1/reconciliation/exceptions/${exceptionRef}`)
      .expect(200);
    const exception = detail.body.data.exception;
    expect(exception.type).toBe('AMOUNT_MISMATCH');
    expect(exception.status).toBe('OPEN');
    expect(exception.expectedAmountMinor).toBe(149_900);
    expect(exception.observedAmountMinor).toBe(129_900);
    expect(exception.transactionRef).toBe(result.transactionRef);
    expect(detail.body.data.payment).not.toBeNull();
    expect(detail.body.data.order).not.toBeNull();
  });

  it('advances pending settlement and refund only through explicit demo actions', async () => {
    const settlementResult = await runScenario('settlement_pending');
    const settlementRef = settlementResult.settlementRef as string;

    const pending = await request(context.app)
      .get(`/api/v1/settlements/${settlementRef}`)
      .expect(200);
    expect(pending.body.data.settlement.status).toBe('PENDING');
    expect(pending.body.data.settlement.feesMinor).toBeNull();
    expect(pending.body.data.simulated).toBe(true);

    const confirmed = await runScenario('settlement_confirmed');
    expect(confirmed.settlementRef).toBe(settlementRef);
    expect(confirmed.settlementStatus).toBe('SETTLED');
    expect(confirmed.feesSource).toBe('SIMULATED_FIXTURE');

    const settled = await request(context.app)
      .get(`/api/v1/settlements/${settlementRef}`)
      .expect(200);
    expect(settled.body.data.settlement.status).toBe('SETTLED');
    expect(settled.body.data.settlement.netMinor).toBeLessThan(
      settled.body.data.settlement.grossMinor,
    );

    const refundResult = await runScenario('refund');
    const refundRef = refundResult.refundRef as string;
    expect(refundResult.refundStatus).toBe('REQUESTED');

    const processing = await request(context.app)
      .post(`/api/v1/refunds/${refundRef}/advance-demo`)
      .send({})
      .expect(200);
    expect(processing.body.data.status).toBe('PROCESSING');

    const completed = await request(context.app)
      .post(`/api/v1/refunds/${refundRef}/advance-demo`)
      .send({})
      .expect(200);
    expect(completed.body.data.status).toBe('REFUNDED');

    const transaction = await request(context.app)
      .get(`/api/v1/transactions/${refundResult.transactionRef as string}`)
      .expect(200);
    expect(transaction.body.data.payment.refundStatus).toBe('PARTIALLY_REFUNDED');

    const finalAdvance = await request(context.app)
      .post(`/api/v1/refunds/${refundRef}/advance-demo`)
      .send({})
      .expect(409);
    expect(finalAdvance.body.error.code).toBe('INVALID_REFUND_TRANSITION');
  });

  it('resets only demo data and requires the exact confirmation phrase', async () => {
    const sandboxOrder = await context.services.repo.createOrder({
      orderRef: 'ORD-SANDBOX-KEEP',
      customerRef: 'CUST-SANDBOX',
      description: 'Sandbox record that must survive demo reset',
      amountMinor: 55_000,
      currency: 'INR',
      source: 'razorpay',
      environment: 'sandbox',
    });
    await context.services.repo.createPayment({
      transactionRef: 'TXN-SANDBOX-KEEP',
      orderRef: sandboxOrder.orderRef,
      customerRef: 'CUST-SANDBOX',
      amountMinor: 55_000,
      currency: 'INR',
      status: 'PAID',
      provider: 'razorpay',
      providerPaymentId: 'pay_sandbox_keep',
      method: 'card',
      source: 'razorpay',
      environment: 'sandbox',
    });

    await runScenario('payment_success');

    const wrong = await request(context.app)
      .post('/api/v1/demo/reset')
      .send({ confirm: 'reset demo data' })
      .expect(400);
    expect(wrong.body.error.code).toBe('CONFIRMATION_REQUIRED');

    const reset = await request(context.app)
      .post('/api/v1/demo/reset')
      .send({ confirm: 'RESET DEMO DATA' })
      .expect(200);
    expect(reset.body.data.reseeded).toBe(true);
    expect(reset.body.data.deleted.payments).toBeGreaterThanOrEqual(1);

    const survivingSandbox = await context.services.repo.getPayment('TXN-SANDBOX-KEEP');
    expect(survivingSandbox).not.toBeNull();
    expect(survivingSandbox?.environment).toBe('sandbox');

    const demoPayments = await context.services.repo.listPaymentsForEnvironment('demo');
    expect(demoPayments.length).toBeGreaterThan(10);
    expect(demoPayments.every((payment) => payment.environment === 'demo')).toBe(true);
  });
});
