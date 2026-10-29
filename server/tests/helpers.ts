import type { Express } from 'express';
import { createApp } from '../src/app';
import { loadConfig } from '../src/config';
import { createLogger } from '../src/logger';
import { createServices, type Services } from '../src/services/container';

export interface TestContext {
  app: Express;
  services: Services;
}

export async function createTestContext(
  overrides: Record<string, unknown> = {},
): Promise<TestContext> {
  const config = loadConfig({
    NODE_ENV: 'test',
    PERSISTENCE: 'sqlite',
    SQLITE_PATH: ':memory:',
    DEMO_MODE: 'true',
    DEMO_SEED: 'false',
    PAYMENT_PROVIDER: 'demo',
    LOG_LEVEL: 'silent',
    RATE_LIMIT_MAX: '10000',
    ...overrides,
  });
  const logger = createLogger('silent');
  const services = await createServices(config, logger, { seedDemo: false });
  return { app: createApp(services), services };
}

export async function closeTestContext(context: TestContext): Promise<void> {
  await context.services.close();
}
