import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createInviteRouter } from './inviteRouter';

vi.mock('../repositories/invitationLinkRepository', () => ({
  getInvitationLinkByToken: vi.fn(),
}));

vi.mock('../repositories/eventRepository', () => ({
  getEventById: vi.fn(),
}));

import { getInvitationLinkByToken } from '../repositories/invitationLinkRepository';
import { getEventById } from '../repositories/eventRepository';

const mockPool = {} as any;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/invite', createInviteRouter(mockPool));
  return app;
}

describe('GET /api/invite/:linkToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 for an invalid token', async () => {
    (getInvitationLinkByToken as any).mockResolvedValue(null);
    const app = buildApp();
    const res = await request(app).get('/api/invite/bad-token');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('invalid_link');
  });

  it('returns 401 with redirect info for unauthenticated users', async () => {
    (getInvitationLinkByToken as any).mockResolvedValue({
      id: 'link-1',
      event_id: 'evt-1',
      token: 'valid-token',
      created_at: new Date(),
    });
    (getEventById as any).mockResolvedValue({
      id: 'evt-1',
      title: 'Game Night',
      description: 'Board games',
      status: 'collecting',
    });

    const app = buildApp();
    const res = await request(app).get('/api/invite/valid-token');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('auth_required');
    expect(res.body.redirect).toContain('/?auth=1');
    expect(res.body.redirect).toContain('returnTo');
    expect(res.body.eventId).toBe('evt-1');
  });

  it('returns event details for authenticated users', async () => {
    (getInvitationLinkByToken as any).mockResolvedValue({
      id: 'link-1',
      event_id: 'evt-1',
      token: 'valid-token',
      created_at: new Date(),
    });
    (getEventById as any).mockResolvedValue({
      id: 'evt-1',
      title: 'Game Night',
      description: 'Board games',
      status: 'collecting',
    });

    const app = buildApp();
    const res = await request(app)
      .get('/api/invite/valid-token')
      .set('x-user-id', 'user-2');

    expect(res.status).toBe(200);
    expect(res.body.eventId).toBe('evt-1');
    expect(res.body.title).toBe('Game Night');
    expect(res.body.description).toBe('Board games');
    expect(res.body.status).toBe('collecting');
  });

  it('returns 404 when token is valid but event is missing', async () => {
    (getInvitationLinkByToken as any).mockResolvedValue({
      id: 'link-1',
      event_id: 'evt-gone',
      token: 'orphan-token',
      created_at: new Date(),
    });
    (getEventById as any).mockResolvedValue(null);

    const app = buildApp();
    const res = await request(app)
      .get('/api/invite/orphan-token')
      .set('x-user-id', '00000000-0000-0000-0000-000000000001');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });
});
