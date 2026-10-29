import type { CollectionName } from '../domain/types';

export type Primitive = string | number | boolean | null;

export type FilterOperator = {
  $in?: Primitive[];
  $ne?: Primitive;
  $gte?: Primitive;
  $lte?: Primitive;
  $gt?: Primitive;
  $lt?: Primitive;
};

export type FilterValue = Primitive | FilterOperator;
export type Filter = Record<string, FilterValue>;

export interface SearchSpec {
  term: string;
  fields: string[];
}

export interface SortSpec {
  field: string;
  direction: 'asc' | 'desc';
}

export interface FindOptions {
  filter?: Filter;
  search?: SearchSpec;
  sort?: SortSpec;
  skip?: number;
  limit?: number;
}

export interface TimeSeriesOptions {
  timeField: string;
  valueField: string;
  from: string;
  to: string;
  granularity: 'hour' | 'day';
  filter?: Filter;
}

export interface TimeSeriesPoint {
  bucket: string;
  count: number;
  value: number;
  successCount: number;
}

export interface DocStore {
  readonly engine: 'sqlite' | 'mongodb';
  init(): Promise<void>;
  ping(): Promise<void>;
  insert<T extends { id: string }>(collection: CollectionName, doc: T): Promise<void>;
  findOne<T>(collection: CollectionName, filter: Filter): Promise<T | null>;
  find<T>(collection: CollectionName, options?: FindOptions): Promise<T[]>;
  count(collection: CollectionName, filter?: Filter, search?: SearchSpec): Promise<number>;
  updateOne<T>(
    collection: CollectionName,
    filter: Filter,
    patch: Record<string, unknown>,
  ): Promise<T | null>;
  deleteMany(collection: CollectionName, filter: Filter): Promise<number>;
  groupCount(
    collection: CollectionName,
    field: string,
    filter?: Filter,
  ): Promise<Array<{ value: string; count: number }>>;
  sum(collection: CollectionName, field: string, filter?: Filter): Promise<number>;
  groupSum(
    collection: CollectionName,
    groupField: string,
    valueField: string,
    filter?: Filter,
  ): Promise<Array<{ value: string; total: number }>>;
  timeSeries(collection: CollectionName, options: TimeSeriesOptions): Promise<TimeSeriesPoint[]>;
  resetDemoData(): Promise<Record<string, number>>;
  close(): Promise<void>;
}

export class DuplicateKeyError extends Error {
  constructor(
    public readonly collection: string,
    public readonly key: string,
    message?: string,
  ) {
    super(message ?? `Duplicate key in ${collection}: ${key}`);
    this.name = 'DuplicateKeyError';
  }
}

export interface IndexSpec {
  name: string;
  fields: Array<{ field: string; direction: 1 | -1 }>;
  unique?: boolean;
}

export const INDEXES: Record<CollectionName, IndexSpec[]> = {
  orders: [
    { name: 'ux_orders_orderRef', fields: [{ field: 'orderRef', direction: 1 }], unique: true },
    { name: 'ix_orders_env_created', fields: [{ field: 'environment', direction: 1 }, { field: 'createdAt', direction: -1 }] },
  ],
  payments: [
    { name: 'ux_payments_transactionRef', fields: [{ field: 'transactionRef', direction: 1 }], unique: true },
    { name: 'ux_payments_provider_payment', fields: [{ field: 'provider', direction: 1 }, { field: 'providerPaymentId', direction: 1 }], unique: true },
    { name: 'ix_payments_env_created', fields: [{ field: 'environment', direction: 1 }, { field: 'createdAt', direction: -1 }] },
    { name: 'ix_payments_status', fields: [{ field: 'status', direction: 1 }] },
    { name: 'ix_payments_orderRef', fields: [{ field: 'orderRef', direction: 1 }] },
    { name: 'ix_payments_recon', fields: [{ field: 'reconciliationStatus', direction: 1 }] },
  ],
  events: [
    { name: 'ux_events_eventKey', fields: [{ field: 'eventKey', direction: 1 }], unique: true },
    { name: 'ix_events_paymentRef', fields: [{ field: 'paymentRef', direction: 1 }] },
    { name: 'ix_events_received', fields: [{ field: 'receivedAt', direction: -1 }] },
    { name: 'ix_events_processing', fields: [{ field: 'processingStatus', direction: 1 }] },
  ],
  event_deliveries: [
    { name: 'ix_deliveries_eventKey', fields: [{ field: 'eventKey', direction: 1 }] },
    { name: 'ix_deliveries_received', fields: [{ field: 'receivedAt', direction: -1 }] },
  ],
  exceptions: [
    { name: 'ux_exceptions_fingerprint', fields: [{ field: 'fingerprint', direction: 1 }], unique: true },
    { name: 'ix_exceptions_status', fields: [{ field: 'status', direction: 1 }] },
    { name: 'ix_exceptions_type', fields: [{ field: 'type', direction: 1 }] },
    { name: 'ix_exceptions_paymentRef', fields: [{ field: 'paymentRef', direction: 1 }] },
    { name: 'ix_exceptions_env_created', fields: [{ field: 'environment', direction: 1 }, { field: 'createdAt', direction: -1 }] },
  ],
  runs: [
    { name: 'ix_runs_started', fields: [{ field: 'startedAt', direction: -1 }] },
  ],
  settlements: [
    { name: 'ux_settlements_ref', fields: [{ field: 'settlementRef', direction: 1 }], unique: true },
    { name: 'ix_settlements_status', fields: [{ field: 'status', direction: 1 }] },
    { name: 'ix_settlements_created', fields: [{ field: 'createdAt', direction: -1 }] },
  ],
  refunds: [
    { name: 'ux_refunds_ref', fields: [{ field: 'refundRef', direction: 1 }], unique: true },
    { name: 'ix_refunds_paymentRef', fields: [{ field: 'paymentRef', direction: 1 }] },
    { name: 'ix_refunds_status', fields: [{ field: 'status', direction: 1 }] },
  ],
  audits: [
    { name: 'ix_audits_created', fields: [{ field: 'createdAt', direction: -1 }] },
    { name: 'ix_audits_entity', fields: [{ field: 'entityType', direction: 1 }, { field: 'entityId', direction: 1 }] },
  ],
};
