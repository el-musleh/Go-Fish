import express from 'express';
import path from 'path';
import fs from 'fs';
import { Pool } from 'pg';
import { createTasteBenchmarkRouter } from './routes/tasteBenchmarkRouter';
import { createEventRouter } from './routes/eventRouter';
import { createInviteRouter } from './routes/inviteRouter';
import { createResponseRouter } from './routes/responseRouter';
import { createAuthRouter } from './routes/authRouter';

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

  // Serve built frontend — must come after all API routes
  const clientDist = path.join(__dirname, '../client/dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }
}

export default app;
