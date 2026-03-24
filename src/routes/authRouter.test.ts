import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createAuthRouter } from './authRouter';

// Mock dependencies
vi.mock('../repositories/userRepository', () => ({
  getUserById: vi.fn(),
  updateUser: vi.fn(),
  getUserByEmail: vi.fn(),
  createUser: vi.fn(),
}));

import { getUserById, updateUser } from '../repositories/userRepository';

const mockPool = {
  query: vi.fn(),
} as any;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', createAuthRouter(mockPool));
  return app;
}

describe('Auth Router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/auth/me', () => {
    it('returns 401 when not authenticated', async () => {
      const app = buildApp();
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('returns 200 and user profile when authenticated', async () => {
      const mockUser = { id: 'user-1', email: 'test@example.com', name: 'Test User' };
      (getUserById as any).mockResolvedValue(mockUser);

      const app = buildApp();
      const res = await request(app)
        .get('/api/auth/me')
        .set('x-user-id', 'user-1');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockUser);
      expect(getUserById).toHaveBeenCalledWith(mockPool, 'user-1');
    });
  });

  describe('GET /api/auth/storage-info', () => {
    it('returns storage statistics', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '5' }] }) // events
        .mockResolvedValueOnce({ rows: [{ count: '10' }] }) // responses
        .mockResolvedValueOnce({ rows: [{ id: 'bm-1' }] }); // benchmark

      const app = buildApp();
      const res = await request(app)
        .get('/api/auth/storage-info')
        .set('x-user-id', 'user-1');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        eventsCreated: 5,
        responsesSubmitted: 10,
        hasTasteBenchmark: true,
      });
    });
  });

  describe('PATCH /api/auth/me', () => {
    it('updates and returns the user profile', async () => {
      const updatedUser = { id: 'user-1', email: 'test@example.com', name: 'New Name' };
      (updateUser as any).mockResolvedValue(updatedUser);

      const app = buildApp();
      const res = await request(app)
        .patch('/api/auth/me')
        .set('x-user-id', 'user-1')
        .send({ name: 'New Name' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual(updatedUser);
      expect(updateUser).toHaveBeenCalledWith(mockPool, 'user-1', { name: 'New Name' });
    });
  });
});
