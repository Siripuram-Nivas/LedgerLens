import type {
  ExceptionStatus,
  ExceptionType,
  PaymentStatus,
  ReconciliationStatus,
  RefundRecordStatus,
  RefundStatus,
  SettlementRecordStatus,
  SettlementStatus,
} from '../types/api';

export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'brand' | 'violet';

export interface StatusMeta {
  label: string;
  tone: BadgeTone;
  description: string;
}

export const paymentStatusMeta: Record<PaymentStatus, StatusMeta> = {
  PENDING: {
    label: 'Pending',
    tone: 'neutral',
    description: 'Payment created; no provider confirmation yet.',
  },
  PROCESSING: {
    label: 'Processing',
    tone: 'info',
    description: 'Provider is processing or has authorized the payment.',
  },
  PAID: {
    label: 'Paid',
    tone: 'success',
    description: 'Capture is confirmed by a trusted payment event.',
  },
  FAILED: {
    label: 'Failed',
    tone: 'danger',
    description: 'The payment attempt failed. No captured funds.',
  },
  CANCELLED: {
    label: 'Cancelled',
    tone: 'neutral',
    description: 'The payment attempt was cancelled. No captured funds.',
  },
};

export const settlementStatusMeta: Record<SettlementStatus, StatusMeta> = {
  NOT_APPLICABLE: {
    label: 'Not applicable',
    tone: 'neutral',
    description: 'No settlement can exist for this failed or cancelled attempt.',
  },
  NOT_STARTED: {
    label: 'Not started',
    tone: 'neutral',
    description: 'No settlement record references this payment yet.',
  },
  PENDING: {
    label: 'Pending',
    tone: 'warning',
    description: 'A settlement batch exists but has not been confirmed.',
  },
  SETTLED: {
    label: 'Settled',
    tone: 'success',
    description: 'A trusted settlement record confirms settlement.',
  },
  FAILED: {
    label: 'Failed',
    tone: 'danger',
    description: 'A settlement failure is recorded. Payment capture is unchanged.',
  },
  UNKNOWN: {
    label: 'Unknown',
    tone: 'neutral',
    description: 'Settlement state cannot be determined from available records.',
  },
};

export const reconciliationStatusMeta: Record<ReconciliationStatus, StatusMeta> = {
  MATCHED: {
    label: 'Matched',
    tone: 'success',
    description: 'Order and captured payment amounts/currencies agree.',
  },
  PENDING_RECONCILIATION: {
    label: 'Pending recon',
    tone: 'info',
    description: 'A financial outcome is not final yet; awaiting reconciliation.',
  },
  MISSING_ORDER: {
    label: 'Missing order',
    tone: 'danger',
    description: 'A financially relevant payment has no linked order.',
  },
  MISSING_PAYMENT: {
    label: 'Missing payment',
    tone: 'danger',
    description: 'An order has no payment attempt.',
  },
  AMOUNT_MISMATCH: {
    label: 'Amount mismatch',
    tone: 'danger',
    description: 'Captured amount does not equal the order total.',
  },
  CURRENCY_MISMATCH: {
    label: 'Currency mismatch',
    tone: 'danger',
    description: 'Payment and order currencies differ.',
  },
  DUPLICATE_EVENT: {
    label: 'Duplicate event',
    tone: 'warning',
    description: 'Distinct event IDs describe the same capture.',
  },
  DUPLICATE_PAYMENT: {
    label: 'Duplicate payment',
    tone: 'danger',
    description: 'Multiple captures exceed the order total.',
  },
  UNDER_REVIEW: {
    label: 'Under review',
    tone: 'warning',
    description: 'An operator is investigating the discrepancy.',
  },
  NOT_APPLICABLE: {
    label: 'Not applicable',
    tone: 'neutral',
    description: 'Failed or cancelled attempt with no captured funds.',
  },
};

export const refundStatusMeta: Record<RefundStatus, StatusMeta> = {
  NONE: { label: 'No refund', tone: 'neutral', description: 'No refund record exists.' },
  REQUESTED: {
    label: 'Refund requested',
    tone: 'info',
    description: 'Request recorded; not completed.',
  },
  PROCESSING: {
    label: 'Refund processing',
    tone: 'warning',
    description: 'Provider processing is underway; not completed.',
  },
  PARTIALLY_REFUNDED: {
    label: 'Partially refunded',
    tone: 'violet',
    description: 'Part of the captured amount has been refunded.',
  },
  REFUNDED: { label: 'Refunded', tone: 'success', description: 'The refund is complete.' },
  FAILED: {
    label: 'Refund failed',
    tone: 'danger',
    description: 'The refund did not complete.',
  },
};

export const refundRecordStatusMeta: Record<RefundRecordStatus, StatusMeta> = {
  REQUESTED: refundStatusMeta.REQUESTED,
  PROCESSING: refundStatusMeta.PROCESSING,
  PARTIALLY_REFUNDED: refundStatusMeta.PARTIALLY_REFUNDED,
  REFUNDED: refundStatusMeta.REFUNDED,
  FAILED: refundStatusMeta.FAILED,
};

export const settlementRecordStatusMeta: Record<SettlementRecordStatus, StatusMeta> = {
  PENDING: settlementStatusMeta.PENDING,
  SETTLED: settlementStatusMeta.SETTLED,
  FAILED: settlementStatusMeta.FAILED,
  UNKNOWN: settlementStatusMeta.UNKNOWN,
};

export const exceptionStatusMeta: Record<ExceptionStatus, StatusMeta> = {
  OPEN: { label: 'Open', tone: 'danger', description: 'Needs investigation.' },
  UNDER_REVIEW: { label: 'Under review', tone: 'warning', description: 'Assigned for review.' },
  RESOLVED: { label: 'Resolved', tone: 'success', description: 'Resolution recorded with a note.' },
};

export const exceptionTypeLabel: Record<ExceptionType, string> = {
  MISSING_ORDER: 'Missing order',
  MISSING_PAYMENT: 'Missing payment',
  AMOUNT_MISMATCH: 'Amount mismatch',
  CURRENCY_MISMATCH: 'Currency mismatch',
  DUPLICATE_EVENT: 'Duplicate event',
  DUPLICATE_PAYMENT: 'Duplicate payment',
};

export const exceptionTypeTone: Record<ExceptionType, BadgeTone> = {
  MISSING_ORDER: 'danger',
  MISSING_PAYMENT: 'danger',
  AMOUNT_MISMATCH: 'danger',
  CURRENCY_MISMATCH: 'danger',
  DUPLICATE_EVENT: 'warning',
  DUPLICATE_PAYMENT: 'danger',
};

export const statusChartColors = {
  PENDING: '#94a3b8',
  PROCESSING: '#0284c7',
  PAID: '#059669',
  FAILED: '#dc2626',
  CANCELLED: '#cbd5e1',
  SETTLED: '#059669',
  NOT_STARTED: '#cbd5e1',
  NOT_APPLICABLE: '#e2e8f0',
  UNKNOWN: '#94a3b8',
} as const;
