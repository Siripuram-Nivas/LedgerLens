import { Router } from 'express';
import type { Services } from '../services/container';
import { settlementListSchema } from './validation';
import { ApiError } from '../utils/http';

export function settlementsRouter(services: Services) {
  const router = Router();

  router.get('/settlements', async (req, res, next) => {
    try {
      const query = settlementListSchema.parse(req.query);
      if (query.from && query.to && Date.parse(query.from) > Date.parse(query.to)) {
        throw new ApiError(400, 'INVALID_RANGE', 'from must be before to');
      }
      const result = await services.settlements.list(
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

  router.get('/settlements/:reference', async (req, res, next) => {
    try {
      const detail = await services.settlements.detail(
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
