import { z } from 'zod';
import {
  EXCEPTION_STATUSES,
  EXCEPTION_TYPES,
  PAYMENT_STATUSES,
  RECONCILIATION_STATUSES,
  REFUND_STATUSES,
  SETTLEMENT_RECORD_STATUSES,
  SETTLEMENT_STATUSES,
} from '../domain/types';

const isoDate = z
  .string()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Must be an ISO date or timestamp');

export const pageSchema = z.coerce.number().int().min(1).max(100_000).default(1);
export const limitSchema = z.coerce.number().int().min(1).max(100).default(20);
export const searchSchema = z.string().trim().max(120).optional();
export const isoDateSchema = isoDate.optional();
export const sortDirSchema = z.enum(['asc', 'desc']).default('desc');

export const transactionListSchema = z.object({
  page: pageSchema,
  limit: limitSchema,
  q: searchSchema,
  status: z.enum(PAYMENT_STATUSES).optional(),
  settlementStatus: z.enum(SETTLEMENT_STATUSES).optional(),
  reconciliationStatus: z.enum(RECONCILIATION_STATUSES).optional(),
  refundStatus: z.enum(REFUND_STATUSES).optional(),
  from: isoDateSchema,
  to: isoDateSchema,
  sortBy: z.enum(['createdAt', 'updatedAt', 'amount', 'status']).default('createdAt'),
  sortDir: sortDirSchema,
});

export const eventListSchema = z.object({
  page: pageSchema,
  limit: limitSchema,
  q: searchSchema,
  processingStatus: z.enum(['RECEIVED', 'PROCESSED', 'FAILED']).optional(),
  type: z.string().trim().max(100).optional(),
  duplicateOnly: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
  from: isoDateSchema,
  to: isoDateSchema,
});

export const exceptionListSchema = z.object({
  page: pageSchema,
  limit: limitSchema,
  q: searchSchema,
  type: z.enum(EXCEPTION_TYPES).optional(),
  status: z.enum(EXCEPTION_STATUSES).optional(),
  from: isoDateSchema,
  to: isoDateSchema,
  sortBy: z.enum(['amountDifference', 'createdAt', 'lastDetectedAt']).default('createdAt'),
  sortDir: sortDirSchema,
});

export const settlementListSchema = z.object({
  page: pageSchema,
  limit: limitSchema,
  q: searchSchema,
  status: z.enum(SETTLEMENT_RECORD_STATUSES).optional(),
  from: isoDateSchema,
  to: isoDateSchema,
});

export const refundListSchema = z.object({
  page: pageSchema,
  limit: limitSchema,
  q: searchSchema,
  status: z.enum(REFUND_STATUSES).optional(),
  from: isoDateSchema,
  to: isoDateSchema,
});

export const dashboardQuerySchema = z.object({
  range: z.enum(['24h', '7d', '30d', 'custom']).default('7d'),
  from: isoDateSchema,
  to: isoDateSchema,
});

export const runReconciliationSchema = z
  .object({
    transactionRef: z.string().trim().min(1).max(120).optional(),
    scope: z.enum(['all', 'payment']).default('all'),
  })
  .refine((value) => value.scope !== 'payment' || Boolean(value.transactionRef), {
    message: 'transactionRef is required for a payment-scoped run',
    path: ['transactionRef'],
  });

export const assignExceptionSchema = z.object({
  assignedTo: z.string().trim().min(2).max(80),
  note: z.string().trim().max(300).optional(),
});

export const resolveExceptionSchema = z.object({
  resolutionType: z.enum([
    'EVIDENCE_VERIFIED',
    'FALSE_POSITIVE',
    'ADJUSTED_EXTERNALLY',
    'ACCEPTED_AS_IS',
  ]),
  note: z.string().trim().min(8).max(1000),
});

export const demoScenarioSchema = z.object({
  scenario: z.enum([
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
  ]),
  amountMinor: z.number().int().positive().max(10_000_000_000_000).optional(),
  note: z.string().trim().max(200).optional(),
});

export const demoResetSchema = z.object({
  confirm: z.string().max(50).optional(),
});
