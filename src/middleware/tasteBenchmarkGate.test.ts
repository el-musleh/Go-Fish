import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { tasteBenchmarkGate } from './tasteBenchmarkGate';
import * as userRepo from '../repositories/userRepository';

vi.mock('../repositories/userRepository');

function mockReqResNext(userId?: string) {
  const req = { headers: {}, userId } as unknown as Request;
  if (userId) (req as any).userId = userId;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  const next = vi.fn() as NextFunction;
  return { req, res, next };
}

describe('tasteBenchmarkGate', () => {
  const fakePool = {} as any;
  let middleware: ReturnType<typeof tasteBenchmarkGate>;

  beforeEach(() => {
    vi.resetAllMocks();
    middleware = tasteBenchmarkGate(fakePool);
  });

  it('returns 401 when userId is not set', async () => {
    const { req, res, next } = mockReqResNext();
    await middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when user is not found in DB', async () => {
    vi.mocked(userRepo.getUserById).mockResolvedValue(null);
    const { req, res, next } = mockReqResNext('user-123');
    await middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'unauthorized', message: 'User not found.' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 with redirect hint when benchmark not completed', async () => {
    vi.mocked(userRepo.getUserById).mockResolvedValue({
      id: 'user-123',
      email: 'a@b.com',
      name: null,
      auth_provider: 'email',
      has_taste_benchmark: false,
      created_at: new Date(),
    });
    const { req, res, next } = mockReqResNext('user-123');
    await middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'benchmark_required',
        redirect: '/api/taste-benchmark',
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() when benchmark is completed', async () => {
    vi.mocked(userRepo.getUserById).mockResolvedValue({
      id: 'user-123',
      email: 'a@b.com',
      name: null,
      auth_provider: 'email',
      has_taste_benchmark: true,
      created_at: new Date(),
    });
    const { req, res, next } = mockReqResNext('user-123');
    await middleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 500 when getUserById throws', async () => {
    vi.mocked(userRepo.getUserById).mockRejectedValue(new Error('DB down'));
    const { req, res, next } = mockReqResNext('user-123');
    await middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });
});
