import dotenv from 'dotenv';
import path from 'node:path';
import { z } from 'zod';

// The API is normally launched from the server workspace; support both
// server/.env and the repository-level .env without ever committing secrets.
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

const booleanish = z
  .union([z.boolean(), z.string()])
  .transform((value) => {
    if (typeof value === 'boolean') return value;
    return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
  });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().max(65535).default(4000),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  CORS_ORIGINS: z.string().optional(),
  PERSISTENCE: z.enum(['sqlite', 'mongodb']).default('sqlite'),
  SQLITE_PATH: z.string().default('./data/ledgerlens-demo.db'),
  MONGODB_URI: z.string().optional(),
  DEMO_MODE: booleanish.default(true),
  DEMO_SEED: booleanish.default(true),
  PAYMENT_PROVIDER: z.enum(['demo', 'razorpay']).default('demo'),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  RAZORPAY_ENVIRONMENT: z.enum(['sandbox', 'live']).default('sandbox'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  JSON_BODY_LIMIT: z.string().default('100kb'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
});

export type AppConfig = ReturnType<typeof loadConfig>;

export function loadConfig(overrides: Record<string, unknown> = {}) {
  const parsed = envSchema.safeParse({ ...process.env, ...overrides });
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  const env = parsed.data;

  if (env.PERSISTENCE === 'mongodb' && !env.MONGODB_URI) {
    throw new Error('PERSISTENCE=mongodb requires MONGODB_URI. Refusing to fall back to SQLite silently.');
  }
  if (env.PAYMENT_PROVIDER === 'razorpay' && env.DEMO_MODE) {
    // Demo mode stays usable, but the real webhook still needs its own secret.
    // We surface this in logs rather than disabling signature verification.
  }

  const origins = (env.CORS_ORIGINS ?? env.CLIENT_URL)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return {
    ...env,
    isTest: env.NODE_ENV === 'test',
    isProduction: env.NODE_ENV === 'production',
    persistenceDescription:
      env.PERSISTENCE === 'sqlite' ? `SQLite file (${env.SQLITE_PATH})` : 'MongoDB',
    origins,
    appEnvironment: env.DEMO_MODE ? 'demo' : env.RAZORPAY_ENVIRONMENT,
    realtimeNamespace: '/realtime',
    version: '1.0.0',
  } as const;
}
