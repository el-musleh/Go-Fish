import { describe, it, expect, vi, beforeEach } from 'vitest';
import { connectWithRetry } from './connection';

// Mock pg module
vi.mock('pg', () => {
  const mockRelease = vi.fn();
  const mockConnect = vi.fn();
  const mockEnd = vi.fn();
  const MockPool = vi.fn().mockImplementation(() => ({
    connect: mockConnect,
    end: mockEnd,
  }));
  return { Pool: MockPool, mockConnect, mockRelease, mockEnd };
});

// Access the mocked functions
import { Pool } from 'pg';
const getMockPool = () => {
  const instance = new (Pool as any)();
  return {
    connect: (Pool as any).mock.results[
      (Pool as any).mock.results.length - 1
    ].value.connect as ReturnType<typeof vi.fn>,
    end: (Pool as any).mock.results[
      (Pool as any).mock.results.length - 1
    ].value.end as ReturnType<typeof vi.fn>,
  };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('connectWithRetry', () => {
  it('connects successfully on first attempt', async () => {
    const release = vi.fn();
    const mockConnect = vi.fn().mockResolvedValue({ release });

    vi.mocked(Pool).mockImplementation(
      () => ({ connect: mockConnect, end: vi.fn() }) as any
    );

    const pool = await connectWithRetry({
      maxRetries: 5,
      retryIntervalMs: 0,
      poolConfig: { connectionString: 'postgres://test' },
    });

    expect(mockConnect).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledTimes(1);
    expect(pool).toBeDefined();
  });

  it('retries on failure and succeeds on third attempt', async () => {
    const release = vi.fn();
    const mockConnect = vi
      .fn()
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValueOnce({ release });

    vi.mocked(Pool).mockImplementation(
      () => ({ connect: mockConnect, end: vi.fn() }) as any
    );

    const pool = await connectWithRetry({
      maxRetries: 5,
      retryIntervalMs: 0,
      poolConfig: { connectionString: 'postgres://test' },
    });

    expect(mockConnect).toHaveBeenCalledTimes(3);
    expect(release).toHaveBeenCalledTimes(1);
    expect(pool).toBeDefined();
  });

  it('throws after exhausting all retries', async () => {
    const mockEnd = vi.fn();
    const mockConnect = vi
      .fn()
      .mockRejectedValue(new Error('ECONNREFUSED'));

    vi.mocked(Pool).mockImplementation(
      () => ({ connect: mockConnect, end: mockEnd }) as any
    );

    await expect(
      connectWithRetry({
        maxRetries: 3,
        retryIntervalMs: 0,
        poolConfig: { connectionString: 'postgres://test' },
      })
    ).rejects.toThrow('ECONNREFUSED');

    expect(mockConnect).toHaveBeenCalledTimes(3);
    expect(mockEnd).toHaveBeenCalledTimes(1);
  });

  it('logs descriptive error on each failed attempt', async () => {
    const consoleSpy = vi.spyOn(console, 'error');
    const mockConnect = vi
      .fn()
      .mockRejectedValue(new Error('connection refused'));

    vi.mocked(Pool).mockImplementation(
      () => ({ connect: mockConnect, end: vi.fn() }) as any
    );

    await expect(
      connectWithRetry({
        maxRetries: 2,
        retryIntervalMs: 0,
        poolConfig: { connectionString: 'postgres://test' },
      })
    ).rejects.toThrow();

    // Should log each attempt + final give-up message
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('attempt 1/2 failed: connection refused')
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('attempt 2/2 failed: connection refused')
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to connect to database after 2 attempts')
    );

    consoleSpy.mockRestore();
  });

  it('cleans up pool after exhausting retries', async () => {
    const mockEnd = vi.fn();
    const mockConnect = vi
      .fn()
      .mockRejectedValue(new Error('ECONNREFUSED'));

    vi.mocked(Pool).mockImplementation(
      () => ({ connect: mockConnect, end: mockEnd }) as any
    );

    await expect(
      connectWithRetry({
        maxRetries: 1,
        retryIntervalMs: 0,
        poolConfig: { connectionString: 'postgres://test' },
      })
    ).rejects.toThrow();

    expect(mockEnd).toHaveBeenCalledTimes(1);
  });
});
