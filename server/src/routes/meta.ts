import { Router } from 'express';
import type { Services } from '../services/container';
import { DEMO_SCENARIOS, RESET_CONFIRMATION } from '../services/demoService';
import {
  PAYMENT_STATUSES,
  REFUND_STATUSES,
  RECONCILIATION_STATUSES,
  SETTLEMENT_STATUSES,
} from '../domain/types';

export function metaRouter(services: Services) {
  const router = Router();
  const { config } = services;

  router.get('/meta', (_req, res) => {
    res.json({
      data: {
        name: 'LedgerLens',
        tagline: 'Every payment. Every event. One clear picture.',
        version: config.version,
        environment: config.appEnvironment,
        demoMode: config.DEMO_MODE,
        provider: config.PAYMENT_PROVIDER,
        razorpayEnvironment: config.RAZORPAY_ENVIRONMENT,
        persistence: services.store.engine,
        persistenceLabel:
          services.store.engine === 'sqlite'
            ? 'SQLite file-backed local demo store'
            : 'MongoDB via Mongoose',
        accessControl: 'none',
        accessControlNote:
          'LedgerLens runs as a local/demo prototype without authentication. Do not deploy it with financial data until access control is added.',
        realtime: {
          transport: 'socket.io',
          namespace: config.realtimeNamespace,
          path: '/socket.io',
          fallback: '15-second polling when the socket is disconnected',
        },
        webhook: {
          endpoint: 'POST /api/v1/webhooks/razorpay',
          providerEnabled: config.PAYMENT_PROVIDER === 'razorpay',
          secretConfigured: Boolean(config.RAZORPAY_WEBHOOK_SECRET),
          signature: 'HMAC-SHA256 over the unmodified request body (X-Razorpay-Signature)',
          idempotency:
            'X-Razorpay-Event-Id header, then body id, then a deterministic provider composite key. Duplicate deliveries are recorded without repeating financial effects.',
          note:
            'The real webhook endpoint refuses requests when the provider or webhook secret is not configured. Signature verification is never skipped.',
        },
        demo: {
          enabled: config.DEMO_MODE,
          scenarios: DEMO_SCENARIOS,
          resetConfirmation: RESET_CONFIRMATION,
          note: 'Demo records are tagged source=demo and environment=demo. Reset only deletes demo records.',
        },
        statusModel: {
          payment: PAYMENT_STATUSES,
          settlement: SETTLEMENT_STATUSES,
          reconciliation: RECONCILIATION_STATUSES,
          refund: REFUND_STATUSES,
          note: 'Payment, settlement, reconciliation and refund are independent dimensions. Reconciliation adds NOT_APPLICABLE for failed/cancelled attempts that have no captured funds, and DUPLICATE_PAYMENT for multiple captures against one order.',
        },
        reconciliationRules: [
          'Payments are matched to orders by stable order reference; provider payment IDs are never merged by amount alone.',
          'Captured amount and currency are compared in integer minor units.',
          'Multiple payment attempts are grouped by order; only PAID attempts count as captured funds.',
          'A payment with no linked order is MISSING_ORDER; an order with no payment attempt is MISSING_PAYMENT.',
          'Two or more captured payments over the order total are flagged DUPLICATE_PAYMENT, not silently merged.',
          'Distinct capture event IDs for one payment are DUPLICATE_EVENT; repeated deliveries of one event ID are idempotent duplicates in the event log.',
          'Settlement success is never inferred from payment success.',
          'A failed/cancelled attempt has NOT_APPLICABLE reconciliation status because no captured funds exist.',
          'Re-running reconciliation updates active exceptions in place and never duplicates them; operator resolutions are preserved.',
        ],
        limits: {
          paginationMax: 100,
          requestBody: config.JSON_BODY_LIMIT,
          rateLimitWindowMs: config.RATE_LIMIT_WINDOW_MS,
          rateLimitMax: config.RATE_LIMIT_MAX,
        },
        timestamp: new Date().toISOString(),
      },
    });
  });

  return router;
}
