export const PAYMENT_STATUSES = ['PENDING', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const SETTLEMENT_STATUSES = [
  'NOT_APPLICABLE',
  'NOT_STARTED',
  'PENDING',
  'SETTLED',
  'FAILED',
  'UNKNOWN',
] as const;
export type SettlementStatus = (typeof SETTLEMENT_STATUSES)[number];

/**
 * The public status model deliberately adds NOT_APPLICABLE to the requested
 * reconciliation states. Failed/cancelled attempts have no captured money to
 * reconcile; calling them PENDING or MATCHED would misstate financial reality.
 */
export const RECONCILIATION_STATUSES = [
  'MATCHED',
  'PENDING_RECONCILIATION',
  'MISSING_ORDER',
  'MISSING_PAYMENT',
  'AMOUNT_MISMATCH',
  'CURRENCY_MISMATCH',
  'DUPLICATE_EVENT',
  'DUPLICATE_PAYMENT',
  'UNDER_REVIEW',
  'NOT_APPLICABLE',
] as const;
export type ReconciliationStatus = (typeof RECONCILIATION_STATUSES)[number];

export const EXCEPTION_TYPES = [
  'MISSING_ORDER',
  'MISSING_PAYMENT',
  'AMOUNT_MISMATCH',
  'CURRENCY_MISMATCH',
  'DUPLICATE_EVENT',
  'DUPLICATE_PAYMENT',
] as const;
export type ExceptionType = (typeof EXCEPTION_TYPES)[number];

export const EXCEPTION_STATUSES = ['OPEN', 'UNDER_REVIEW', 'RESOLVED'] as const;
export type ExceptionStatus = (typeof EXCEPTION_STATUSES)[number];

export const REFUND_STATUSES = [
  'NONE',
  'REQUESTED',
  'PROCESSING',
  'PARTIALLY_REFUNDED',
  'REFUNDED',
  'FAILED',
] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];

export const REFUND_RECORD_STATUSES = [
  'REQUESTED',
  'PROCESSING',
  'PARTIALLY_REFUNDED',
  'REFUNDED',
  'FAILED',
] as const;
export type RefundRecordStatus = (typeof REFUND_RECORD_STATUSES)[number];

export const SETTLEMENT_RECORD_STATUSES = [
  'PENDING',
  'SETTLED',
  'FAILED',
  'UNKNOWN',
] as const;
export type SettlementRecordStatus = (typeof SETTLEMENT_RECORD_STATUSES)[number];

export type Environment = 'demo' | 'sandbox' | 'live';
export type Source = 'demo' | 'razorpay';
export type PaymentProvider = 'demo' | 'razorpay';

export type EventProcessingStatus = 'RECEIVED' | 'PROCESSED' | 'FAILED';
export type DeliveryOutcome =
  | 'ACCEPTED'
  | 'DUPLICATE'
  | 'REPROCESSED'
  | 'REJECTED_SIGNATURE'
  | 'INVALID';
export type SignatureStatus = 'VERIFIED' | 'SIMULATED' | 'INVALID' | 'NOT_AVAILABLE';

