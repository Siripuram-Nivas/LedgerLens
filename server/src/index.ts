import http from 'node:http';
import { loadConfig } from './config';
import { createLogger } from './logger';
import { createServices } from './services/container';
import { createApp } from './app';
import { setupRealtime } from './realtime/socket';

async function main() {
  const config = loadConfig();
  const logger = createLogger(config.LOG_LEVEL);
  const services = await createServices(config, logger);
  const app = createApp(services);
  const server = http.createServer(app);
  const io = setupRealtime(server, services);

  server.listen(config.PORT, () => {
    logger.info(
      {
        port: config.PORT,
        environment: config.appEnvironment,
        demoMode: config.DEMO_MODE,
        provider: config.PAYMENT_PROVIDER,
        persistence: config.persistenceDescription,
        client: config.CLIENT_URL,
        webhook:
          config.PAYMENT_PROVIDER === 'razorpay' && config.RAZORPAY_WEBHOOK_SECRET
            ? 'Razorpay signature verification enabled'
            : 'Razorpay webhook disabled (provider or secret not configured)',
      },
      'LedgerLens server started',
    );
    logger.info(`API: http://localhost:${config.PORT}/api/v1/health`);
  });

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Shutting down LedgerLens');
    io.close();
    server.close(async () => {
      try {
        await services.close();
      } finally {
        process.exit(0);
      }
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => {
    logger.error({ err: reason }, 'Unhandled promise rejection');
  });
  process.on('uncaughtException', (error) => {
    logger.fatal({ err: error }, 'Uncaught exception');
    void shutdown('uncaughtException');
  });
}

main().catch((error) => {
  // Startup failures must be visible but must not leak credentials.
  console.error('LedgerLens failed to start:', error instanceof Error ? error.message : error);
  process.exit(1);
});
