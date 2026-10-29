import { Router } from 'express';
import type { Services } from '../services/container';
import {
  assignExceptionSchema,
  exceptionListSchema,
  resolveExceptionSchema,
  runReconciliationSchema,
} from './validation';
import { ApiError, notFound } from '../utils/http';

const ACTOR = 'operator@ledgerlens.local';

export function reconciliationRouter(services: Services) {
  const router = Router();

  router.get('/reconciliation/exceptions', async (req, res, next) => {
    try {
      const query = exceptionListSchema.parse(req.query);
      if (query.from && query.to && Date.parse(query.from) > Date.parse(query.to)) {
        throw new ApiError(400, 'INVALID_RANGE', 'from must be before to');
      }
      const result = await services.exceptions.list(
        {
          page: query.page,
          limit: query.limit,
          q: query.q,
          type: query.type,
          status: query.status,
          from: query.from,
          to: query.to,
          sortBy: query.sortBy,
          sortDir: query.sortDir,
        },
        services.config.appEnvironment,
      );
      const { items, ...meta } = result;
      res.json({ data: items, meta });
    } catch (error) {
      next(error);
    }
  });

  router.get('/reconciliation/exceptions/:reference', async (req, res, next) => {
    try {
      const detail = await services.exceptions.detail(
        req.params.reference,
        services.config.appEnvironment,
      );
      res.json({ data: detail });
    } catch (error) {
      next(error);
    }
  });

  router.post('/reconciliation/exceptions/:reference/assign', async (req, res, next) => {
    try {
      const body = assignExceptionSchema.parse(req.body);
      const detail = await services.exceptions.assign(
        req.params.reference,
        services.config.appEnvironment,
        body,
        ACTOR,
      );
      res.json({ data: detail });
    } catch (error) {
      next(error);
    }
  });

  router.post('/reconciliation/exceptions/:reference/resolve', async (req, res, next) => {
    try {
      const body = resolveExceptionSchema.parse(req.body);
      const detail = await services.exceptions.resolve(
        req.params.reference,
        services.config.appEnvironment,
        body,
        ACTOR,
      );
      res.json({ data: detail });
    } catch (error) {
      next(error);
    }
  });

  router.post('/reconciliation/run', async (req, res, next) => {
    try {
      const body = runReconciliationSchema.parse(req.body ?? {});
      if (body.scope === 'payment') {
        const payment = body.transactionRef
          ? await services.repo.getPayment(body.transactionRef)
          : null;
        if (!payment || payment.environment !== services.config.appEnvironment) {
          throw notFound('Transaction', body.transactionRef ?? '');
        }
        const result = await services.reconciliation.runForPayment(
          payment.transactionRef,
          services.config.appEnvironment,
          'operator',
        );
        res.json({ data: result });
        return;
      }
      const result = await services.reconciliation.run({
        environment: services.config.appEnvironment,
        triggeredBy: 'operator',
        scope: { type: 'all' },
      });
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  });

  router.get('/reconciliation/runs', async (req, res, next) => {
    try {
      const runs = await services.repo.listRuns(services.config.appEnvironment, 20);
      res.json({ data: runs });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