export interface Order {
  id: string;
  orderRef: string;
  customerRef: string;
  description: string;
  amountMinor: number;
  currency: string;
  source: Source;
  environment: Environment;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  transactionRef: string;
  orderRef: string | null;
  customerRef: string;
  amountMinor: number;
  currency: string;
  status: PaymentStatus;
  settlementStatus: SettlementStatus;
  reconciliationStatus: ReconciliationStatus;
  refundStatus: RefundStatus;
  provider: PaymentProvider;
  providerPaymentId: string;
  method: string;
  attempt: number;
  source: Source;
  environment: Environment;
  lastEventAt: string | null;
  lastEventKey: string | null;
  metadata: Record<string, string | number | boolean | null>;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentEvent {
  id: string;
  eventKey: string;
  provider: PaymentProvider;
  providerEventId: string;
  type: string;
  providerStatus: string | null;
  paymentRef: string | null;
  orderRef: string | null;
  transactionRef: string | null;
  amountMinor: number | null;
  currency: string | null;
  receivedAt: string;
  providerCreatedAt: string | null;
  signatureStatus: SignatureStatus;
  processingStatus: EventProcessingStatus;
  processingError: string | null;
  processingNote: string | null;
  applied: boolean;
  duplicateDeliveryCount: number;
  lastDeliveryAt: string;
  reconciliationTriggered: boolean;
  source: Source;
  environment: Environment;
  payloadSummary: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface EventDelivery {
  id: string;
  deliveryId: string;
  eventKey: string | null;
  receivedAt: string;
  outcome: DeliveryOutcome;
  signatureStatus: SignatureStatus;
  source: Source;
  environment: Environment;
  note: string | null;
}

export interface ExceptionEvidence {
  order: Pick<Order, 'orderRef' | 'amountMinor' | 'currency' | 'customerRef'> | null;
  payment: Pick<
    Payment,
    | 'transactionRef'
    | 'providerPaymentId'
    | 'amountMinor'
    | 'currency'
    | 'status'
    | 'orderRef'
  > | null;
  relatedPayments?: Array<
    Pick<Payment, 'transactionRef' | 'amountMinor' | 'currency' | 'status' | 'createdAt'>
  >;
  eventKeys?: string[];
}

export interface ReconciliationException {
  id: string;
  exceptionRef: string;
  fingerprint: string;
  runId: string | null;
  type: ExceptionType;
  status: ExceptionStatus;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  paymentRef: string | null;
  transactionRef: string | null;
  orderRef: string | null;
  expectedAmountMinor: number | null;
  observedAmountMinor: number | null;
  differenceMinor: number | null;
  expectedCurrency: string | null;
  observedCurrency: string | null;
  evidence: ExceptionEvidence;
  explanation: string;
  suggestedAction: string;
  assignedTo: string | null;
  resolutionType: string | null;
  resolutionNote: string | null;
  firstDetectedAt: string;
  lastDetectedAt: string;
  timesSeen: number;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  environment: Environment;
  source: Source;
}

export interface ReconciliationRun {
  id: string;
  runRef: string;
  environment: Environment;
  scope: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  triggeredBy: string;
  startedAt: string;
  finishedAt: string | null;
  counts: {
    paymentsEvaluated: number;
    ordersEvaluated: number;
    matched: number;
    pending: number;
    notApplicable: number;
    exceptionsCreated: number;
    exceptionsUpdated: number;
    exceptionsAutoResolved: number;
    duplicateEventsDetected: number;
  };
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Settlement {
  id: string;
  settlementRef: string;
  providerSettlementRef: string | null;
  status: SettlementRecordStatus;
  paymentRefs: string[];
  transactionRefs: string[];
  grossMinor: number;
  feesMinor: number | null;
  netMinor: number | null;
  currency: string;
  expectedAt: string | null;
  settledAt: string | null;
  feesSource: 'SIMULATED_FIXTURE' | 'PROVIDER' | null;
  notes: string | null;
  source: Source;
  environment: Environment;
  createdAt: string;
  updatedAt: string;
}

export interface RefundTimelineEntry {
  at: string;
  status: RefundRecordStatus;
  note: string;
}

export interface Refund {
  id: string;
  refundRef: string;
  providerRefundRef: string | null;
  paymentRef: string;
  transactionRef: string;
  orderRef: string | null;
  amountMinor: number;
  currency: string;
  status: RefundRecordStatus;
  reason: string;
  failureReason: string | null;
  timeline: RefundTimelineEntry[];
  source: Source;
  environment: Environment;
  createdAt: string;
  updatedAt: string;
}

export interface AuditRecord {
  id: string;
  auditRef: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  note: string | null;
  metadata: Record<string, unknown>;
  environment: Environment;
  createdAt: string;
}

export const COLLECTIONS = [
  'orders',
  'payments',
  'events',
  'event_deliveries',
  'exceptions',
  'runs',
  'settlements',
  'refunds',
  'audits',
] as const;
export type CollectionName = (typeof COLLECTIONS)[number];
