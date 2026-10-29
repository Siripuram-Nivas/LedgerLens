import type { Environment, PaymentStatus } from '../domain/types';
import { PAYMENT_STATUSES, SETTLEMENT_STATUSES } from '../domain/types';
import type { LedgerRepository } from '../repositories/ledgerRepository';
import { resolveRange, type RangePreset } from '../utils/dates';

function fillTrend(
  points: Array<{ bucket: string; count: number; value: number; successCount: number }>,
  range: { from: string; to: string; granularity: 'hour' | 'day' },
) {
  const indexed = new Map(points.map((point) => [point.bucket, point]));
  const cursor = new Date(range.from);
  if (range.granularity === 'hour') {
    cursor.setUTCMinutes(0, 0, 0);
  } else {
    cursor.setUTCHours(0, 0, 0, 0);
  }
  const end = new Date(range.to).getTime();
  const filled: Array<{ bucket: string; count: number; value: number; successCount: number }> = [];
  let guard = 0;
  while (cursor.getTime() <= end && guard < 400) {
    const key =
      range.granularity === 'hour'
        ? cursor.toISOString().replace(/:\d{2}\.\d{3}Z$/, ':00.000Z')
        : cursor.toISOString().slice(0, 10);
    filled.push(
      indexed.get(key) ?? { bucket: key, count: 0, value: 0, successCount: 0 },
    );
    if (range.granularity === 'hour') cursor.setUTCHours(cursor.getUTCHours() + 1);
    else cursor.setUTCDate(cursor.getUTCDate() + 1);
    guard += 1;
  }
  // Include a final bucket when the loop stops just before the end timestamp.
  if (filled.length === 0) {
    const key =
      range.granularity === 'hour'
        ? new Date(range.to).toISOString().replace(/:\d{2}\.\d{3}Z$/, ':00.000Z')
        : range.to.slice(0, 10);
    filled.push(indexed.get(key) ?? { bucket: key, count: 0, value: 0, successCount: 0 });
  }
  return filled;
}

export class DashboardService {
  constructor(private readonly repo: LedgerRepository) {}

