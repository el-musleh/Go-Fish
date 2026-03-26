import express from 'express';
import path from 'path';
import fs from 'fs';
import { Pool } from 'pg';
import { createTasteBenchmarkRouter } from './routes/tasteBenchmarkRouter';
import { createEventRouter } from './routes/eventRouter';
import { createInviteRouter } from './routes/inviteRouter';
import { createResponseRouter } from './routes/responseRouter';
import { createAuthRouter } from './routes/authRouter';
import { createNotificationRouter } from './routes/notificationRouter';

const app = express();

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

/**
 * Mount routes that require a database pool.
 * Call this after the pool is ready.
 */
export function mountRoutes(pool: Pool): void {
  app.use('/api/auth', createAuthRouter(pool));
  app.use('/api/taste-benchmark', createTasteBenchmarkRouter(pool));
  app.use('/api/events', createEventRouter(pool));
  app.use('/api/invite', createInviteRouter(pool));
  app.use('/api/events/:eventId/responses', createResponseRouter(pool));
  app.use('/api/notifications', createNotificationRouter(pool));

  // Return 404 for unmatched /api/* routes before falling through to the SPA
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'not_found', message: 'API endpoint not found.' });
  });

  // Serve built frontend — must come after all API routes
  const clientDist = path.join(__dirname, '../client/dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  // Global Error Handler
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[Unhandled Error]', err);
    
    const statusCode = err.status || err.statusCode || 500;
    const message = err.message || 'An unexpected error occurred';
    
    res.status(statusCode).json({
      error: err.name || 'InternalServerError',
      message: message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
  });
}

export default app;
