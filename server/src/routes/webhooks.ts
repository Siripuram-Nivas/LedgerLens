import { Router, raw } from 'express';
import type { Services } from '../services/container';
import {
  normalizeRazorpayEvent,
  verifyRazorpaySignature,
  type RazorpayWebhookBody,
} from '../providers/razorpay';
import { ApiError } from '../utils/http';
import { nowIso } from '../utils/dates';

export function webhookRouter(services: Services) {
  const router = Router();
  const { config, logger } = services;

  router.post(
    '/webhooks/razorpay',
    raw({ type: 'application/json', limit: '200kb' }),
    async (req, res, next) => {
      try {
        if (config.PAYMENT_PROVIDER !== 'razorpay') {
          throw new ApiError(
            503,
            'PROVIDER_DISABLED',
            'The Razorpay adapter is not enabled. Set PAYMENT_PROVIDER=razorpay and configure the webhook secret.',
          );
        }
        if (!config.RAZORPAY_WEBHOOK_SECRET) {
          throw new ApiError(
            503,
            'WEBHOOK_NOT_CONFIGURED',
            'RAZORPAY_WEBHOOK_SECRET is not configured. Signature verification is never skipped.',
          );
        }
        const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from('');
        const signature = req.header('x-razorpay-signature');
        const eventId = req.header('x-razorpay-event-id') ?? undefined;

        if (!verifyRazorpaySignature(rawBody, signature, config.RAZORPAY_WEBHOOK_SECRET)) {
          logger.warn({ eventId, path: req.path }, 'Razorpay webhook rejected: invalid signature');
          await services.events.recordRejectedDelivery({
            eventKey: eventId ?? null,
            environment: config.RAZORPAY_ENVIRONMENT,
            source: 'razorpay',
            signatureStatus: 'INVALID',
            note: 'Invalid HMAC signature. Payload was not parsed or applied.',
          });
          throw new ApiError(401, 'INVALID_SIGNATURE', 'Webhook signature verification failed');
        }

        let body: RazorpayWebhookBody;
        try {
          body = JSON.parse(rawBody.toString('utf8')) as RazorpayWebhookBody;
        } catch {
          throw new ApiError(400, 'INVALID_JSON', 'The webhook body is not valid JSON');
        }
        if (!body || typeof body !== 'object' || typeof body.event !== 'string') {
          throw new ApiError(400, 'INVALID_EVENT', 'The webhook body does not contain an event type');
        }

        const normalized = normalizeRazorpayEvent(body, {
          eventIdHeader: eventId,
          config,
          receivedAt: nowIso(),
        });
        const result = await services.events.process(normalized);
        res.status(200).json({
          data: {
            status: result.duplicate ? 'duplicate' : 'processed',
            eventKey: result.event.eventKey,
            transactionRef: result.transactionRef,
            applied: result.applied,
            reconciliationRunRef: result.reconciliationRunRef,
          },
        });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