  async summary(options: {
    environment: Environment;
    preset: RangePreset;
    from?: string;
    to?: string;
  }) {
    const range = resolveRange(options.preset, options.from, options.to);
    const env = options.environment;

    const [
      statusCounts,
      settlementPaymentCounts,
      paidByCurrency,
      trendPoints,
      settlementStatusCounts,
      pendingSettlementGrossByCurrency,
      settledSettlementGrossByCurrency,
      settledFeesByCurrency,
      settledNetByCurrency,
      openExceptions,
      recentPayments,
      recentExceptions,
      recentEvents,
      recentSettlements,
      latestRun,
      refunds,
      pendingReconciliationCount,
    ] = await Promise.all([
      this.repo.paymentStatusCounts(env, range.from, range.to),
      this.repo.paymentSettlementStatusCounts(env, range.from, range.to),
      this.repo.sumPaymentsByCurrency(env, range.from, range.to, 'PAID'),
      this.repo.paymentTrend(env, range.from, range.to, range.granularity),
      this.repo.settlementStatusCounts(env, range.from, range.to),
      this.repo.sumSettlementsByCurrency(env, 'grossMinor', 'PENDING', range.from, range.to),
      this.repo.sumSettlementsByCurrency(env, 'grossMinor', 'SETTLED', range.from, range.to),
      this.repo.sumSettlementsByCurrency(env, 'feesMinor', 'SETTLED', range.from, range.to),
      this.repo.sumSettlementsByCurrency(env, 'netMinor', 'SETTLED', range.from, range.to),
      this.repo.countOpenExceptions(env),
      this.repo.recentPayments(env, 6),
      this.repo.recentOpenExceptions(env, 5),
      this.repo.recentEvents(env, 6),
      this.repo.recentSettlements(env, 4),
      this.repo.latestRun(env),
      this.repo.recentRefunds(env, 3),
      this.repo.countPaymentsByReconciliationStatus(
        env,
        range.from,
        range.to,
        'PENDING_RECONCILIATION',
      ),
    ]);

    const primary = (entries: Array<{ value: string; total: number }>) =>
      entries.find((entry) => entry.value === 'INR')?.value ?? entries[0]?.value ?? 'INR';
    const primaryTotal = (entries: Array<{ value: string; total: number }>) =>
      entries.find((entry) => entry.value === primary(entries))?.total ?? 0;

    const valueCurrency = primary(paidByCurrency);
    const valueProcessedMinor = primaryTotal(paidByCurrency);
    const settlementCurrency = primary(settledSettlementGrossByCurrency);
    const settledGrossMinor = primaryTotal(settledSettlementGrossByCurrency);
    const settledFeesMinor = primaryTotal(settledFeesByCurrency);
    const settledNetMinor = primaryTotal(settledNetByCurrency);
    const pendingSettlementGrossMinor = primaryTotal(pendingSettlementGrossByCurrency);

    const statusMap = new Map(statusCounts.map((entry) => [entry.value, entry.count]));
    const settlementStatusMap = new Map(
      settlementStatusCounts.map((entry) => [entry.value, entry.count]),
    );
    const paymentSettlementMap = new Map(
      settlementPaymentCounts.map((entry) => [entry.value, entry.count]),
    );

    const totalTransactions = statusCounts.reduce((total, entry) => total + entry.count, 0);
    const successful = statusMap.get('PAID') ?? 0;
    const pending = (statusMap.get('PENDING') ?? 0) + (statusMap.get('PROCESSING') ?? 0);
    const failed = statusMap.get('FAILED') ?? 0;
    const cancelled = statusMap.get('CANCELLED') ?? 0;
    const pendingSettlements = settlementStatusMap.get('PENDING') ?? 0;
    const settledSettlements = settlementStatusMap.get('SETTLED') ?? 0;

    return {
      range,
      generatedAt: new Date().toISOString(),
      metrics: {
        totalTransactions,
        successfulPayments: successful,
        pendingPayments: pending,
        failedPayments: failed,
        cancelledPayments: cancelled,
        valueProcessedMinor,
        valueProcessedCurrency: valueCurrency,
        valueByCurrency: paidByCurrency.map((entry) => ({
          currency: entry.value,
          amountMinor: entry.total,
        })),
        openExceptions,
        settlementPending: pendingSettlements,
        settlementPendingPayments: paymentSettlementMap.get('PENDING') ?? 0,
        settlementPendingGrossMinor: pendingSettlementGrossMinor,
        settlementPendingCurrency: primary(pendingSettlementGrossByCurrency),
        settlementPendingGrossByCurrency: pendingSettlementGrossByCurrency.map((entry) => ({
          currency: entry.value,
          amountMinor: entry.total,
        })),
        settledGrossMinor,
        settledFeesMinor,
        settledNetMinor,
        settlementCurrency,
        settledGrossByCurrency: settledSettlementGrossByCurrency.map((entry) => ({
          currency: entry.value,
          amountMinor: entry.total,
        })),
        settledFeesByCurrency: settledFeesByCurrency.map((entry) => ({
          currency: entry.value,
          amountMinor: entry.total,
        })),
        settledNetByCurrency: settledNetByCurrency.map((entry) => ({
          currency: entry.value,
          amountMinor: entry.total,
        })),
        settledSettlements,
        pendingReconciliation: pendingReconciliationCount,
      },
      statusDistribution: PAYMENT_STATUSES.map((status) => ({
        status,
        count: statusMap.get(status) ?? 0,
      })),
      settlementDistribution: SETTLEMENT_STATUSES.map((status) => ({
        status,
        count: paymentSettlementMap.get(status) ?? 0,
      })),
      trend: fillTrend(trendPoints, range),
      recentTransactions: recentPayments,
      recentExceptions,
      recentEvents,
      recentSettlements,
      recentRefunds: refunds,
      latestRun,
      scopeNotes: {
        transactionMetrics: `Payments created between ${range.from} and ${range.to} (UTC).`,
        valueProcessed: 'Sum of captured (PAID) payment amounts in the selected range, minor units.',
        openExceptions: 'All OPEN or UNDER_REVIEW exceptions in this environment, regardless of age.',
        settlementMetrics: 'Recorded settlement batches created in the selected range. No settlement is inferred from payment success.',
        simulated: env === 'demo',
      },
    };
  }

  async statusDistribution(
    environment: Environment,
    from: string,
    to: string,
  ): Promise<Array<{ status: PaymentStatus; count: number }>> {
    const counts = await this.repo.paymentStatusCounts(environment, from, to);
    const map = new Map(counts.map((entry) => [entry.value, entry.count]));
    return PAYMENT_STATUSES.map((status) => ({ status, count: map.get(status) ?? 0 }));
  }
}
