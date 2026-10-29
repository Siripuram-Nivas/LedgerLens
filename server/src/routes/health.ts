import { Router } from 'express';
import type { Services } from '../services/container';

export function healthRouter(services: Services) {
  const router = Router();
  router.get('/health', async (_req, res) => {
    const started = Date.now();
    try {
      await services.store.ping();
      res.json({
        data: {
          status: 'ok',
          version: services.config.version,
          uptimeSeconds: Math.round(process.uptime()),
          dbLatencyMs: Date.now() - started,
          persistence: services.store.engine,
          demoMode: services.config.DEMO_MODE,
          environment: services.config.appEnvironment,
          provider: services.config.PAYMENT_PROVIDER,
          realtime: 'socket.io',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      services.logger.error({ err: error }, 'Health check failed');
      res.status(503).json({
        error: {
          code: 'DATABASE_UNAVAILABLE',
          message: 'The persistence layer is not reachable.',
          requestId: _req.requestId,
        },
      });
    }
  });
  return router;
}
