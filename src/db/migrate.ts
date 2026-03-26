import { Pool, PoolClient } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const _distMigrations = path.join(__dirname, 'migrations');
const _srcMigrations = path.join(__dirname, '..', '..', 'src', 'db', 'migrations');
const MIGRATIONS_DIR = fs.existsSync(_distMigrations) ? _distMigrations : _srcMigrations;

async function ensureMigrationsTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getAppliedMigrations(pool: Pool): Promise<Set<string>> {
  const result = await pool.query('SELECT filename FROM schema_migrations ORDER BY id');
  return new Set(result.rows.map((row: { filename: string }) => row.filename));
}

async function getMigrationFiles(): Promise<string[]> {
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();
  return files;
}

export async function runMigrations(pool: Pool): Promise<string[]> {
  await ensureMigrationsTable(pool);
  const applied = await getAppliedMigrations(pool);
  const files = await getMigrationFiles();
  const ran: string[] = [];

  for (const file of files) {
    if (applied.has(file)) {
      continue;
    }

    const filePath = path.join(MIGRATIONS_DIR, file);
    const sql = fs.readFileSync(filePath, 'utf-8');

    const client: PoolClient = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        'INSERT INTO schema_migrations (filename) VALUES ($1)',
        [file]
      );
      await client.query('COMMIT');
      ran.push(file);
      console.log(`Migration applied: ${file}`);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`Migration failed: ${file}`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  if (ran.length === 0) {
    console.log('No new migrations to apply.');
  }

  return ran;
}
