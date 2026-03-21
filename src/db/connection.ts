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

export async function connectWithRetry(
  options: ConnectOptions = {}
): Promise<Pool> {
  const {
    maxRetries = MAX_RETRIES,
    retryIntervalMs = RETRY_INTERVAL_MS,
    poolConfig,
  } = options;

  const config: PoolConfig = poolConfig ?? {
    connectionString:
      process.env.DATABASE_URL ||
      'postgres://gofish:gofish@db:5432/gofish',
  };

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

let defaultPool: Pool | null = null;

export async function getPool(options?: ConnectOptions): Promise<Pool> {
  if (!defaultPool) {
    defaultPool = await connectWithRetry(options);
  }
  return defaultPool;
}

export async function closePool(): Promise<void> {
  if (defaultPool) {
    await defaultPool.end();
    defaultPool = null;
  }
}
