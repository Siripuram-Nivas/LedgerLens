import pino from 'pino';

export function createLogger(level: string) {
  return pino({
    level,
    base: undefined,
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers["x-razorpay-signature"]',
        '*.secret',
        '*.keySecret',
        '*.webhookSecret',
        '*.razorpayKeySecret',
        '*.card',
        '*.cvv',
      ],
      censor: '[redacted]',
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}

export type Logger = ReturnType<typeof createLogger>;
