import { createHmac } from 'node:crypto';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  closeTestContext,
  createTestContext,
  type TestContext,
} from './helpers';

const SECRET = 'whsec_test_ledgerlens';

function sign(body: string): string {
  return createHmac('sha256', SECRET).update(body).digest('hex');
}

function capturePayload(paymentId: string, orderId: string) {
  return JSON.stringify({
    entity: 'event',
    event: 'payment.captured',
    created_at: 1_735_689_600,
    payload: {
      payment: {
        entity: {
          id: paymentId,
          order_id: orderId,
          amount: 74_900,
          currency: 'INR',
          status: 'captured',
          method: 'card',
          created_at: 1_735_689_600,
          // Fields LedgerLens must not persist:
          card: { last4: '4242', network: 'visa' },
          email: 'customer@example.test',
          contact: '+910000000000',
        },
      },
    },
  });
}

describe('Razorpay webhook processing', () => {
  let context: TestContext;

  beforeEach(async () => {
    context = await createTestContext({
      DEMO_MODE: 'false',
      DEMO_SEED: 'false',
      PAYMENT_PROVIDER: 'razorpay',
      RAZORPAY_ENVIRONMENT: 'sandbox',
      RAZORPAY_WEBHOOK_SECRET: SECRET,
    });
  });

  afterEach(async () => {
    await closeTestContext(context);
  });

  it('accepts a correctly signed webhook and applies it once', async () => {
    const body = capturePayload('pay_webhook_1', 'order_webhook_1');
    const response = await request(context.app)
      .post('/api/v1/webhooks/razorpay')
      .set('content-type', 'application/json')
      .set('x-razorpay-signature', sign(body))
      .set('x-razorpay-event-id', 'evt_webhook_1')
      .send(body)
      .expect(200);

    expect(response.body.data.status).toBe('processed');
    expect(response.body.data.applied).toBe(true);
    expect(response.body.data.eventKey).toBe('evt_webhook_1');
    expect(response.body.data.transactionRef).toBeTruthy();

    const payment = await context.services.repo.getPaymentByProviderId(
      'razorpay',
      'pay_webhook_1',
    );
    expect(payment).not.toBeNull();
    expect(payment?.status).toBe('PAID');
    expect(payment?.environment).toBe('sandbox');
    expect(payment?.amountMinor).toBe(74_900);
    expect(payment?.metadata.card).toBeUndefined();
    expect(JSON.stringify(payment)).not.toContain('4242');
    expect(JSON.stringify(payment)).not.toContain('customer@example.test');

    const events = await context.services.repo.listEvents(
      { page: 1, limit: 10 },
      'sandbox',
    );
    expect(events.items).toHaveLength(1);
    expect(events.items[0].signatureStatus).toBe('VERIFIED');
    expect(events.items[0].processingStatus).toBe('PROCESSED');
    expect(events.items[0].payloadSummary.card).toBeUndefined();
    expect(events.items[0].payloadSummary.email).toBeUndefined();
  });

  it('records a duplicate delivery without applying a second financial effect', async () => {
    const body = capturePayload('pay_webhook_dup', 'order_webhook_dup');
    const signature = sign(body);

    await request(context.app)
      .post('/api/v1/webhooks/razorpay')
      .set('content-type', 'application/json')
      .set('x-razorpay-signature', signature)
      .set('x-razorpay-event-id', 'evt_webhook_dup')
      .send(body)
      .expect(200);

    const duplicate = await request(context.app)
      .post('/api/v1/webhooks/razorpay')
      .set('content-type', 'application/json')
      .set('x-razorpay-signature', signature)
      .set('x-razorpay-event-id', 'evt_webhook_dup')
      .send(body)
      .expect(200);

    expect(duplicate.body.data.status).toBe('duplicate');
    expect(duplicate.body.data.applied).toBe(false);
    expect(duplicate.body.data.transactionRef).toBeTruthy();

    const events = await context.services.repo.listEvents(
      { page: 1, limit: 10 },
      'sandbox',
    );
    expect(events.items).toHaveLength(1);
    expect(events.items[0].duplicateDeliveryCount).toBe(1);

    const deliveries = await context.services.repo.listDeliveries('evt_webhook_dup');
    expect(deliveries.map((entry) => entry.outcome).sort()).toEqual(['ACCEPTED', 'DUPLICATE']);

    const payments = await context.services.repo.listPaymentsForEnvironment('sandbox');
    expect(payments).toHaveLength(1);
    expect(payments[0].amountMinor).toBe(74_900);
  });

  it('rejects an invalid signature and retains an audit record', async () => {
    const body = capturePayload('pay_webhook_bad', 'order_webhook_bad');
    const response = await request(context.app)
      .post('/api/v1/webhooks/razorpay')
      .set('content-type', 'application/json')
      .set('x-razorpay-signature', 'deadbeef')
      .set('x-razorpay-event-id', 'evt_webhook_bad')
      .send(body)
      .expect(401);

    expect(response.body.error.code).toBe('INVALID_SIGNATURE');

    const payments = await context.services.repo.listPaymentsForEnvironment('sandbox');
    expect(payments).toHaveLength(0);

    const deliveries = await context.services.repo.countCollection('event_deliveries', {
      outcome: 'REJECTED_SIGNATURE',
    });
    expect(deliveries).toBe(1);

    const events = await context.services.repo.listEvents(
      { page: 1, limit: 10 },
      'sandbox',
    );
    expect(events.items).toHaveLength(1);
    expect(events.items[0].signatureStatus).toBe('INVALID');
    expect(events.items[0].type).toBe('webhook.signature_rejected');
    expect(events.items[0].applied).toBe(false);
  });

  it('refuses webhook traffic when the provider or secret is not configured', async () => {
    await closeTestContext(context);
    context = await createTestContext({ DEMO_MODE: 'true', PAYMENT_PROVIDER: 'demo' });

    const body = capturePayload('pay_webhook_disabled', 'order_webhook_disabled');
    const response = await request(context.app)
      .post('/api/v1/webhooks/razorpay')
      .set('content-type', 'application/json')
      .set('x-razorpay-signature', sign(body))
      .send(body)
      .expect(503);
    expect(response.body.error.code).toBe('PROVIDER_DISABLED');
  });
});
