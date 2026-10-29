import type { AppConfig } from '../config';
import type { Logger } from '../logger';
import { createStore } from '../db/factory';
import type { DocStore } from '../db/store';
import { LedgerRepository } from '../repositories/ledgerRepository';
import { RealtimeBus } from '../realtime/bus';
import { ReconciliationService } from './reconciliationService';
import { EventService } from './eventService';
import { SeedService } from './seedService';
import { DemoService } from './demoService';
import { DashboardService } from './dashboardService';
import { TransactionService } from './transactionService';
import { EventLogService } from './eventLogService';
import { SettlementService } from './settlementService';
import { RefundService } from './refundService';
import { ExceptionService } from './exceptionService';

export interface Services {
  config: AppConfig;
  logger: Logger;
  store: DocStore;
  repo: LedgerRepository;
  bus: RealtimeBus;
  reconciliation: ReconciliationService;
  events: EventService;
  seed: SeedService;
  demo: DemoService;
  dashboard: DashboardService;
  transactions: TransactionService;
  eventLog: EventLogService;
  settlements: SettlementService;
  refunds: RefundService;
  exceptions: ExceptionService;
  close: () => Promise<void>;
}

export async function createServices(
  config: AppConfig,
  logger: Logger,
  options: { seedDemo?: boolean; store?: DocStore } = {},
): Promise<Services> {
  const store = options.store ?? (await createStore(config));
  const repo = new LedgerRepository(store, config.appEnvironment);
  const bus = new RealtimeBus();
  const reconciliation = new ReconciliationService(repo, logger, bus);
  const events = new EventService(repo, logger, bus, reconciliation);
  const seed = new SeedService(repo, reconciliation, logger, bus);
  const demo = new DemoService(repo, config, events, seed, bus, logger);
  const dashboard = new DashboardService(repo);
  const transactions = new TransactionService(repo);
  const eventLog = new EventLogService(repo);
  const settlements = new SettlementService(repo);
  const refunds = new RefundService(repo, config, bus);
  const exceptions = new ExceptionService(repo, bus);

  if (options.seedDemo ?? (config.DEMO_MODE && config.DEMO_SEED)) {
    await seed.seedIfEmpty();
  }

  return {
    config,
    logger,
    store,
    repo,
    bus,
    reconciliation,
    events,
    seed,
    demo,
    dashboard,
    transactions,
    eventLog,
    settlements,
    refunds,
    exceptions,
    close: async () => {
      await store.close();
    },
  };
}
