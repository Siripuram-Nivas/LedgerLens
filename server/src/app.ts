import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import type { Services } from './services/container';
import { requestLogger, errorHandler, notFoundHandler } from './middleware/errorHandler';
import { standardLimiter } from './middleware/rateLimit';
import { webhookRouter } from './routes/webhooks';
import { apiRouter } from './routes';
import { ApiError } from './utils/http';

export function createApp(services: Services): Express {
  const app = express();
  const { config, logger } = services;
  app.set('trust proxy', config.TRUST_PROXY);
  app.disable('x-powered-by');

  app.use(
    helmet({
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          baseUri: ["'self'"],
          fontSrc: ["'self'", 'data:'],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          imgSrc: ["'self'", 'data:'],
          objectSrc: ["'none'"],
          scriptSrc: ["'self'"],
          scriptSrcAttr: ["'none'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          connectSrc: ["'self'", 'ws:', 'wss:'],
          upgradeInsecureRequests: null,
        },
      },
    }),
  );
  const corsOptions = {
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Request-Id', 'X-Razorpay-Signature', 'X-Razorpay-Event-Id'],
    credentials: false,
  };
  // `npm start` serves the built client from this same server, so a same-origin
  // browser request (for example a module script on PORT=4000) must be allowed
  // even when its port is not listed in CORS_ORIGINS.
  app.use(
    cors((req, callback) => {
      const origin = req.headers.origin;
      if (!origin) {
        callback(null, corsOptions);
        return;
      }
      let sameOrigin = false;
      try {
        sameOrigin = new URL(origin).host === req.headers.host;
      } catch {
        sameOrigin = false;
      }
      if (sameOrigin || config.origins.includes(origin)) {
        callback(null, { ...corsOptions, origin: true });
        return;
      }
      callback(new ApiError(403, 'CORS_ORIGIN_DENIED', 'Origin is not allowed by CORS policy'));
    }),
  );
  app.use(requestLogger(logger));
  app.use('/api', standardLimiter(config));

  // Raw body FIRST: Razorpay signs the unmodified bytes. This router must be
  // mounted before express.json().
  app.use('/api/v1', webhookRouter(services));

  app.use(express.json({ limit: config.JSON_BODY_LIMIT, strict: true }));
  app.use('/api/v1', apiRouter(services));
  app.use('/api', notFoundHandler);

  const clientDist = path.resolve(__dirname, '../../client/dist');
  const indexFile = path.join(clientDist, 'index.html');
  if (fs.existsSync(indexFile)) {
    app.use(
      express.static(clientDist, {
        index: false,
        maxAge: '1h',
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('index.html')) res.setHeader('cache-control', 'no-cache');
        },
      }),
    );
    app.get(/^(?!\/api(?:\/|$)|\/socket\.io).*/, (_req, res) => {
      res.setHeader('cache-control', 'no-cache');
      res.sendFile(indexFile);
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler(logger));
  return app;
}
