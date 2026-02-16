import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import workflowRoutes from './routes/workflowRoutes';
import adminRoutes from './routes/adminRoutes';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';
import { requestLogger } from './middlewares/requestLogger';

/**
 * Express Application Factory (TypeScript)
 *
 * Separating app creation from listening allows for testing.
 */
export function createApp(): Application {
  const app: Application = express();

  // ── Security ──
  app.use(helmet());
  app.use(cors());

  // ── Parsing ──
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // ── Logging ──
  app.use(morgan('dev'));
  app.use(requestLogger);

  // ── Health Check ──
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'OK',
      service: process.env.SERVICE_NAME || 'opsmind-workflow',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // ── Routes ──
  app.use('/workflow', workflowRoutes);
  app.use('/admin', adminRoutes);

  // ── Error Handling ──
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
