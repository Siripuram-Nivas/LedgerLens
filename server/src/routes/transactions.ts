import { Router } from 'express';
import type { Services } from '../services/container';
import { transactionListSchema } from './validation';
import { ApiError } from '../utils/http';

export function transactionsRouter(services: Services) {
  const router = Router();

  router.get('/transactions', async (req, res, next) => {
    try {
      const query = transactionListSchema.parse(req.query);
      if (query.from && query.to && Date.parse(query.from) > Date.parse(query.to)) {
        throw new ApiError(400, 'INVALID_RANGE', 'from must be before to');
      }
      const result = await services.transactions.list(
        {
          page: query.page,
          limit: query.limit,
          q: query.q,
          status: query.status,
          settlementStatus: query.settlementStatus,
          reconciliationStatus: query.reconciliationStatus,
          refundStatus: query.refundStatus,
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

  router.get('/transactions/:reference', async (req, res, next) => {
    try {
      const detail = await services.transactions.detail(
        req.params.reference,
        services.config.appEnvironment,
      );
      res.json({ data: detail });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
