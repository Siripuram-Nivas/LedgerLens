import { Router } from 'express';
import type { Services } from '../services/container';
import { healthRouter } from './health';
import { metaRouter } from './meta';
import { dashboardRouter } from './dashboard';
import { transactionsRouter } from './transactions';
import { reconciliationRouter } from './reconciliation';
import { settlementsRouter } from './settlements';
import { refundsRouter } from './refunds';
import { eventsRouter } from './events';
import { demoRouter } from './demo';

export function apiRouter(services: Services) {
  const router = Router();
  router.use(healthRouter(services));
  router.use(metaRouter(services));
  router.use(dashboardRouter(services));
  router.use(transactionsRouter(services));
  router.use(reconciliationRouter(services));
  router.use(settlementsRouter(services));
  router.use(refundsRouter(services));
  router.use(eventsRouter(services));
  router.use(demoRouter(services));
  return router;
}
