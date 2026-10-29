import { minorUnitsSchema, currencySchema } from '../domain/money';
import {
  type AuditRecord,
  type Environment,
  type EventDelivery,
  type Payment,
  type PaymentEvent,
  type PaymentStatus,
  type ReconciliationException,
  type ReconciliationRun,
  type Refund,
  type RefundStatus,
  type Settlement,
  type Order,
  type Source,
  type PaymentProvider,
} from '../domain/types';
import type { Filter, Primitive, DocStore, TimeSeriesPoint } from '../db/store';
import {
  createId,
  newAuditRef,
  newExceptionRef,
  newOrderRef,
  newRunRef,
  newSettlementRef,
  newTransactionRef,
} from '../utils/ids';
import { nowIso } from '../utils/dates';

export interface PaymentListQuery {
  page: number;
  limit: number;
  q?: string;
  status?: string;
  settlementStatus?: string;
  reconciliationStatus?: string;
  refundStatus?: string;
  from?: string;
  to?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

export interface EventListQuery {
  page: number;
  limit: number;
  q?: string;
  processingStatus?: string;
  type?: string;
  duplicateOnly?: boolean;
  from?: string;
  to?: string;
}

export interface ExceptionListQuery {
  page: number;
  limit: number;
  q?: string;
  type?: string;
  status?: string;
  from?: string;
  to?: string;
  sortBy?: 'amountDifference' | 'createdAt' | 'lastDetectedAt';
  sortDir?: 'asc' | 'desc';
}

export interface SettlementListQuery {
  page: number;
  limit: number;
  q?: string;
  status?: string;
  from?: string;
  to?: string;
}

export interface RefundListQuery {
  page: number;
  limit: number;
  q?: string;
  status?: string;
  from?: string;
  to?: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

function rangeFilter(from?: string, to?: string): Filter {
  const filter: Filter = {};
  if (from || to) {
    filter.createdAt = {
      ...(from ? { $gte: from } : {}),
      ...(to ? { $lte: to } : {}),
    };
  }
  return filter;
}

function statusFilter(field: string, value?: string): Filter {
  return value ? { [field]: value } : {};
}

export function paginate<T>(items: T[], total: number, page: number, limit: number): Paginated<T> {
  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export class LedgerRepository {
  constructor(
    private readonly store: DocStore,
    private readonly defaultEnvironment: Environment,
  ) {}

  get storageEngine() {
    return this.store.engine;
  }

  // ---------------------------------------------------------------- orders

  async createOrder(input: {
    orderRef?: string;
    customerRef: string;
    description: string;
    amountMinor: number;
    currency: string;
    source: Source;
    environment?: Environment;
    createdAt?: string;
  }): Promise<Order> {
    const amountMinor = minorUnitsSchema.parse(input.amountMinor);
    const currency = currencySchema.parse(input.currency);
    const at = input.createdAt ?? nowIso();
    const order: Order = {
      id: createId(),
      orderRef: input.orderRef ?? newOrderRef(),
      customerRef: input.customerRef.trim().slice(0, 80) || 'Demo customer',
      description: input.description.trim().slice(0, 160),
      amountMinor,
      currency,
      source: input.source,
      environment: input.environment ?? this.defaultEnvironment,
      createdAt: at,
      updatedAt: at,
    };
    if (!order.description) throw new Error('Order description is required');
    await this.store.insert('orders', order);
    return order;
  }

  async getOrder(orderRef: string): Promise<Order | null> {
    return this.store.findOne<Order>('orders', { orderRef });
  }

  async listOrdersForEnvironment(environment: Environment): Promise<Order[]> {
    return this.store.find<Order>('orders', {
      filter: { environment },
      sort: { field: 'createdAt', direction: 'asc' },
    });
  }

  // -------------------------------------------------------------- payments

  async createPayment(input: {
    transactionRef?: string;
    orderRef: string | null;
    customerRef: string;
    amountMinor: number;
    currency: string;
    status: PaymentStatus;
    provider: PaymentProvider;
    providerPaymentId: string;
    method: string;
    attempt?: number;
    source: Source;
    environment?: Environment;
    metadata?: Record<string, string | number | boolean | null>;
    createdAt?: string;
    lastEventAt?: string | null;
  }): Promise<Payment> {
    const amountMinor = minorUnitsSchema.parse(input.amountMinor);
    const currency = currencySchema.parse(input.currency);
    const at = input.createdAt ?? nowIso();
    const terminalFailure = input.status === 'FAILED' || input.status === 'CANCELLED';
    const payment: Payment = {
      id: createId(),
      transactionRef: input.transactionRef ?? newTransactionRef(),
      orderRef: input.orderRef,
      customerRef: input.customerRef.trim().slice(0, 80) || 'Demo customer',
      amountMinor,
      currency,
      status: input.status,
      settlementStatus: terminalFailure ? 'NOT_APPLICABLE' : 'NOT_STARTED',
      reconciliationStatus: terminalFailure ? 'NOT_APPLICABLE' : 'PENDING_RECONCILIATION',
      refundStatus: 'NONE',
      provider: input.provider,
      providerPaymentId: input.providerPaymentId,
      method: input.method,
      attempt: input.attempt ?? 1,
      source: input.source,
      environment: input.environment ?? this.defaultEnvironment,
      lastEventAt: input.lastEventAt ?? null,
      lastEventKey: null,
      metadata: input.metadata ?? {},
      createdAt: at,
      updatedAt: at,
    };
    await this.store.insert('payments', payment);
    return payment;
  }

  async getPayment(transactionRefOrId: string): Promise<Payment | null> {
    const byRef = await this.store.findOne<Payment>('payments', {
      transactionRef: transactionRefOrId,
    });
    if (byRef) return byRef;
    return this.store.findOne<Payment>('payments', { id: transactionRefOrId });
  }

  async getPaymentByProviderId(
    provider: PaymentProvider,
    providerPaymentId: string,
  ): Promise<Payment | null> {
    return this.store.findOne<Payment>('payments', { provider, providerPaymentId });
  }

  async listPaymentsByOrderRef(orderRef: string): Promise<Payment[]> {
    return this.store.find<Payment>('payments', {
      filter: { orderRef },
      sort: { field: 'createdAt', direction: 'asc' },
    });
  }

  async listPaymentsForEnvironment(environment: Environment): Promise<Payment[]> {
    return this.store.find<Payment>('payments', {
      filter: { environment },
      sort: { field: 'createdAt', direction: 'asc' },
    });
  }

  async listPayments(query: PaymentListQuery, environment: Environment): Promise<Paginated<Payment>> {
    const sortMap: Record<string, string> = {
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
      amount: 'amountMinor',
      status: 'status',
    };
    const sortField = sortMap[query.sortBy ?? 'createdAt'] ?? 'createdAt';
    const filter: Filter = {
      environment,
      ...rangeFilter(query.from, query.to),
      ...statusFilter('status', query.status),
      ...statusFilter('settlementStatus', query.settlementStatus),
      ...statusFilter('reconciliationStatus', query.reconciliationStatus),
      ...statusFilter('refundStatus', query.refundStatus),
    };
    const search = query.q
      ? {
          term: query.q,
          fields: [
            'transactionRef',
            'orderRef',
            'customerRef',
            'providerPaymentId',
            'id',
          ],
        }
      : undefined;
    const [items, total] = await Promise.all([
      this.store.find<Payment>('payments', {
        filter,
        search,
        sort: { field: sortField, direction: query.sortDir ?? 'desc' },
        skip: (query.page - 1) * query.limit,
        limit: query.limit,
      }),
      this.store.count('payments', filter, search),
    ]);
    return paginate(items, total, query.page, query.limit);
  }

  async updatePayment(id: string, patch: Partial<Payment>): Promise<Payment> {
    const updated = await this.store.updateOne<Payment>('payments', { id }, {
      ...patch,
      updatedAt: nowIso(),
    });
    if (!updated) throw new Error(`Payment ${id} not found while updating`);
    return updated;
  }

  async recentPayments(environment: Environment, limit = 6): Promise<Payment[]> {
    return this.store.find<Payment>('payments', {
      filter: { environment },
      sort: { field: 'createdAt', direction: 'desc' },
      limit,
    });
  }

  async paymentStatusCounts(
    environment: Environment,
    from: string,
    to: string,
  ): Promise<Array<{ value: string; count: number }>> {
    return this.store.groupCount('payments', 'status', {
      environment,
      createdAt: { $gte: from, $lte: to },
    });
  }

  async paymentSettlementStatusCounts(
    environment: Environment,
    from: string,
    to: string,
  ): Promise<Array<{ value: string; count: number }>> {
    return this.store.groupCount('payments', 'settlementStatus', {
      environment,
      createdAt: { $gte: from, $lte: to },
    });
  }

  async sumPaymentAmount(
    environment: Environment,
    from: string,
    to: string,
    status?: PaymentStatus,
  ): Promise<number> {
    const filter: Filter = {
      environment,
      createdAt: { $gte: from, $lte: to },
    };
    if (status) filter.status = status;
    return this.store.sum('payments', 'amountMinor', filter);
  }

  async sumPaymentsByCurrency(
    environment: Environment,
    from: string,
    to: string,
    status?: PaymentStatus,
  ): Promise<Array<{ value: string; total: number }>> {
    const filter: Filter = {
      environment,
      createdAt: { $gte: from, $lte: to },
    };
    if (status) filter.status = status;
    return this.store.groupSum('payments', 'currency', 'amountMinor', filter);
  }

  async sumSettlementsByCurrency(
    environment: Environment,
    field: 'grossMinor' | 'feesMinor' | 'netMinor',
    status: 'SETTLED' | 'PENDING',
    from: string,
    to: string,
  ): Promise<Array<{ value: string; total: number }>> {
    return this.store.groupSum('settlements', 'currency', field, {
      environment,
      status,
      createdAt: { $gte: from, $lte: to },
    });
  }

  async paymentTrend(
    environment: Environment,
    from: string,
    to: string,
    granularity: 'hour' | 'day',
  ): Promise<TimeSeriesPoint[]> {
    return this.store.timeSeries('payments', {
      timeField: 'createdAt',
      valueField: 'amountMinor',
      from,
      to,
      granularity,
      filter: { environment },
    });
  }

  async countPaymentsByReconciliationStatus(
    environment: Environment,
    from: string,
    to: string,
    status: string,
  ): Promise<number> {
    return this.store.count('payments', {
      environment,
      createdAt: { $gte: from, $lte: to },
      reconciliationStatus: status,
    });
  }

  // ---------------------------------------------------------------- events

  async insertEvent(event: PaymentEvent): Promise<void> {
    await this.store.insert('events', event);
  }

  async findEventByKey(eventKey: string): Promise<PaymentEvent | null> {
    return this.store.findOne<PaymentEvent>('events', { eventKey });
  }

  async getEvent(transactionRefOrId: string): Promise<PaymentEvent | null> {
    const byId = await this.store.findOne<PaymentEvent>('events', { id: transactionRefOrId });
    if (byId) return byId;
    return this.store.findOne<PaymentEvent>('events', { eventKey: transactionRefOrId });
  }

  async updateEvent(id: string, patch: Partial<PaymentEvent>): Promise<PaymentEvent> {
    const updated = await this.store.updateOne<PaymentEvent>('events', { id }, {
      ...patch,
      updatedAt: nowIso(),
    });
    if (!updated) throw new Error(`Event ${id} not found while updating`);
    return updated;
  }

  async insertDelivery(delivery: EventDelivery): Promise<void> {
    await this.store.insert('event_deliveries', delivery);
  }

  async listDeliveries(eventKey: string): Promise<EventDelivery[]> {
    return this.store.find<EventDelivery>('event_deliveries', {
      filter: { eventKey },
      sort: { field: 'receivedAt', direction: 'asc' },
    });
  }

  async listEvents(query: EventListQuery, environment: Environment): Promise<Paginated<PaymentEvent>> {
    const filter: Filter = {
      environment,
      ...rangeFilter(query.from, query.to),
      ...statusFilter('processingStatus', query.processingStatus),
      ...statusFilter('type', query.type),
    };
    if (query.duplicateOnly) {
      filter.duplicateDeliveryCount = { $gte: 1 };
    }
    const search = query.q
      ? {
          term: query.q,
          fields: ['eventKey', 'providerEventId', 'paymentRef', 'orderRef', 'transactionRef', 'type'],
        }
      : undefined;
    const [items, total] = await Promise.all([
      this.store.find<PaymentEvent>('events', {
        filter,
        search,
        sort: { field: 'receivedAt', direction: 'desc' },
        skip: (query.page - 1) * query.limit,
        limit: query.limit,
      }),
      this.store.count('events', filter, search),
    ]);
    return paginate(items, total, query.page, query.limit);
  }

  async eventsForPayment(transactionRef: string): Promise<PaymentEvent[]> {
    return this.store.find<PaymentEvent>('events', {
      filter: { transactionRef },
      sort: { field: 'receivedAt', direction: 'asc' },
    });
  }

  async recentEvents(environment: Environment, limit = 6): Promise<PaymentEvent[]> {
    return this.store.find<PaymentEvent>('events', {
      filter: { environment },
      sort: { field: 'receivedAt', direction: 'desc' },
      limit,
    });
  }

  // ------------------------------------------------------------ exceptions

  async createException(
    input: Omit<ReconciliationException, 'id' | 'exceptionRef' | 'createdAt' | 'updatedAt'>,
  ): Promise<ReconciliationException> {
    const at = nowIso();
    const exception: ReconciliationException = {
      ...input,
      id: createId(),
      exceptionRef: newExceptionRef(),
      createdAt: at,
      updatedAt: at,
    };
    await this.store.insert('exceptions', exception);
    return exception;
  }

  async getException(refOrId: string): Promise<ReconciliationException | null> {
    const byId = await this.store.findOne<ReconciliationException>('exceptions', {
      id: refOrId,
    });
    if (byId) return byId;
    return this.store.findOne<ReconciliationException>('exceptions', {
      exceptionRef: refOrId,
    });
  }

  async findExceptionByFingerprint(
    fingerprint: string,
  ): Promise<ReconciliationException | null> {
    return this.store.findOne<ReconciliationException>('exceptions', { fingerprint });
  }

  async updateException(
    id: string,
    patch: Partial<ReconciliationException>,
  ): Promise<ReconciliationException> {
    const updated = await this.store.updateOne<ReconciliationException>('exceptions', { id }, {
      ...patch,
      updatedAt: nowIso(),
    });
    if (!updated) throw new Error(`Exception ${id} not found while updating`);
    return updated;
  }

  async listExceptions(
    query: ExceptionListQuery,
    environment: Environment,
  ): Promise<Paginated<ReconciliationException>> {
    const sortField =
      query.sortBy === 'amountDifference'
        ? 'differenceMinor'
        : query.sortBy === 'lastDetectedAt'
          ? 'lastDetectedAt'
          : 'firstDetectedAt';
    const filter: Filter = {
      environment,
      ...rangeFilter(query.from, query.to),
      ...statusFilter('type', query.type),
      ...statusFilter('status', query.status),
    };
    const search = query.q
      ? {
          term: query.q,
          fields: ['exceptionRef', 'transactionRef', 'orderRef', 'paymentRef', 'explanation'],
        }
      : undefined;
    const [items, total] = await Promise.all([
      this.store.find<ReconciliationException>('exceptions', {
        filter,
        search,
        sort: { field: sortField, direction: query.sortDir ?? 'desc' },
        skip: (query.page - 1) * query.limit,
        limit: query.limit,
      }),
      this.store.count('exceptions', filter, search),
    ]);
    return paginate(items, total, query.page, query.limit);
  }

  async listActiveExceptions(environment: Environment): Promise<ReconciliationException[]> {
    return this.store.find<ReconciliationException>('exceptions', {
      filter: { environment, status: { $in: ['OPEN', 'UNDER_REVIEW'] } },
      sort: { field: 'firstDetectedAt', direction: 'asc' },
    });
  }

  async countOpenExceptions(environment: Environment): Promise<number> {
    return this.store.count('exceptions', {
      environment,
      status: { $in: ['OPEN', 'UNDER_REVIEW'] },
    });
  }

  async exceptionStatusCounts(
    environment: Environment,
  ): Promise<Array<{ value: string; count: number }>> {
    return this.store.groupCount('exceptions', 'status', { environment });
  }

  async recentOpenExceptions(
    environment: Environment,
    limit = 5,
  ): Promise<ReconciliationException[]> {
    return this.store.find<ReconciliationException>('exceptions', {
      filter: { environment, status: { $in: ['OPEN', 'UNDER_REVIEW'] } },
      sort: { field: 'firstDetectedAt', direction: 'desc' },
      limit,
    });
  }

  async exceptionsForPayment(transactionRef: string): Promise<ReconciliationException[]> {
    return this.store.find<ReconciliationException>('exceptions', {
      filter: { transactionRef },
      sort: { field: 'firstDetectedAt', direction: 'desc' },
    });
  }

  // ------------------------------------------------------------------ runs

  async createRun(
    input: Omit<ReconciliationRun, 'id' | 'runRef' | 'createdAt' | 'updatedAt'>,
  ): Promise<ReconciliationRun> {
    const at = nowIso();
    const run: ReconciliationRun = {
      ...input,
      id: createId(),
      runRef: newRunRef(),
      createdAt: at,
      updatedAt: at,
    };
    await this.store.insert('runs', run);
    return run;
  }

  async updateRun(id: string, patch: Partial<ReconciliationRun>): Promise<ReconciliationRun> {
    const updated = await this.store.updateOne<ReconciliationRun>('runs', { id }, {
      ...patch,
      updatedAt: nowIso(),
    });
    if (!updated) throw new Error(`Run ${id} not found while updating`);
    return updated;
  }

  async listRuns(environment: Environment, limit = 10): Promise<ReconciliationRun[]> {
    return this.store.find<ReconciliationRun>('runs', {
      filter: { environment },
      sort: { field: 'startedAt', direction: 'desc' },
      limit,
    });
  }

  async latestRun(environment: Environment): Promise<ReconciliationRun | null> {
    const runs = await this.listRuns(environment, 1);
    return runs[0] ?? null;
  }

  async getRun(refOrId: string): Promise<ReconciliationRun | null> {
    const byId = await this.store.findOne<ReconciliationRun>('runs', { id: refOrId });
    if (byId) return byId;
    return this.store.findOne<ReconciliationRun>('runs', { runRef: refOrId });
  }

  // ----------------------------------------------------------- settlements

  async createSettlement(
    input: Omit<Settlement, 'id' | 'settlementRef' | 'createdAt' | 'updatedAt'> & {
      settlementRef?: string;
    },
  ): Promise<Settlement> {
    const at = nowIso();
    const settlement: Settlement = {
      ...input,
      id: createId(),
      settlementRef: input.settlementRef ?? newSettlementRef(),
      createdAt: at,
      updatedAt: at,
    };
    await this.store.insert('settlements', settlement);
    return settlement;
  }

  async getSettlement(refOrId: string): Promise<Settlement | null> {
    const byId = await this.store.findOne<Settlement>('settlements', { id: refOrId });
    if (byId) return byId;
    return this.store.findOne<Settlement>('settlements', { settlementRef: refOrId });
  }

  async updateSettlement(id: string, patch: Partial<Settlement>): Promise<Settlement> {
    const updated = await this.store.updateOne<Settlement>('settlements', { id }, {
      ...patch,
      updatedAt: nowIso(),
    });
    if (!updated) throw new Error(`Settlement ${id} not found while updating`);
    return updated;
  }

  async settlementsForPayment(providerPaymentId: string): Promise<Settlement[]> {
    // Array membership is evaluated in application code to keep both stores aligned.
    const all = await this.store.find<Settlement>('settlements', {
      sort: { field: 'createdAt', direction: 'desc' },
    });
    return all.filter((settlement) => settlement.paymentRefs.includes(providerPaymentId));
  }

  async listSettlements(
    query: SettlementListQuery,
    environment: Environment,
  ): Promise<Paginated<Settlement>> {
    const filter: Filter = {
      environment,
      ...rangeFilter(query.from, query.to),
      ...statusFilter('status', query.status),
    };
    const search = query.q
      ? {
          term: query.q,
          fields: ['settlementRef', 'providerSettlementRef', 'notes'],
        }
      : undefined;
    const [items, total] = await Promise.all([
      this.store.find<Settlement>('settlements', {
        filter,
        search,
        sort: { field: 'createdAt', direction: 'desc' },
        skip: (query.page - 1) * query.limit,
        limit: query.limit,
      }),
      this.store.count('settlements', filter, search),
    ]);
    return paginate(items, total, query.page, query.limit);
  }

  async listSettlementsByStatus(
    environment: Environment,
    status: string,
  ): Promise<Settlement[]> {
    return this.store.find<Settlement>('settlements', {
      filter: { environment, status },
      sort: { field: 'createdAt', direction: 'asc' },
    });
  }

  async latestPendingSettlement(environment: Environment): Promise<Settlement | null> {
    const settlements = await this.store.find<Settlement>('settlements', {
      filter: { environment, status: 'PENDING' },
      sort: { field: 'createdAt', direction: 'desc' },
      limit: 1,
    });
    return settlements[0] ?? null;
  }

  async settlementStatusCounts(
    environment: Environment,
    from: string,
    to: string,
  ): Promise<Array<{ value: string; count: number }>> {
    return this.store.groupCount('settlements', 'status', {
      environment,
      createdAt: { $gte: from, $lte: to },
    });
  }

  async sumSettlementField(
    environment: Environment,
    field: 'grossMinor' | 'feesMinor' | 'netMinor',
    status: 'SETTLED' | 'PENDING',
    from: string,
    to: string,
  ): Promise<number> {
    return this.store.sum('settlements', field, {
      environment,
      status,
      createdAt: { $gte: from, $lte: to },
    });
  }

  async recentSettlements(environment: Environment, limit = 5): Promise<Settlement[]> {
    return this.store.find<Settlement>('settlements', {
      filter: { environment },
      sort: { field: 'createdAt', direction: 'desc' },
      limit,
    });
  }

  // --------------------------------------------------------------- refunds

  async createRefund(
    input: Omit<Refund, 'id' | 'createdAt' | 'updatedAt'> & { createdAt?: string },
  ): Promise<Refund> {
    const at = input.createdAt ?? nowIso();
    const refund: Refund = {
      ...input,
      id: createId(),
      createdAt: at,
      updatedAt: at,
    };
    await this.store.insert('refunds', refund);
    return refund;
  }

  async getRefund(refOrId: string): Promise<Refund | null> {
    const byId = await this.store.findOne<Refund>('refunds', { id: refOrId });
    if (byId) return byId;
    return this.store.findOne<Refund>('refunds', { refundRef: refOrId });
  }

  async updateRefund(id: string, patch: Partial<Refund>): Promise<Refund> {
    const updated = await this.store.updateOne<Refund>('refunds', { id }, {
      ...patch,
      updatedAt: nowIso(),
    });
    if (!updated) throw new Error(`Refund ${id} not found while updating`);
    return updated;
  }

  async refundsForPayment(providerPaymentId: string): Promise<Refund[]> {
    return this.store.find<Refund>('refunds', {
      filter: { paymentRef: providerPaymentId },
      sort: { field: 'createdAt', direction: 'desc' },
    });
  }

  async listRefunds(query: RefundListQuery, environment: Environment): Promise<Paginated<Refund>> {
    const filter: Filter = {
      environment,
      ...rangeFilter(query.from, query.to),
      ...statusFilter('status', query.status),
    };
    const search = query.q
      ? {
          term: query.q,
          fields: ['refundRef', 'paymentRef', 'transactionRef', 'orderRef', 'reason'],
        }
      : undefined;
    const [items, total] = await Promise.all([
      this.store.find<Refund>('refunds', {
        filter,
        search,
        sort: { field: 'createdAt', direction: 'desc' },
        skip: (query.page - 1) * query.limit,
        limit: query.limit,
      }),
      this.store.count('refunds', filter, search),
    ]);
    return paginate(items, total, query.page, query.limit);
  }

  async recentRefunds(environment: Environment, limit = 5): Promise<Refund[]> {
    return this.store.find<Refund>('refunds', {
      filter: { environment },
      sort: { field: 'createdAt', direction: 'desc' },
      limit,
    });
  }

  async completedRefundTotal(paymentRef: string): Promise<number> {
    const refunds = await this.store.find<Refund>('refunds', {
      filter: { paymentRef, status: { $in: ['REFUNDED', 'PARTIALLY_REFUNDED'] } },
    });
    return refunds.reduce((total, refund) => total + refund.amountMinor, 0);
  }

  async deriveRefundStatus(paymentRef: string): Promise<RefundStatus> {
    const refunds = await this.refundsForPayment(paymentRef);
    if (refunds.length === 0) return 'NONE';
    const completed = refunds
      .filter((refund) => refund.status === 'REFUNDED' || refund.status === 'PARTIALLY_REFUNDED')
      .reduce((total, refund) => total + refund.amountMinor, 0);
    const payment = await this.store.findOne<Payment>('payments', {
      providerPaymentId: paymentRef,
    });
    if (completed > 0) {
      return payment && completed >= payment.amountMinor ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
    }
    if (refunds.some((refund) => refund.status === 'PROCESSING')) return 'PROCESSING';
    if (refunds.some((refund) => refund.status === 'REQUESTED')) return 'REQUESTED';
    if (refunds.some((refund) => refund.status === 'FAILED')) return 'FAILED';
    return 'NONE';
  }

  async refreshPaymentRefundStatus(payment: Payment): Promise<Payment> {
    const refundStatus = await this.deriveRefundStatus(payment.providerPaymentId);
    return this.updatePayment(payment.id, { refundStatus });
  }

  // ---------------------------------------------------------------- audits

  async appendAudit(input: {
    actor: string;
    action: string;
    entityType: string;
    entityId: string;
    note?: string | null;
    metadata?: Record<string, unknown>;
    environment?: Environment;
  }): Promise<AuditRecord> {
    const audit: AuditRecord = {
      id: createId(),
      auditRef: newAuditRef(),
      actor: input.actor,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      note: input.note ?? null,
      metadata: input.metadata ?? {},
      environment: input.environment ?? this.defaultEnvironment,
      createdAt: nowIso(),
    };
    await this.store.insert('audits', audit);
    return audit;
  }

  async listAudits(
    entityType: string,
    entityId: string,
  ): Promise<AuditRecord[]> {
    return this.store.find<AuditRecord>('audits', {
      filter: { entityType, entityId },
      sort: { field: 'createdAt', direction: 'desc' },
    });
  }

  async recentAudits(environment: Environment, limit = 10): Promise<AuditRecord[]> {
    return this.store.find<AuditRecord>('audits', {
      filter: { environment },
      sort: { field: 'createdAt', direction: 'desc' },
      limit,
    });
  }

  // ------------------------------------------------------------- utilities

  async countCollection(
    collection: 'orders' | 'payments' | 'events' | 'exceptions' | 'settlements' | 'refunds',
    filter?: Filter,
  ): Promise<number> {
    return this.store.count(collection, filter);
  }

  async findRaw<T>(collection: 'orders' | 'payments' | 'settlements' | 'refunds', filter: Filter) {
    return this.store.find<T>(collection, { filter });
  }

  async resetDemoData(): Promise<Record<string, number>> {
    return this.store.resetDemoData();
  }

  isPrimitive(value: unknown): value is Primitive {
    return (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    );
  }
}
