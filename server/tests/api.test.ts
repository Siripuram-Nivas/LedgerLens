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

async function seedPayment(options: {
  transactionRef: string;
  providerPaymentId: string;
  status: 'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED' | 'CANCELLED';
  amountMinor?: number;
  currency?: string;
  orderRef?: string | null;
}) {
  return context.services.repo.createPayment({
    transactionRef: options.transactionRef,
    orderRef: options.orderRef ?? null,
    customerRef: 'CUST-API-1',
    amountMinor: options.amountMinor ?? 100_000,
    currency: options.currency ?? 'INR',
    status: options.status,
    provider: 'demo',
    providerPaymentId: options.providerPaymentId,
    method: 'card',
    source: 'demo',
  });
}

describe('API surface', () => {
  it('reports health and explicit persistence information', async () => {
    const response = await request(context.app).get('/api/v1/health').expect(200);
    expect(response.body.data.status).toBe('ok');
    expect(response.body.data.persistence).toBe('sqlite');
    expect(response.body.data.demoMode).toBe(true);
    expect(response.body.data.environment).toBe('demo');
    expect(typeof response.body.data.dbLatencyMs).toBe('number');
  });

  it('allows same-origin requests even when the port is not in CORS_ORIGINS', async () => {
    const response = await request(context.app)
      .get('/api/v1/health')
      .set('Host', 'ledgerlens.test')
      .set('Origin', 'http://ledgerlens.test')
      .expect(200);
    expect(response.headers['access-control-allow-origin']).toBe('http://ledgerlens.test');
  });

  it('rejects cross-origin requests from unlisted origins', async () => {
    const response = await request(context.app)
      .get('/api/v1/health')
      .set('Origin', 'http://evil.example')
      .expect(403);
    expect(response.body.error.code).toBe('CORS_ORIGIN_DENIED');
  });

  it('exposes meta without secrets and labels demo mode clearly', async () => {
    const response = await request(context.app).get('/api/v1/meta').expect(200);
    const meta = response.body.data;
    expect(meta.demoMode).toBe(true);
    expect(meta.persistence).toBe('sqlite');
    expect(meta.accessControl).toBe('none');
    expect(meta.accessControlNote).toMatch(/without authentication/i);
    expect(meta.webhook.providerEnabled).toBe(false);
    expect(meta.webhook.secretConfigured).toBe(false);
    expect(meta.webhook.endpoint).toBe('POST /api/v1/webhooks/razorpay');
    expect(meta.demo.resetConfirmation).toBe('RESET DEMO DATA');
    expect(meta.reconciliationRules.length).toBeGreaterThan(5);
    expect(JSON.stringify(meta)).not.toMatch(/secret\s*[:=]\s*["'][^"']+["']/i);
  });

  it('paginates transactions and applies status filters', async () => {
    await seedPayment({
      transactionRef: 'TXN-API-1',
      providerPaymentId: 'pay_api_1',
      status: 'PAID',
    });
    await seedPayment({
      transactionRef: 'TXN-API-2',
      providerPaymentId: 'pay_api_2',
      status: 'PENDING',
    });
    await seedPayment({
      transactionRef: 'TXN-API-3',
      providerPaymentId: 'pay_api_3',
      status: 'FAILED',
    });

    const first = await request(context.app)
      .get('/api/v1/transactions?page=1&limit=2')
      .expect(200);
    expect(first.body.meta.total).toBe(3);
    expect(first.body.meta.totalPages).toBe(2);
    expect(first.body.meta.page).toBe(1);
    expect(first.body.data).toHaveLength(2);

    const second = await request(context.app)
      .get('/api/v1/transactions?page=2&limit=2')
      .expect(200);
    expect(second.body.data).toHaveLength(1);

    const paid = await request(context.app)
      .get('/api/v1/transactions?status=PAID')
      .expect(200);
    expect(paid.body.meta.total).toBe(1);
    expect(paid.body.data[0].transactionRef).toBe('TXN-API-1');
  });

  it('search finds a transaction by reference and rejects invalid filters', async () => {
    await seedPayment({
      transactionRef: 'TXN-SEARCHABLE',
      providerPaymentId: 'pay_searchable',
      status: 'PAID',
    });

    const search = await request(context.app)
      .get('/api/v1/transactions?q=searchable')
      .expect(200);
    expect(search.body.meta.total).toBe(1);
    expect(search.body.data[0].transactionRef).toBe('TXN-SEARCHABLE');

    const invalid = await request(context.app)
      .get('/api/v1/transactions?limit=101')
      .expect(400);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');
    expect(invalid.body.error.details).toBeTruthy();
  });

  it('returns structured 404s without leaking internals', async () => {
    const response = await request(context.app)
      .get('/api/v1/transactions/TXN-DOES-NOT-EXIST')
      .expect(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
    expect(response.body.error.message).toContain('TXN-DOES-NOT-EXIST');
    expect(response.body.error.requestId).toBeTruthy();
  });

  it('groups dashboard value by currency instead of summing across currencies', async () => {
    await seedPayment({
      transactionRef: 'TXN-INR',
      providerPaymentId: 'pay_inr',
      status: 'PAID',
      amountMinor: 100_000,
      currency: 'INR',
    });
    await seedPayment({
      transactionRef: 'TXN-USD',
      providerPaymentId: 'pay_usd',
      status: 'PAID',
      amountMinor: 20_000,
      currency: 'USD',
    });

    const response = await request(context.app)
      .get('/api/v1/dashboard/summary?range=30d')
      .expect(200);
    const metrics = response.body.data.metrics;
    const inr = metrics.valueByCurrency.find(
      (entry: { currency: string }) => entry.currency === 'INR',
    );
    const usd = metrics.valueByCurrency.find(
      (entry: { currency: string }) => entry.currency === 'USD',
    );
    expect(inr.amountMinor).toBe(100_000);
    expect(usd.amountMinor).toBe(20_000);
    expect(metrics.valueProcessedCurrency).toBe('INR');
    expect(metrics.valueProcessedMinor).toBe(100_000);
    expect(metrics.successfulPayments).toBe(2);
    expect(metrics.totalTransactions).toBe(2);
    expect(response.body.data.scopeNotes.simulated).toBe(true);
  });

  it('lists runs and supports a payment-scoped reconciliation run', async () => {
    const order = await context.services.repo.createOrder({
      orderRef: 'ORD-SCOPED',
      customerRef: 'CUST-SCOPED',
      description: 'Scoped order',
      amountMinor: 42_000,
      currency: 'INR',
      source: 'demo',
    });
    const payment = await seedPayment({
      transactionRef: 'TXN-SCOPED',
      providerPaymentId: 'pay_scoped',
      status: 'PAID',
      amountMinor: 42_000,
      orderRef: order.orderRef,
    });

    const response = await request(context.app)
      .post('/api/v1/reconciliation/run')
      .send({ scope: 'payment', transactionRef: payment.transactionRef })
      .expect(200);
    expect(response.body.data.run.scope).toBe('payment:TXN-SCOPED');
    expect(response.body.data.run.counts.matched).toBe(1);

    const runs = await request(context.app).get('/api/v1/reconciliation/runs').expect(200);
    expect(runs.body.data.length).toBe(1);
    expect(runs.body.data[0].status).toBe('COMPLETED');
  });

  it('validates exception resolution notes', async () => {
    await context.services.repo.createPayment({
      transactionRef: 'TXN-NO-ORDER-RESOLVE',
      orderRef: null,
      customerRef: 'CUST-RESOLVE',
      amountMinor: 10_000,
      currency: 'INR',
      status: 'PAID',
      provider: 'demo',
      providerPaymentId: 'pay_resolve',
      method: 'card',
      source: 'demo',
    });
    await request(context.app)
      .post('/api/v1/reconciliation/run')
      .send({ scope: 'all' })
      .expect(200);
    const list = await request(context.app)
      .get('/api/v1/reconciliation/exceptions')
      .expect(200);
    const reference = list.body.data[0].exceptionRef as string;

    const invalid = await request(context.app)
      .post(`/api/v1/reconciliation/exceptions/${reference}/resolve`)
      .send({ resolutionType: 'EVIDENCE_VERIFIED', note: 'short' })
      .expect(400);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');
  });
});
