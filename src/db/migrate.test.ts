import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';

// Mock pg
vi.mock('pg', () => {
  const mockQuery = vi.fn();
  const MockPool = vi.fn().mockImplementation(() => ({ query: mockQuery }));
  return { Pool: MockPool };
});

// Mock fs
vi.mock('fs', () => ({
  readdirSync: vi.fn(),
  readFileSync: vi.fn(),
}));

import { runMigrations } from './migrate';
import { Pool } from 'pg';

describe('runMigrations', () => {
  let mockQuery: ReturnType<typeof vi.fn>;
  let pool: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery = vi.fn();
    pool = { query: mockQuery };
  });

  it('creates schema_migrations table and applies pending migrations', async () => {
    // ensureMigrationsTable
    mockQuery.mockResolvedValueOnce({});
    // getAppliedMigrations - no migrations applied yet
    mockQuery.mockResolvedValueOnce({ rows: [] });
    // BEGIN
    mockQuery.mockResolvedValueOnce({});
    // migration SQL
    mockQuery.mockResolvedValueOnce({});
    // INSERT into schema_migrations
    mockQuery.mockResolvedValueOnce({});
    // COMMIT
    mockQuery.mockResolvedValueOnce({});

    vi.mocked(fs.readdirSync).mockReturnValue(['001_initial_schema.sql'] as any);
    vi.mocked(fs.readFileSync).mockReturnValue('CREATE TABLE test();');

    const ran = await runMigrations(pool);

    expect(ran).toEqual(['001_initial_schema.sql']);
    expect(mockQuery).toHaveBeenCalledWith('BEGIN');
    expect(mockQuery).toHaveBeenCalledWith('CREATE TABLE test();');
    expect(mockQuery).toHaveBeenCalledWith('COMMIT');
  });

  it('skips already-applied migrations', async () => {
    mockQuery.mockResolvedValueOnce({});
    mockQuery.mockResolvedValueOnce({
      rows: [{ filename: '001_initial_schema.sql' }],
    });

    vi.mocked(fs.readdirSync).mockReturnValue(['001_initial_schema.sql'] as any);

    const ran = await runMigrations(pool);

    expect(ran).toEqual([]);
  });

  it('rolls back on migration failure', async () => {
    mockQuery.mockResolvedValueOnce({});
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({}); // BEGIN
    mockQuery.mockRejectedValueOnce(new Error('syntax error')); // migration SQL fails
    mockQuery.mockResolvedValueOnce({}); // ROLLBACK

    vi.mocked(fs.readdirSync).mockReturnValue(['001_bad.sql'] as any);
    vi.mocked(fs.readFileSync).mockReturnValue('INVALID SQL;');

    await expect(runMigrations(pool)).rejects.toThrow('syntax error');
    expect(mockQuery).toHaveBeenCalledWith('ROLLBACK');
  });
});
