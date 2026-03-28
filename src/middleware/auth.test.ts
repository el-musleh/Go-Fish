import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { createRequireAuth } from './auth';
import * as userRepo from '../repositories/userRepository';
import * as supabaseAdminLib from '../lib/supabaseAdmin';

vi.mock('../repositories/userRepository');
vi.mock('../lib/supabaseAdmin');

// Mock jose so JWKS verification never makes real network calls
vi.mock('jose', () => ({
  createRemoteJWKSet: vi.fn(() => 'mock-jwks-keyset'),
  jwtVerify: vi.fn(),
}));

import { jwtVerify, createRemoteJWKSet } from 'jose';

const fakePool = {} as any;

function makeUser(overrides: Partial<{ id: string; email: string }> = {}) {
  return {
    id: overrides.id ?? 'user-uuid',
    email: overrides.email ?? 'user@example.com',
    name: null,
    auth_provider: 'email' as const,
    has_taste_benchmark: false,
    created_at: new Date(),
  };
}

function mockReqResNext(token?: string) {
  const headers: Record<string, string> = {};
  if (token) headers['authorization'] = `Bearer ${token}`;
  const req = { headers } as unknown as Request;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  const next = vi.fn() as NextFunction;
  return { req, res, next };
}

function devModeReq(userId?: string) {
  const headers: Record<string, string> = {};
  if (userId) headers['x-user-id'] = userId;
  const req = { headers } as unknown as Request;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  const next = vi.fn() as NextFunction;
  return { req, res, next };
}

// ─── Dev mode ────────────────────────────────────────────────────────────────

describe('createRequireAuth — dev mode (no Supabase)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(supabaseAdminLib.getSupabaseAdmin).mockReturnValue(null as any);
  });

  it('sets userId and calls next() for a valid UUID in x-user-id', async () => {
    const id = 'dbbd193f-c5ca-4343-8b64-74a97c608ddb';
    const { req, res, next } = devModeReq(id);
    await createRequireAuth(fakePool)(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect((req as any).userId).toBe(id);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 401 when x-user-id header is missing', async () => {
    const { req, res, next } = devModeReq();
    await createRequireAuth(fakePool)(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when x-user-id is not a valid UUID', async () => {
    const { req, res, next } = devModeReq('not-a-uuid');
    await createRequireAuth(fakePool)(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

// ─── JWKS / local verification ───────────────────────────────────────────────

describe('createRequireAuth — JWKS local verification (SUPABASE_URL set)', () => {
  const mockSupabase = { auth: { getUser: vi.fn() } };

  beforeEach(() => {
    vi.resetAllMocks();
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    vi.mocked(supabaseAdminLib.getSupabaseAdmin).mockReturnValue(mockSupabase as any);
    // createRemoteJWKSet is called once at module init; keep returning the stub keyset
    vi.mocked(createRemoteJWKSet).mockReturnValue('mock-jwks-keyset' as any);
  });

  it('returns 401 when Authorization header is missing', async () => {
    const { req, res, next } = mockReqResNext();
    await createRequireAuth(fakePool)(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('verifies token via JWKS, never calls Supabase, sets userId, calls next()', async () => {
    vi.mocked(jwtVerify).mockResolvedValue({ payload: { email: 'jwks-ok@example.com' } } as any);
    vi.mocked(userRepo.getUserByEmail).mockResolvedValue(makeUser({ id: 'jwks-uuid', email: 'jwks-ok@example.com' }));

    const { req, res, next } = mockReqResNext('good-token');
    await createRequireAuth(fakePool)(req, res, next);

    expect(jwtVerify).toHaveBeenCalledWith('good-token', 'mock-jwks-keyset');
    expect(mockSupabase.auth.getUser).not.toHaveBeenCalled();
    expect(userRepo.getUserByEmail).toHaveBeenCalledWith(fakePool, 'jwks-ok@example.com');
    expect(next).toHaveBeenCalledOnce();
    expect((req as any).userId).toBe('jwks-uuid');
  });

  it('returns 401 and skips DB when jwtVerify throws (expired/invalid token)', async () => {
    vi.mocked(jwtVerify).mockRejectedValue(new Error('JWTExpired'));

    const { req, res, next } = mockReqResNext('expired-token');
    await createRequireAuth(fakePool)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
    expect(userRepo.getUserByEmail).not.toHaveBeenCalled();
  });

  it('returns 401 when JWT payload has no email claim', async () => {
    vi.mocked(jwtVerify).mockResolvedValue({ payload: { sub: 'some-supabase-uid' } } as any);

    const { req, res, next } = mockReqResNext('no-email-token');
    await createRequireAuth(fakePool)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
    expect(userRepo.getUserByEmail).not.toHaveBeenCalled();
  });

  it('returns 401 when user is not found in DB', async () => {
    vi.mocked(jwtVerify).mockResolvedValue({ payload: { email: 'ghost@example.com' } } as any);
    vi.mocked(userRepo.getUserByEmail).mockResolvedValue(null);

    const { req, res, next } = mockReqResNext('ghost-token');
    await createRequireAuth(fakePool)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('caches email→userId: DB is queried only once across two requests with the same email', async () => {
    const email = `cache-test-${Date.now()}@example.com`;
    vi.mocked(jwtVerify).mockResolvedValue({ payload: { email } } as any);
    vi.mocked(userRepo.getUserByEmail).mockResolvedValue(makeUser({ id: 'cached-uuid', email }));

    const middleware = createRequireAuth(fakePool);

    const first = mockReqResNext('token-a');
    await middleware(first.req, first.res, first.next);
    expect(userRepo.getUserByEmail).toHaveBeenCalledTimes(1);
    expect(first.next).toHaveBeenCalledOnce();

    const second = mockReqResNext('token-b');
    await middleware(second.req, second.res, second.next);
    // Cache hit — DB must NOT be called a second time
    expect(userRepo.getUserByEmail).toHaveBeenCalledTimes(1);
    expect(second.next).toHaveBeenCalledOnce();
    expect((second.req as any).userId).toBe('cached-uuid');
  });
});

// ─── Supabase fallback ────────────────────────────────────────────────────────

describe('createRequireAuth — Supabase network fallback (no SUPABASE_URL)', () => {
  const mockSupabase = { auth: { getUser: vi.fn() } };

  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.SUPABASE_URL;
    vi.mocked(supabaseAdminLib.getSupabaseAdmin).mockReturnValue(mockSupabase as any);
    vi.mocked(createRemoteJWKSet).mockReturnValue(null as any);
  });

  it('calls supabase.auth.getUser(), looks up user, calls next()', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { email: 'remote-ok@example.com' } },
      error: null,
    });
    vi.mocked(userRepo.getUserByEmail).mockResolvedValue(makeUser({ id: 'remote-uuid', email: 'remote-ok@example.com' }));

    const { req, res, next } = mockReqResNext('supabase-token');
    await createRequireAuth(fakePool)(req, res, next);

    expect(mockSupabase.auth.getUser).toHaveBeenCalledWith('supabase-token');
    expect(jwtVerify).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
    expect((req as any).userId).toBe('remote-uuid');
  });

  it('returns 401 when Supabase returns an error', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Invalid JWT' },
    });

    const { req, res, next } = mockReqResNext('bad-token');
    await createRequireAuth(fakePool)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
    expect(userRepo.getUserByEmail).not.toHaveBeenCalled();
  });

  it('returns 401 when Supabase user has no email', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { email: undefined } },
      error: null,
    });

    const { req, res, next } = mockReqResNext('no-email-token');
    await createRequireAuth(fakePool)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
