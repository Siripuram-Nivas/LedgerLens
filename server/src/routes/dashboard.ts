import { Router } from 'express';
import type { Services } from '../services/container';
import { dashboardQuerySchema } from './validation';
import { ApiError } from '../utils/http';

export function dashboardRouter(services: Services) {
  const router = Router();

  router.get('/dashboard/summary', async (req, res, next) => {
    try {
      const query = dashboardQuerySchema.parse(req.query);
      if (query.range === 'custom' && !query.from) {
        throw new ApiError(400, 'INVALID_RANGE', 'A from timestamp is required for a custom range');
      }
      let summary;
      try {
        summary = await services.dashboard.summary({
          environment: services.config.appEnvironment,
          preset: query.range,
          from: query.from,
          to: query.to,
        });
      } catch (error) {
        throw new ApiError(
          400,
          'INVALID_RANGE',
          error instanceof Error ? error.message : 'The selected date range is invalid',
        );
      }
      res.json({ data: summary });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
