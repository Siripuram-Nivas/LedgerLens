import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  closeTestContext,
  createTestContext,
  type TestContext,
} from './helpers';
import type { PaymentStatus } from '../src/domain/types';

let context: TestContext;

beforeEach(async () => {
  context = await createTestContext();
});

afterEach(async () => {
  await closeTestContext(context);
});

async function createPair(options: {
  orderRef: string;
  transactionRef: string;
  providerPaymentId: string;
  orderAmountMinor: number;
  orderCurrency?: string;
  paymentAmountMinor: number;
  paymentCurrency?: string;
  status?: PaymentStatus;
  attempt?: number;
}) {
  const order = await context.services.repo.createOrder({
    orderRef: options.orderRef,
    customerRef: 'CUST-RECON-1',
    description: 'Reconciliation test order',
    amountMinor: options.orderAmountMinor,
    currency: options.orderCurrency ?? 'INR',
    source: 'demo',
  });
  const payment = await context.services.repo.createPayment({
    transactionRef: options.transactionRef,
    orderRef: order.orderRef,
    customerRef: 'CUST-RECON-1',
    amountMinor: options.paymentAmountMinor,
    currency: options.paymentCurrency ?? 'INR',
    status: options.status ?? 'PAID',
    provider: 'demo',
    providerPaymentId: options.providerPaymentId,
    method: 'card',
    attempt: options.attempt ?? 1,
    source: 'demo',
  });
  return { order, payment };
}

async function runAll() {
  const response = await request(context.app)
    .post('/api/v1/reconciliation/run')
    .send({ scope: 'all' })
    .expect(200);
  return response.body.data as {
    run: { counts: Record<string, number>; runRef: string };
    statuses: Record<string, number>;
    openExceptionCount: number;
  };
}

