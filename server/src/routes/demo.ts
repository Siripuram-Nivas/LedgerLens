import { Router } from 'express';
import type { Services } from '../services/container';
import { demoResetSchema, demoScenarioSchema } from './validation';
import { demoLimiter } from '../middleware/rateLimit';
import { ApiError } from '../utils/http';
import { DEMO_SCENARIOS, RESET_CONFIRMATION } from '../services/demoService';

const ACTOR = 'operator@ledgerlens.local';

export function demoRouter(services: Services) {
  const router = Router();

  router.get('/demo/status', async (_req, res, next) => {
    try {
      if (!services.config.DEMO_MODE) {
        res.json({ data: { enabled: false, scenarios: [], resetConfirmation: null } });
        return;
      }
      const pending = await services.demo.pendingSettlementSummary();
      res.json({
        data: {
          enabled: true,
          scenarios: DEMO_SCENARIOS,
          resetConfirmation: RESET_CONFIRMATION,
          pendingSettlements: pending,
          isolation:
            'Demo records use source=demo and environment=demo. Reset removes only those records.',
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/demo/scenarios', demoLimiter(), async (req, res, next) => {
    try {
      if (!services.config.DEMO_MODE) {
        throw new ApiError(403, 'DEMO_DISABLED', 'Demo scenarios are disabled in this environment');
      }
      const body = demoScenarioSchema.parse(req.body);
      const result = await services.demo.runScenario(body.scenario, {
        amountMinor: body.amountMinor,
        note: body.note,
      }, ACTOR);
      res.status(201).json({ data: result });
    } catch (error) {
      next(error);
    }
  });

  router.post('/demo/reset', demoLimiter(), async (req, res, next) => {
    try {
      const body = demoResetSchema.parse(req.body ?? {});
      const result = await services.demo.reset(body.confirm, ACTOR);
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
