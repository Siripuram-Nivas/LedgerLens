import type { Environment } from '../domain/types';
import type { LedgerRepository, RefundListQuery } from '../repositories/ledgerRepository';
import type { AppConfig } from '../config';
import type { RealtimeBus } from '../realtime/bus';
import { ApiError, notFound } from '../utils/http';
import { nowIso } from '../utils/dates';

export class RefundService {
  constructor(
    private readonly repo: LedgerRepository,
    private readonly config: AppConfig,
    private readonly bus: RealtimeBus,
  ) {}

  async list(query: RefundListQuery, environment: Environment) {
    return this.repo.listRefunds(query, environment);
  }

  async detail(reference: string, environment: Environment) {
    const refund = await this.repo.getRefund(reference);
    if (!refund || refund.environment !== environment) {
      throw notFound('Refund', reference);
    }
    const payment = await this.repo.getPaymentByProviderId(
      refund.source === 'demo' ? 'demo' : 'razorpay',
      refund.paymentRef,
    );
    const order = refund.orderRef ? await this.repo.getOrder(refund.orderRef) : null;
    const audits = await this.repo.listAudits('refund', refund.refundRef);
    return {
      refund,
      payment,
      order,
      audits,
      canAdvance: this.canAdvance(refund.status),
      simulationOnly: refund.source === 'demo',
    };
  }

  /**
   * Demo-only transition. A refund request is never auto-completed and this
   * method is unavailable outside explicit demo mode.
   */
  async advanceDemo(refundRef: string, environment: Environment, actor: string) {
    if (!this.config.DEMO_MODE || environment !== 'demo') {
      throw new ApiError(403, 'DEMO_ONLY', 'Refund advancement is available only in explicit demo mode');
    }
    const refund = await this.repo.getRefund(refundRef);
    if (!refund || refund.environment !== environment) throw notFound('Refund', refundRef);
    if (refund.source !== 'demo') {
      throw new ApiError(409, 'REAL_REFUND_LOCKED', 'A demo action cannot mutate provider refund data');
    }
    if (refund.status === 'REQUESTED') {
      const updated = await this.repo.updateRefund(refund.id, {
        status: 'PROCESSING',
        timeline: [
          ...refund.timeline,
          {
            at: nowIso(),
            status: 'PROCESSING',
            note: 'Simulated provider accepted the refund for processing.',
          },
        ],
      });
      await this.afterTransition(updated, environment, actor);
      return updated;
    }
    if (refund.status === 'PROCESSING') {
      const updated = await this.repo.updateRefund(refund.id, {
        status: 'REFUNDED',
        timeline: [
          ...refund.timeline,
          {
            at: nowIso(),
            status: 'REFUNDED',
            note: 'Simulated provider confirmed refund completion.',
          },
        ],
      });
      await this.afterTransition(updated, environment, actor);
      return updated;
    }
    throw new ApiError(
      409,
      'INVALID_REFUND_TRANSITION',
      `Refund ${refund.refundRef} cannot advance from status ${refund.status}`,
    );
  }

  private canAdvance(status: string): boolean {
    return status === 'REQUESTED' || status === 'PROCESSING';
  }

  private async afterTransition(
    refund: Awaited<ReturnType<LedgerRepository['updateRefund']>>,
    environment: Environment,
    actor: string,
  ) {
    const payment = await this.repo.getPaymentByProviderId(
      refund.source === 'demo' ? 'demo' : 'razorpay',
      refund.paymentRef,
    );
    if (payment) {
      await this.repo.refreshPaymentRefundStatus(payment);
    }
    await this.repo.appendAudit({
      actor,
      action: `refund.${refund.status.toLowerCase()}`,
      entityType: 'refund',
      entityId: refund.refundRef,
      note: `Simulated refund transitioned to ${refund.status}.`,
      metadata: { paymentRef: refund.paymentRef },
      environment,
    });
    this.bus.publish('refund.updated', environment, {
      refundRef: refund.refundRef,
      status: refund.status,
      paymentRef: refund.paymentRef,
    });
    if (payment) {
      this.bus.publish('transaction.updated', environment, {
        transactionRef: payment.transactionRef,
        reason: 'refund.updated',
      });
    }
  }
}
