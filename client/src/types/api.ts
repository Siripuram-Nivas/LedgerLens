export type Environment = 'demo' | 'sandbox' | 'live';
export type Provider = 'demo' | 'razorpay';
export type Source = 'demo' | 'razorpay';

export type PaymentStatus = 'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED' | 'CANCELLED';
export type SettlementStatus =
  | 'NOT_APPLICABLE'
  | 'NOT_STARTED'
  | 'PENDING'
  | 'SETTLED'
  | 'FAILED'
  | 'UNKNOWN';
export type ReconciliationStatus =
  | 'MATCHED'
  | 'PENDING_RECONCILIATION'
  | 'MISSING_ORDER'
  | 'MISSING_PAYMENT'
  | 'AMOUNT_MISMATCH'
  | 'CURRENCY_MISMATCH'
  | 'DUPLICATE_EVENT'
  | 'DUPLICATE_PAYMENT'
  | 'UNDER_REVIEW'
  | 'NOT_APPLICABLE';
export type RefundStatus = 'NONE' | 'REQUESTED' | 'PROCESSING' | 'PARTIALLY_REFUNDED' | 'REFUNDED' | 'FAILED';
export type ExceptionType =
  | 'MISSING_ORDER'
  | 'MISSING_PAYMENT'
  | 'AMOUNT_MISMATCH'
  | 'CURRENCY_MISMATCH'
  | 'DUPLICATE_EVENT'
  | 'DUPLICATE_PAYMENT';
export type ExceptionStatus = 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED';
export type SettlementRecordStatus = 'PENDING' | 'SETTLED' | 'FAILED' | 'UNKNOWN';
export type RefundRecordStatus = 'REQUESTED' | 'PROCESSING' | 'PARTIALLY_REFUNDED' | 'REFUNDED' | 'FAILED';
export type SignatureStatus = 'VERIFIED' | 'SIMULATED' | 'INVALID' | 'NOT_AVAILABLE';

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
  provider: Provider;
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

