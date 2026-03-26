import { Pool, PoolConfig } from 'pg';

const MAX_RETRIES = 5;
const RETRY_INTERVAL_MS = 3000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface ConnectOptions {
  maxRetries?: number;
  retryIntervalMs?: number;
  poolConfig?: PoolConfig;
}

function buildPoolConfig(): PoolConfig {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set. Configure it in .env or Railway environment variables.'
    );
  }

  const sslEnv = (process.env.DB_SSL ?? 'false').toLowerCase();
  const ssl = sslEnv === 'true' ? { rejectUnauthorized: false } : undefined;

  return {
    connectionString,
    ssl,
    max: parseInt(process.env.DB_POOL_MAX ?? '10', 10),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT_MS ?? '10000', 10),
    // Fail fast when all connections are busy instead of waiting forever
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT_MS ?? '5000', 10),
  };
}

export async function connectWithRetry(
  options: ConnectOptions = {}
): Promise<Pool> {
  const {
    maxRetries = MAX_RETRIES,
    retryIntervalMs = RETRY_INTERVAL_MS,
    poolConfig,
  } = options;

  const config: PoolConfig = poolConfig ?? buildPoolConfig();
  const pool = new Pool(config);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const client = await pool.connect();
      client.release();
      console.log('Database connected successfully.');
      return pool;
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : String(error);
      console.error(
        `Database connection attempt ${attempt}/${maxRetries} failed: ${message}`
      );

      if (attempt === maxRetries) {
        console.error(
          `Failed to connect to database after ${maxRetries} attempts. Giving up.`
        );
        await pool.end();
        throw error;
      }

      await sleep(retryIntervalMs);
    }
  }

  // Unreachable, but satisfies TypeScript
  throw new Error('Unexpected: exhausted retries without throwing');
}
