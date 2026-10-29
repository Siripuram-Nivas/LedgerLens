import rateLimit from 'express-rate-limit';
import type { AppConfig } from '../config';

export function standardLimiter(config: AppConfig) {
  return rateLimit({
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    limit: config.RATE_LIMIT_MAX,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests. Please retry shortly.',
      },
    },
  });
}

export function demoLimiter() {
  return rateLimit({
    windowMs: 60_000,
    limit: 60,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many demo scenario requests. Please wait a minute.',
      },
    },
  });
}
