import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import type { Logger } from '../logger';
import { ApiError } from '../utils/http';
import { ZodError } from 'zod';

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

export function requestLogger(logger: Logger) {
  return (req: Request, res: Response, next: NextFunction) => {
    const incoming = req.header('x-request-id');
    const id = incoming && incoming.length <= 100 ? incoming : randomUUID();
    req.requestId = id;
    res.setHeader('x-request-id', id);
    const started = process.hrtime.bigint();
    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - started) / 1_000_000;
      logger.info(
        {
          requestId: id,
          method: req.method,
          path: req.path,
          status: res.statusCode,
          durationMs: Math.round(durationMs * 10) / 10,
        },
        'http_request',
      );
    });
    next();
  };
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} was not found`,
      requestId: req.requestId,
    },
  });
}

export function errorHandler(logger: Logger) {
  return (error: unknown, req: Request, res: Response, _next: NextFunction) => {
    if (res.headersSent) return;

    if (error instanceof ZodError) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
          requestId: req.requestId,
        },
      });
      return;
    }

    if (error instanceof ApiError) {
      res.status(error.status).json({
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
          requestId: req.requestId,
        },
      });
      return;
    }

    if (error instanceof SyntaxError && 'body' in error) {
      res.status(400).json({
        error: {
          code: 'INVALID_JSON',
          message: 'The request body is not valid JSON',
          requestId: req.requestId,
        },
      });
      return;
    }

    logger.error({ err: error, requestId: req.requestId }, 'Unhandled request error');
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An internal error occurred. No stack trace or sensitive detail is exposed.',
        requestId: req.requestId,
      },
    });
  };
}
