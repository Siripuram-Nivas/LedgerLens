import { Router } from 'express';
import type { Services } from '../services/container';
import { eventListSchema } from './validation';
import { ApiError } from '../utils/http';

export function eventsRouter(services: Services) {
  const router = Router();

  router.get('/events', async (req, res, next) => {
    try {
      const query = eventListSchema.parse(req.query);
      if (query.from && query.to && Date.parse(query.from) > Date.parse(query.to)) {
        throw new ApiError(400, 'INVALID_RANGE', 'from must be before to');
      }
      const result = await services.eventLog.list(
        {
          page: query.page,
          limit: query.limit,
          q: query.q,
          processingStatus: query.processingStatus,
          type: query.type,
          duplicateOnly: query.duplicateOnly,
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

  router.get('/events/:reference', async (req, res, next) => {
    try {
      const detail = await services.eventLog.detail(
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
