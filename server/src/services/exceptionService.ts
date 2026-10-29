import type { Environment } from '../domain/types';
import type { ExceptionListQuery, LedgerRepository } from '../repositories/ledgerRepository';
import type { RealtimeBus } from '../realtime/bus';
import { ApiError, notFound } from '../utils/http';
import { nowIso } from '../utils/dates';

const RESOLUTION_TYPES = [
  'EVIDENCE_VERIFIED',
  'FALSE_POSITIVE',
  'ADJUSTED_EXTERNALLY',
  'ACCEPTED_AS_IS',
] as const;

export class ExceptionService {
  constructor(
    private readonly repo: LedgerRepository,
    private readonly bus: RealtimeBus,
  ) {}

  async list(query: ExceptionListQuery, environment: Environment) {
    const [page, statusCounts] = await Promise.all([
      this.repo.listExceptions(query, environment),
      this.repo.exceptionStatusCounts(environment),
    ]);
    const countMap = new Map(statusCounts.map((entry) => [entry.value, entry.count]));
    return {
      ...page,
      counts: {
        open: countMap.get('OPEN') ?? 0,
        underReview: countMap.get('UNDER_REVIEW') ?? 0,
        resolved: countMap.get('RESOLVED') ?? 0,
      },
    };
  }

  async detail(reference: string, environment: Environment) {
    const exception = await this.repo.getException(reference);
    if (!exception || exception.environment !== environment) {
      throw notFound('Reconciliation exception', reference);
    }
    const [audits, payment, order] = await Promise.all([
      this.repo.listAudits('exception', exception.exceptionRef),
      exception.transactionRef
        ? this.repo.getPayment(exception.transactionRef)
        : Promise.resolve(null),
      exception.orderRef ? this.repo.getOrder(exception.orderRef) : Promise.resolve(null),
    ]);
    return {
      exception,
      audits,
      payment,
      order,
      resolutionTypes: RESOLUTION_TYPES,
    };
  }

  async assign(
    reference: string,
    environment: Environment,
    input: { assignedTo: string; note?: string },
    actor: string,
  ) {
    const exception = await this.repo.getException(reference);
    if (!exception || exception.environment !== environment) {
      throw notFound('Reconciliation exception', reference);
    }
    if (exception.status === 'RESOLVED') {
      throw new ApiError(409, 'EXCEPTION_RESOLVED', 'Resolved exceptions cannot be reassigned');
    }
    const updated = await this.repo.updateException(exception.id, {
      status: 'UNDER_REVIEW',
      assignedTo: input.assignedTo.trim().slice(0, 80),
    });
    await this.repo.appendAudit({
      actor,
      action: 'exception.assigned',
      entityType: 'exception',
      entityId: exception.exceptionRef,
      note: input.note?.trim().slice(0, 300) || `Assigned to ${updated.assignedTo}.`,
      metadata: { assignedTo: updated.assignedTo },
      environment,
    });
    this.bus.publish('exception.updated', environment, {
      exceptionRef: updated.exceptionRef,
      status: updated.status,
      assignedTo: updated.assignedTo,
    });
    return this.detail(updated.exceptionRef, environment);
  }

  /**
   * Resolution records an operator decision and note. It does not alter the
   * underlying payment/order evidence or rewrite the original discrepancy.
   */
  async resolve(
    reference: string,
    environment: Environment,
    input: { resolutionType: (typeof RESOLUTION_TYPES)[number]; note: string },
    actor: string,
  ) {
    const exception = await this.repo.getException(reference);
    if (!exception || exception.environment !== environment) {
      throw notFound('Reconciliation exception', reference);
    }
    if (exception.status === 'RESOLVED') {
      throw new ApiError(409, 'EXCEPTION_RESOLVED', 'This exception is already resolved');
    }
    if (!RESOLUTION_TYPES.includes(input.resolutionType)) {
      throw new ApiError(400, 'INVALID_RESOLUTION_TYPE', 'Unsupported resolution type');
    }
    const note = input.note.trim();
    if (note.length < 8) {
      throw new ApiError(400, 'NOTE_REQUIRED', 'A resolution note of at least 8 characters is required');
    }
    const updated = await this.repo.updateException(exception.id, {
      status: 'RESOLVED',
      resolutionType: input.resolutionType,
      resolutionNote: note.slice(0, 1000),
      resolvedAt: nowIso(),
      assignedTo: exception.assignedTo ?? actor,
    });
    await this.repo.appendAudit({
      actor,
      action: 'exception.resolved',
      entityType: 'exception',
      entityId: exception.exceptionRef,
      note: note.slice(0, 300),
      metadata: { resolutionType: input.resolutionType },
      environment,
    });
    this.bus.publish('exception.updated', environment, {
      exceptionRef: updated.exceptionRef,
      status: updated.status,
      resolutionType: updated.resolutionType,
    });
    this.bus.publish('reconciliation.completed', environment, {
      reason: 'exception.resolved',
      openExceptionCount: await this.repo.countOpenExceptions(environment),
    });
    return this.detail(updated.exceptionRef, environment);
  }
}
