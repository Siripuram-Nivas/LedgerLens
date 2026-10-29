import { Router } from 'express';
import type { Services } from '../services/container';
import { refundListSchema } from './validation';
import { ApiError } from '../utils/http';

const ACTOR = 'operator@ledgerlens.local';

export function refundsRouter(services: Services) {
  const router = Router();

  router.get('/refunds', async (req, res, next) => {
    try {
      const query = refundListSchema.parse(req.query);
      if (query.from && query.to && Date.parse(query.from) > Date.parse(query.to)) {
        throw new ApiError(400, 'INVALID_RANGE', 'from must be before to');
      }
      const result = await services.refunds.list(
        {
          page: query.page,
          limit: query.limit,
          q: query.q,
          status: query.status,
          from: query.from,
          to: query.to,
        },
        services.config.appEnvironment,
      );
      const { items, ...meta } = result;
      res.json({ data: items, meta });
    } catch (error) {
      next(error);
    }
  });

  router.get('/refunds/:reference', async (req, res, next) => {
    try {
      const detail = await services.refunds.detail(
        req.params.reference,
        services.config.appEnvironment,
      );
      res.json({ data: detail });
    } catch (error) {
      next(error);
    }
  });

  router.post('/refunds/:reference/advance-demo', async (req, res, next) => {
    try {
      const refund = await services.refunds.advanceDemo(
        req.params.reference,
        services.config.appEnvironment,
        ACTOR,
      );
      res.json({ data: refund });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
