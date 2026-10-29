import { createHmac, timingSafeEqual } from 'node:crypto';
import type { NormalizedLedgerEvent } from '../services/eventService';
import type { AppConfig } from '../config';

export interface RazorpayWebhookBody {
  entity?: string;
  account_id?: string;
  event?: string;
  contains?: string[];
  payload?: Record<string, { entity?: Record<string, unknown> }>;
  created_at?: number;
  id?: string;
}

export function verifyRazorpaySignature(
  rawBody: Buffer | string,
  signature: string | undefined,
  secret: string,
): boolean {
  if (!signature || !secret) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  const providedBuffer = Buffer.from(signature.trim(), 'utf8');
  if (expectedBuffer.length !== providedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, providedBuffer);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asAmount(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : null;
}

function unixToIso(value: unknown): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const millis = value < 1_000_000_000_000 ? value * 1000 : value;
  const date = new Date(millis);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * Maps only the fields LedgerLens needs. Card data, contact details and raw
 * payloads are intentionally excluded from persistence.
 */
export function normalizeRazorpayEvent(
  body: RazorpayWebhookBody,
  options: {
    eventIdHeader: string | undefined;
    config: AppConfig;
    receivedAt: string;
  },
): NormalizedLedgerEvent {
  const eventType = body.event ?? 'unknown';
  const paymentEntity = body.payload?.payment?.entity;
  const orderEntity = body.payload?.order?.entity;
  const refundEntity = body.payload?.refund?.entity;

  const paymentRef =
    asString(paymentEntity?.id) ?? asString(refundEntity?.payment_id) ?? null;
  const orderRef =
    asString(paymentEntity?.order_id) ??
    asString(orderEntity?.id) ??
    asString(refundEntity?.order_id) ??
    null;

  const amountMinor =
    asAmount(paymentEntity?.amount) ?? asAmount(refundEntity?.amount) ?? null;
  const currencyRaw =
    asString(paymentEntity?.currency) ?? asString(refundEntity?.currency) ?? null;
  const currency = currencyRaw ? currencyRaw.toUpperCase() : null;
  const providerStatus =
    asString(paymentEntity?.status) ?? asString(refundEntity?.status) ?? null;
  const providerCreatedAt =
    unixToIso(paymentEntity?.created_at) ??
    unixToIso(refundEntity?.created_at) ??
    unixToIso(body.created_at);

  const refundId = asString(refundEntity?.id);
  const headerId = options.eventIdHeader?.trim();
  const bodyId = body.id?.trim();
  // Razorpay does not guarantee a body ID for every webhook. Prefer the
  // X-Razorpay-Event-Id header, then the body id, then a deterministic
  // composite key built from provider identifiers (not arbitrary JSON).
  const fallbackKey = [
    'razorpay',
    eventType,
    paymentRef ?? refundId ?? 'unknown',
    providerStatus ?? 'unknown',
    providerCreatedAt ?? options.receivedAt,
  ].join(':');
  const eventKey = headerId || bodyId || fallbackKey;

  return {
    eventKey,
    providerEventId: headerId || bodyId || fallbackKey,
    provider: 'razorpay',
    type: eventType,
    providerStatus,
    paymentRef,
    orderRef,
    transactionRef: null,
    amountMinor,
    currency,
    providerCreatedAt: providerCreatedAt ?? options.receivedAt,
    signatureStatus: 'VERIFIED',
    source: 'razorpay',
    environment: options.config.RAZORPAY_ENVIRONMENT,
    customerRef: null,
    method: asString(paymentEntity?.method),
    payloadSummary: {
      event: eventType,
      paymentId: paymentRef,
      orderId: orderRef,
      refundId,
      status: providerStatus,
      amountMinor,
      currency,
      method: asString(paymentEntity?.method),
      entity: body.entity ?? null,
    },
  };
}
