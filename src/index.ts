import 'dotenv/config';
import app, { mountRoutes } from './app';
import { connectWithRetry } from './db/connection';
import { runMigrations } from './db/migrate';

const PORT = process.env.PORT || 3000;

process.on('uncaughtException', (err) => {
  console.error('[Uncaught Exception]', err);
  // Give time for logging before exiting
  setTimeout(() => process.exit(1), 100);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Unhandled Rejection] at:', promise, 'reason:', reason);
});

async function start() {
  try {
    const pool = await connectWithRetry();

    // Prevent unhandled-error crashes when an idle client is terminated by the
    // DB server (e.g. Docker container restart, PostgreSQL admin command 57P01).
    pool.on('error', (err) => {
      console.error('Unexpected pg pool error (idle client):', err.message);
    });

    await runMigrations(pool);
    mountRoutes(pool);

    app.listen(PORT, () => {
      console.log(`Go Fish backend listening on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