export interface ExceptionEvidence {
  order: { orderRef: string; amountMinor: number; currency: string; customerRef: string } | null;
  payment: {
    transactionRef: string;
    providerPaymentId: string;
    amountMinor: number;
    currency: string;
    status: PaymentStatus;
    orderRef: string | null;
  } | null;
  relatedPayments?: Array<{
    transactionRef: string;
    amountMinor: number;
    currency: string;
    status: PaymentStatus;
    createdAt: string;
  }>;
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

export interface PaymentEvent {
  id: string;
  eventKey: string;
  provider: Provider;
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
  processingStatus: 'RECEIVED' | 'PROCESSED' | 'FAILED';
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
  outcome: 'ACCEPTED' | 'DUPLICATE' | 'REPROCESSED' | 'REJECTED_SIGNATURE' | 'INVALID';
  signatureStatus: SignatureStatus;
  source: Source;
  environment: Environment;
  note: string | null;
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
}

export interface CurrencyAmount {
  currency: string;
  amountMinor: number;
}

export interface DashboardSummary {
  range: {
    preset: string;
    from: string;
    to: string;
    granularity: 'hour' | 'day';
    label: string;
  };
  generatedAt: string;
  metrics: {
    totalTransactions: number;
    successfulPayments: number;
    pendingPayments: number;
    failedPayments: number;
    cancelledPayments: number;
    valueProcessedMinor: number;
    valueProcessedCurrency: string;
    valueByCurrency: CurrencyAmount[];
    openExceptions: number;
    settlementPending: number;
    settlementPendingPayments: number;
    settlementPendingGrossMinor: number;
    settlementPendingCurrency: string;
    settlementPendingGrossByCurrency: CurrencyAmount[];
    settledGrossMinor: number;
    settledFeesMinor: number;
    settledNetMinor: number;
    settlementCurrency: string;
    settledGrossByCurrency: CurrencyAmount[];
    settledFeesByCurrency: CurrencyAmount[];
    settledNetByCurrency: CurrencyAmount[];
    settledSettlements: number;
    pendingReconciliation: number;
  };
  statusDistribution: Array<{ status: PaymentStatus; count: number }>;
  settlementDistribution: Array<{ status: SettlementStatus; count: number }>;
  trend: Array<{ bucket: string; count: number; value: number; successCount: number }>;
  recentTransactions: Payment[];
  recentExceptions: ReconciliationException[];
  recentEvents: PaymentEvent[];
  recentSettlements: Settlement[];
  recentRefunds: Refund[];
  latestRun: ReconciliationRun | null;
  scopeNotes: Record<string, string | boolean>;
}

export interface TransactionEventSummary {
  eventKey: string;
  type: string;
  receivedAt: string;
  providerCreatedAt: string | null;
  processingStatus: string;
  signatureStatus: SignatureStatus;
  duplicateDeliveryCount: number;
  applied: boolean;
  processingNote: string | null;
  provider: Provider;
}

export interface TransactionInsight {
  kind: string;
  severity: 'success' | 'info' | 'warning' | 'critical';
  title: string;
  detail: string;
  action?: string;
}

export interface TransactionDetail {
  payment: Payment;
  order: Order | null;
  orderComparison: {
    expectedAmountMinor: number;
    observedAmountMinor: number;
    differenceMinor: number;
    expectedCurrency: string;
    observedCurrency: string;
    amountMatched: boolean;
    currencyMatched: boolean;
    summary: string | null;
  } | null;
  events: TransactionEventSummary[];
  exceptions: ReconciliationException[];
  refunds: Refund[];
  settlements: Settlement[];
  relatedPayments: Array<{
    transactionRef: string;
    status: PaymentStatus;
    amountMinor: number;
    currency: string;
    attempt: number;
    createdAt: string;
  }>;
  metadata: Record<string, string | number | boolean>;
  metadataRedacted: string[];
  insights: TransactionInsight[];
}

export interface ExceptionDetail {
  exception: ReconciliationException;
  audits: AuditRecord[];
  payment: Payment | null;
  order: Order | null;
  resolutionTypes: string[];
}

export interface EventStage {
  stage: string;
  complete: boolean;
  at: string | null;
  detail: string;
}

export interface EventDetail {
  event: PaymentEvent;
  deliveries: EventDelivery[];
  transaction: Payment | null;
  order: Order | null;
  stages: EventStage[];
}

export interface SettlementDetail {
  settlement: Settlement;
  payments: Payment[];
  simulated: boolean;
}

export interface RefundDetail {
  refund: Refund;
  payment: Payment | null;
  order: Order | null;
  audits: AuditRecord[];
  canAdvance: boolean;
  simulationOnly: boolean;
}

export interface RealtimeMeta {
  transport: string;
  namespace: string;
  path: string;
  fallback: string;
}

export interface Meta {
  name: string;
  tagline: string;
  version: string;
  environment: Environment;
  demoMode: boolean;
  provider: Provider;
  razorpayEnvironment: string;
  persistence: 'sqlite' | 'mongodb';
  persistenceLabel: string;
  accessControl: string;
  accessControlNote: string;
  realtime: RealtimeMeta;
  webhook: {
    endpoint: string;
    providerEnabled: boolean;
    secretConfigured: boolean;
    signature: string;
    idempotency: string;
    note: string;
  };
  demo: {
    enabled: boolean;
    scenarios: DemoScenario[];
    resetConfirmation: string;
    note: string;
  };
  statusModel: {
    payment: PaymentStatus[];
    settlement: SettlementStatus[];
    reconciliation: ReconciliationStatus[];
    refund: RefundStatus[];
    note: string;
  };
  reconciliationRules: string[];
  limits: Record<string, string | number>;
  timestamp: string;
}

export type DemoScenario =
  | 'payment_success'
  | 'payment_processing'
  | 'payment_pending'
  | 'payment_failed'
  | 'duplicate_webhook'
  | 'amount_mismatch'
  | 'missing_order'
  | 'settlement_pending'
  | 'settlement_confirmed'
  | 'refund';

export interface DemoStatus {
  enabled: boolean;
  scenarios: DemoScenario[];
  resetConfirmation: string | null;
  pendingSettlements?: {
    count: number;
    settlements: Array<{ settlementRef: string; grossMinor: number; currency: string }>;
  };
  isolation?: string;
}

export interface Health {
  status: string;
  version: string;
  uptimeSeconds: number;
  dbLatencyMs: number;
  persistence: string;
  demoMode: boolean;
  environment: Environment;
  provider: Provider;
  realtime: string;
  timestamp: string;
}

export interface PaginatedMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface TransactionListMeta extends PaginatedMeta {
  items: Payment[];
}

export interface ExceptionListMeta extends PaginatedMeta {
  items: ReconciliationException[];
  counts: { open: number; underReview: number; resolved: number };
}

export interface ApiEnvelope<T> {
  data: T;
}

export interface PaginatedEnvelope<T> {
  data: T[];
  meta: PaginatedMeta;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

export interface TransactionFilters {
  page: number;
  limit: number;
  q?: string;
  status?: PaymentStatus | '';
  settlementStatus?: SettlementStatus | '';
  reconciliationStatus?: ReconciliationStatus | '';
  refundStatus?: RefundStatus | '';
  from?: string;
  to?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'amount' | 'status';
  sortDir?: 'asc' | 'desc';
}

export interface ExceptionFilters {
  page: number;
  limit: number;
  q?: string;
  type?: ExceptionType | '';
  status?: ExceptionStatus | '';
  from?: string;
  to?: string;
  sortBy?: 'amountDifference' | 'createdAt' | 'lastDetectedAt';
  sortDir?: 'asc' | 'desc';
}

export interface EventFilters {
  page: number;
  limit: number;
  q?: string;
  processingStatus?: 'RECEIVED' | 'PROCESSED' | 'FAILED' | '';
  type?: string;
  duplicateOnly?: boolean;
  from?: string;
  to?: string;
}

export interface SettlementFilters {
  page: number;
  limit: number;
  q?: string;
  status?: SettlementRecordStatus | '';
  from?: string;
  to?: string;
}

export interface RefundFilters {
  page: number;
  limit: number;
  q?: string;
  status?: RefundStatus | '';
  from?: string;
  to?: string;
}
