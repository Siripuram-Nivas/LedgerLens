import type { Environment } from '../domain/types';
import type { LedgerRepository, SettlementListQuery } from '../repositories/ledgerRepository';
import { notFound } from '../utils/http';

export class SettlementService {
  constructor(private readonly repo: LedgerRepository) {}

  async list(query: SettlementListQuery, environment: Environment) {
    return this.repo.listSettlements(query, environment);
  }

  async detail(reference: string, environment: Environment) {
    const settlement = await this.repo.getSettlement(reference);
    if (!settlement || settlement.environment !== environment) {
      throw notFound('Settlement', reference);
    }
    const provider = settlement.source === 'demo' ? 'demo' : 'razorpay';
    const payments = await Promise.all(
      settlement.paymentRefs.map((paymentRef) =>
        this.repo.getPaymentByProviderId(provider, paymentRef),
      ),
    );
    return {
      settlement,
      payments: payments.filter((payment) => payment !== null),
      simulated: settlement.source === 'demo',
    };
  }
}
