import 'dotenv/config';
import app, { mountRoutes } from './app';
import { connectWithRetry } from './db/connection';
import { runMigrations } from './db/migrate';

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    const pool = await connectWithRetry();
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