describe('reconciliation engine', () => {
  it('matches a captured payment to its order amount and currency', async () => {
    const { payment } = await createPair({
      orderRef: 'ORD-MATCH',
      transactionRef: 'TXN-MATCH',
      providerPaymentId: 'pay_match',
      orderAmountMinor: 149_900,
      paymentAmountMinor: 149_900,
    });

    const result = await runAll();
    expect(result.run.counts.matched).toBe(1);
    expect(result.run.counts.paymentsEvaluated).toBe(1);
    expect(result.statuses.MATCHED).toBe(1);
    expect(result.run.counts.exceptionsCreated).toBe(0);

    const detail = await request(context.app)
      .get(`/api/v1/transactions/${payment.transactionRef}`)
      .expect(200);
    expect(detail.body.data.payment.reconciliationStatus).toBe('MATCHED');
    expect(detail.body.data.orderComparison.amountMatched).toBe(true);
    expect(detail.body.data.exceptions).toHaveLength(0);
  });

  it('creates one explainable shortfall exception and updates it on rerun', async () => {
    await createPair({
      orderRef: 'ORD-SHORT',
      transactionRef: 'TXN-SHORT',
      providerPaymentId: 'pay_short',
      orderAmountMinor: 100_000,
      paymentAmountMinor: 90_000,
    });

    const first = await runAll();
    expect(first.statuses.AMOUNT_MISMATCH).toBe(1);
    expect(first.run.counts.exceptionsCreated).toBe(1);
    expect(first.openExceptionCount).toBe(1);

    const second = await runAll();
    expect(second.run.counts.exceptionsCreated).toBe(0);
    expect(second.run.counts.exceptionsUpdated).toBe(1);

    const list = await request(context.app)
      .get('/api/v1/reconciliation/exceptions?status=OPEN')
      .expect(200);
    expect(list.body.data).toHaveLength(1);
    const exception = list.body.data[0];
    expect(exception.type).toBe('AMOUNT_MISMATCH');
    expect(exception.timesSeen).toBe(2);
    expect(exception.expectedAmountMinor).toBe(100_000);
    expect(exception.observedAmountMinor).toBe(90_000);
    expect(exception.differenceMinor).toBe(10_000);
    expect(exception.evidence.order.orderRef).toBe('ORD-SHORT');
    expect(exception.evidence.payment.providerPaymentId).toBe('pay_short');
    expect(exception.suggestedAction).toBeTruthy();
  });

  it('flags multiple captured payments as DUPLICATE_PAYMENT instead of merging them', async () => {
    const { order } = await createPair({
      orderRef: 'ORD-DUP-PAY',
      transactionRef: 'TXN-DUP-1',
      providerPaymentId: 'pay_dup_1',
      orderAmountMinor: 100_000,
      paymentAmountMinor: 100_000,
    });
    await context.services.repo.createPayment({
      transactionRef: 'TXN-DUP-2',
      orderRef: order.orderRef,
      customerRef: 'CUST-RECON-1',
      amountMinor: 100_000,
      currency: 'INR',
      status: 'PAID',
      provider: 'demo',
      providerPaymentId: 'pay_dup_2',
      method: 'upi',
      attempt: 2,
      source: 'demo',
    });

    const result = await runAll();
    expect(result.statuses.DUPLICATE_PAYMENT).toBe(2);

    const list = await request(context.app)
      .get('/api/v1/reconciliation/exceptions?type=DUPLICATE_PAYMENT')
      .expect(200);
    expect(list.body.data).toHaveLength(1);
    const exception = list.body.data[0];
    expect(exception.observedAmountMinor).toBe(200_000);
    expect(exception.differenceMinor).toBe(100_000);
    expect(exception.evidence.relatedPayments).toHaveLength(2);
  });

  it('detects missing orders and missing payments independently', async () => {
    await context.services.repo.createPayment({
      transactionRef: 'TXN-NO-ORDER',
      orderRef: null,
      customerRef: 'CUST-NO-ORDER',
      amountMinor: 50_000,
      currency: 'INR',
      status: 'PAID',
      provider: 'demo',
      providerPaymentId: 'pay_no_order',
      method: 'card',
      source: 'demo',
    });
    await context.services.repo.createOrder({
      orderRef: 'ORD-NO-PAYMENT',
      customerRef: 'CUST-NO-PAYMENT',
      description: 'Abandoned order',
      amountMinor: 75_000,
      currency: 'INR',
      source: 'demo',
    });

    const result = await runAll();
    expect(result.run.counts.exceptionsCreated).toBe(2);
    expect(result.statuses.MISSING_ORDER).toBe(1);

    const list = await request(context.app)
      .get('/api/v1/reconciliation/exceptions?limit=10')
      .expect(200);
    const types = list.body.data.map((entry: { type: string }) => entry.type).sort();
    expect(types).toEqual(['MISSING_ORDER', 'MISSING_PAYMENT']);
    expect(list.body.meta.counts.open).toBe(2);
  });

  it('detects currency mismatches before comparing amounts', async () => {
    await createPair({
      orderRef: 'ORD-CURRENCY',
      transactionRef: 'TXN-CURRENCY',
      providerPaymentId: 'pay_currency',
      orderAmountMinor: 100_000,
      orderCurrency: 'INR',
      paymentAmountMinor: 100_000,
      paymentCurrency: 'USD',
    });

    const result = await runAll();
    expect(result.statuses.CURRENCY_MISMATCH).toBe(1);

    const list = await request(context.app)
      .get('/api/v1/reconciliation/exceptions?type=CURRENCY_MISMATCH')
      .expect(200);
    expect(list.body.data[0].expectedCurrency).toBe('INR');
    expect(list.body.data[0].observedCurrency).toBe('USD');
  });

  it('marks failed attempts NOT_APPLICABLE without creating an exception', async () => {
    const { payment } = await createPair({
      orderRef: 'ORD-FAILED',
      transactionRef: 'TXN-FAILED',
      providerPaymentId: 'pay_failed',
      orderAmountMinor: 80_000,
      paymentAmountMinor: 80_000,
      status: 'FAILED',
    });

    const result = await runAll();
    expect(result.run.counts.notApplicable).toBe(1);
    expect(result.run.counts.exceptionsCreated).toBe(0);

    const detail = await request(context.app)
      .get(`/api/v1/transactions/${payment.transactionRef}`)
      .expect(200);
    expect(detail.body.data.payment.reconciliationStatus).toBe('NOT_APPLICABLE');
    expect(detail.body.data.payment.settlementStatus).toBe('NOT_APPLICABLE');
  });

  it('preserves an operator resolution when reconciliation reruns', async () => {
    await createPair({
      orderRef: 'ORD-PRESERVE',
      transactionRef: 'TXN-PRESERVE',
      providerPaymentId: 'pay_preserve',
      orderAmountMinor: 100_000,
      paymentAmountMinor: 99_000,
    });
    await runAll();

    const list = await request(context.app)
      .get('/api/v1/reconciliation/exceptions?status=OPEN')
      .expect(200);
    const reference = list.body.data[0].exceptionRef as string;

    await request(context.app)
      .post(`/api/v1/reconciliation/exceptions/${reference}/resolve`)
      .send({
        resolutionType: 'EVIDENCE_VERIFIED',
        note: 'Verified with provider dashboard and accepted the one-rupee shortfall.',
      })
      .expect(200);

    const rerun = await runAll();
    expect(rerun.run.counts.exceptionsCreated).toBe(0);
    expect(rerun.run.counts.exceptionsUpdated).toBe(0);

    const detail = await request(context.app)
      .get(`/api/v1/reconciliation/exceptions/${reference}`)
      .expect(200);
    expect(detail.body.data.exception.status).toBe('RESOLVED');
    expect(detail.body.data.exception.resolutionType).toBe('EVIDENCE_VERIFIED');
    expect(detail.body.data.audits.length).toBeGreaterThanOrEqual(1);
  });
});
