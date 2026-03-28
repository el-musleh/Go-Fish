import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createEventRouter } from './eventRouter';

vi.mock('../repositories/eventRepository', () => ({
  createEvent: vi.fn(),
  getEventById: vi.fn(),
  getEventsByInviterId: vi.fn(),
  getEventsByIds: vi.fn(),
  updateEventStatus: vi.fn(),
  saveEventSuggestions: vi.fn(),
  closeResponseWindow: vi.fn(),
  transitionEventStatus: vi.fn(),
  archiveExpiredEvents: vi.fn(),
}));

vi.mock('../repositories/invitationLinkRepository', () => ({
  createInvitationLink: vi.fn(),
  getInvitationLinkByEventId: vi.fn(),
}));

vi.mock('../services/responseWindowScheduler', () => ({
  triggerGeneration: vi.fn(),
  scheduleResponseWindow: vi.fn(),
}));

vi.mock('../services/eventPreviewService', () => ({
  generateEventSuggestions: vi.fn(),
}));

vi.mock('../repositories/responseRepository', () => ({
  getResponsesByEventId: vi.fn(),
  getEventIdsRespondedByUser: vi.fn(),
  getResponsesForEvents: vi.fn(),
}));

vi.mock('../repositories/activityOptionRepository', () => ({
  getActivityOptionsByEventId: vi.fn(),
  getActivityOptionById: vi.fn(),
  markActivityOptionSelected: vi.fn(),
  getActivityOptionsForEvents: vi.fn(),
  selectActivityOptionTx: vi.fn(),
}));

vi.mock('../repositories/userRepository', () => ({
  getUserById: vi.fn(),
  getUsersByIds: vi.fn(),
}));

vi.mock('../lib/supabaseAdmin', () => ({
  getSupabaseAdmin: vi.fn().mockReturnValue(null),
}));

import {
  createEvent,
  getEventById,
  getEventsByInviterId,
  getEventsByIds,
  updateEventStatus,
  saveEventSuggestions,
  closeResponseWindow,
  transitionEventStatus,
} from '../repositories/eventRepository';
import { createInvitationLink, getInvitationLinkByEventId } from '../repositories/invitationLinkRepository';
import { scheduleResponseWindow, triggerGeneration } from '../services/responseWindowScheduler';
import { getActivityOptionsByEventId, getActivityOptionById, markActivityOptionSelected, getActivityOptionsForEvents, selectActivityOptionTx } from '../repositories/activityOptionRepository';
import { generateEventSuggestions } from '../services/eventPreviewService';
import { getEventIdsRespondedByUser, getResponsesByEventId, getResponsesForEvents } from '../repositories/responseRepository';
import { getUserById, getUsersByIds } from '../repositories/userRepository';

const mockClient = {
  query: vi.fn(),
  release: vi.fn(),
};

const mockPool = {
  query: vi.fn(),
  connect: vi.fn().mockResolvedValue(mockClient),
} as any;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/events', createEventRouter(mockPool));
  return app;
}

describe('POST /api/events', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when no x-user-id header is provided', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/events')
      .send({ title: 'Test', description: 'Desc' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('unauthorized');
  });

  it('returns 400 when title is missing, even if description is also missing', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/events')
      .set('x-user-id', '00000000-0000-0000-0000-000000000001')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('missing_fields');
    expect(res.body.fields).toEqual(['title']);
  });

  it('returns 400 when title is missing', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/events')
      .set('x-user-id', '00000000-0000-0000-0000-000000000001')
      .send({ description: 'A description' });
    expect(res.status).toBe(400);
    expect(res.body.fields).toEqual(['title']);
  });

  it('allows creating an event without a description', async () => {
    const now = Date.now();
    const mockEvent = {
      id: 'evt-1',
      inviter_id: '00000000-0000-0000-0000-000000000001',
      title: 'A title',
      description: '',
      response_window_start: new Date(now),
      response_window_end: new Date(now + 24 * 60 * 60 * 1000),
      status: 'collecting',
      created_at: new Date(now),
    };
    (createEvent as any).mockResolvedValue(mockEvent);

    const app = buildApp();
    const res = await request(app)
      .post('/api/events')
      .set('x-user-id', '00000000-0000-0000-0000-000000000001')
      .send({ title: 'A title' });
    expect(res.status).toBe(201);
    expect(createEvent).toHaveBeenCalledWith(
      mockPool,
      expect.objectContaining({
        title: 'A title',
        description: '',
        preferred_date: null,
        preferred_time: null,
        duration_minutes: null,
      })
    );
  });

  it('returns 400 when title is an empty string', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/events')
      .set('x-user-id', '00000000-0000-0000-0000-000000000001')
      .send({ title: '   ', description: 'Desc' });
    expect(res.status).toBe(400);
    expect(res.body.fields).toEqual(['title']);
  });

  it('creates event with status collecting and a 24 hour window by default', async () => {
    const now = Date.now();
    const mockEvent = {
      id: 'evt-1',
      inviter_id: '00000000-0000-0000-0000-000000000001',
      title: 'Game Night',
      description: 'Board games at my place',
      response_window_start: new Date(now),
      response_window_end: new Date(now + 24 * 60 * 60 * 1000),
      status: 'collecting',
      created_at: new Date(now),
    };
    (createEvent as any).mockResolvedValue(mockEvent);

    const app = buildApp();
    const res = await request(app)
      .post('/api/events')
      .set('x-user-id', '00000000-0000-0000-0000-000000000001')
      .send({ title: 'Game Night', description: 'Board games at my place' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('evt-1');
    expect(res.body.status).toBe('collecting');
    expect(res.body.inviter_id).toBe('00000000-0000-0000-0000-000000000001');

    expect(createEvent).toHaveBeenCalledWith(mockPool, expect.objectContaining({
      inviter_id: '00000000-0000-0000-0000-000000000001',
      title: 'Game Night',
      description: 'Board games at my place',
      preferred_date: null,
      preferred_time: null,
      duration_minutes: null,
    }));

    // Verify the response_window_end is ~24 hours from now.
    const callArgs = (createEvent as any).mock.calls[0][1];
    const windowEnd = callArgs.response_window_end as Date;
    const diffMs = windowEnd.getTime() - now;
    expect(diffMs).toBeGreaterThanOrEqual(24 * 60 * 60 * 1000 - 5000);
    expect(diffMs).toBeLessThanOrEqual(24 * 60 * 60 * 1000 + 5000);
    expect(scheduleResponseWindow).toHaveBeenCalledWith(mockEvent, { pool: mockPool });
  });

  it('uses timeout_hours when provided', async () => {
    const now = Date.now();
    const mockEvent = {
      id: 'evt-2',
      inviter_id: '00000000-0000-0000-0000-000000000001',
      title: 'Quick Lunch',
      description: '',
      response_window_start: new Date(now),
      response_window_end: new Date(now + 6 * 60 * 60 * 1000),
      status: 'collecting',
      created_at: new Date(now),
    };
    (createEvent as any).mockResolvedValue(mockEvent);

    const app = buildApp();
    const res = await request(app)
      .post('/api/events')
      .set('x-user-id', '00000000-0000-0000-0000-000000000001')
      .send({ title: 'Quick Lunch', timeout_hours: 6 });

    expect(res.status).toBe(201);

    const callArgs = (createEvent as any).mock.calls[0][1];
    const windowEnd = callArgs.response_window_end as Date;
    const diffMs = windowEnd.getTime() - now;
    expect(diffMs).toBeGreaterThanOrEqual(6 * 60 * 60 * 1000 - 5000);
    expect(diffMs).toBeLessThanOrEqual(6 * 60 * 60 * 1000 + 5000);
    expect(scheduleResponseWindow).toHaveBeenCalledWith(mockEvent, { pool: mockPool });
  });
});

describe('event suggestions routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns cached suggestions when already saved on the event', async () => {
    (getEventById as any).mockResolvedValue({
      id: 'evt-1',
      inviter_id: '00000000-0000-0000-0000-000000000001',
      title: 'Dinner',
      description: '',
      response_window_end: new Date(Date.now() - 1000).toISOString(),
      location_city: 'Berlin',
      ai_suggestions: {
        venue_ideas: ['A MANO', 'Coccodrillo', 'Pantry'],
        estimated_cost_per_person: 'EUR20-30',
        estimated_duration_minutes: 120,
        suggested_time: '19:00-21:00',
        suggested_day: 'Friday',
      },
    });
    (getUserById as any).mockResolvedValue({ id: '00000000-0000-0000-0000-000000000001', email: 'user@example.com' });

    const app = buildApp();
    const res = await request(app)
      .get('/api/events/evt-1/suggestions')
      .set('x-user-id', '00000000-0000-0000-0000-000000000001');

    expect(res.status).toBe(200);
    expect(res.body.venue_ideas).toHaveLength(3);
    expect(generateEventSuggestions).not.toHaveBeenCalled();
  });

  it('returns pending while the response window is still open', async () => {
    (getEventById as any).mockResolvedValue({
      id: 'evt-1',
      inviter_id: '00000000-0000-0000-0000-000000000001',
      title: 'Dinner',
      description: '',
      response_window_end: new Date(Date.now() + 60_000).toISOString(),
      location_city: 'Berlin',
      ai_suggestions: null,
    });

    const app = buildApp();
    const res = await request(app)
      .get('/api/events/evt-1/suggestions')
      .set('x-user-id', '00000000-0000-0000-0000-000000000001');

    expect(res.status).toBe(200);
    expect(res.body.pending).toBe(true);
    expect(generateEventSuggestions).not.toHaveBeenCalled();
  });

  it('closes the response window and generates suggestions for the organizer', async () => {
    const suggestions = {
      venue_ideas: ['A MANO', 'Coccodrillo', 'Pantry'],
      estimated_cost_per_person: 'EUR20-30',
      estimated_duration_minutes: 120,
      suggested_time: '19:00-21:00',
      suggested_day: 'Friday',
    };

    (getEventById as any).mockResolvedValue({
      id: 'evt-1',
      inviter_id: '00000000-0000-0000-0000-000000000001',
      title: 'Dinner',
      description: '',
      response_window_end: new Date(Date.now() + 60_000).toISOString(),
      location_city: 'Berlin',
      ai_suggestions: null,
    });
    (closeResponseWindow as any).mockResolvedValue(true);
    (generateEventSuggestions as any).mockResolvedValue(suggestions);
    (saveEventSuggestions as any).mockResolvedValue(undefined);

    const app = buildApp();
    const res = await request(app)
      .post('/api/events/evt-1/end-window')
      .set('x-user-id', '00000000-0000-0000-0000-000000000001');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(suggestions);
    expect(closeResponseWindow).toHaveBeenCalledWith(mockPool, 'evt-1');
    expect(generateEventSuggestions).toHaveBeenCalledWith({
      title: 'Dinner',
      description: '',
      location_city: 'Berlin',
    }, undefined, undefined);
    expect(saveEventSuggestions).toHaveBeenCalledWith(mockPool, 'evt-1', suggestions);
  });
});

describe('GET /api/events/:eventId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when no x-user-id header is provided', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/events/evt-1');
    expect(res.status).toBe(401);
  });

  it('returns 404 when event does not exist', async () => {
    (getEventById as any).mockResolvedValue(null);
    const app = buildApp();
    const res = await request(app)
      .get('/api/events/nonexistent')
      .set('x-user-id', '00000000-0000-0000-0000-000000000001');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });

  it('returns the event when it exists', async () => {
    const mockEvent = {
      id: 'evt-1',
      inviter_id: '00000000-0000-0000-0000-000000000001',
      title: 'Game Night',
      description: 'Board games',
      status: 'collecting',
      created_at: new Date(),
    };
    (getEventById as any).mockResolvedValue(mockEvent);
    (getUserById as any).mockResolvedValue({ id: '00000000-0000-0000-0000-000000000001', email: 'user@example.com' });

    const app = buildApp();
    const res = await request(app)
      .get('/api/events/evt-1')
      .set('x-user-id', '00000000-0000-0000-0000-000000000001');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('evt-1');
    expect(res.body.title).toBe('Game Night');
    expect(getEventById).toHaveBeenCalledWith(mockPool, 'evt-1');
    expect(getUserById).toHaveBeenCalledWith(mockPool, '00000000-0000-0000-0000-000000000001');
  });
});

describe('GET /api/events', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not fetch joined events when there are no joined ids after filtering', async () => {
    (getEventsByInviterId as any).mockResolvedValue([
      { id: 'evt-1', inviter_id: '00000000-0000-0000-0000-000000000001', title: 'Game Night', description: '', status: 'collecting' },
    ]);
    (getEventIdsRespondedByUser as any).mockResolvedValue(['evt-1']);
    (getResponsesByEventId as any).mockResolvedValue([]);
    (getUserById as any).mockResolvedValue({ id: '00000000-0000-0000-0000-000000000001', email: 'user@example.com' });
    (getResponsesForEvents as any).mockResolvedValue(new Map());
    (getActivityOptionsForEvents as any).mockResolvedValue(new Map());
    (getUsersByIds as any).mockResolvedValue(new Map([['00000000-0000-0000-0000-000000000001', { id: '00000000-0000-0000-0000-000000000001', email: 'user@example.com' }]]));

    const app = buildApp();
    const res = await request(app)
      .get('/api/events')
      .set('x-user-id', '00000000-0000-0000-0000-000000000001');

    expect(res.status).toBe(200);
    expect(res.body.created).toHaveLength(1);
    expect(res.body.joined).toEqual([]);
    expect(getEventsByIds).not.toHaveBeenCalled();
  });
});

describe('POST /api/events/:eventId/link', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when no x-user-id header is provided', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/events/evt-1/link');
    expect(res.status).toBe(401);
  });

  it('returns 404 when event does not exist', async () => {
    (getEventById as any).mockResolvedValue(null);
    const app = buildApp();
    const res = await request(app)
      .post('/api/events/nonexistent/link')
      .set('x-user-id', '00000000-0000-0000-0000-000000000001');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });

  it('returns existing link if one already exists for the event', async () => {
    const mockEvent = { id: 'evt-1', inviter_id: '00000000-0000-0000-0000-000000000001', title: 'Test', status: 'collecting' };
    (getEventById as any).mockResolvedValue(mockEvent);
    (getInvitationLinkByEventId as any).mockResolvedValue({
      id: 'link-1',
      event_id: 'evt-1',
      token: 'existing-token-abc',
      created_at: new Date(),
    });

    const app = buildApp();
    const res = await request(app)
      .post('/api/events/evt-1/link')
      .set('x-user-id', '00000000-0000-0000-0000-000000000001');

    expect(res.status).toBe(200);
    expect(res.body.token).toBe('existing-token-abc');
    expect(res.body.link).toBe('/api/invite/existing-token-abc');
    expect(createInvitationLink).not.toHaveBeenCalled();
  });

  it('generates a new invitation link with a URL-safe token', async () => {
    const mockEvent = { id: 'evt-1', inviter_id: '00000000-0000-0000-0000-000000000001', title: 'Test', status: 'collecting' };
    (getEventById as any).mockResolvedValue(mockEvent);
    (getInvitationLinkByEventId as any).mockResolvedValue(null);
    (createInvitationLink as any).mockImplementation((_pool: any, data: any) =>
      Promise.resolve({ id: 'link-1', event_id: data.event_id, token: data.token, created_at: new Date() })
    );

    const app = buildApp();
    const res = await request(app)
      .post('/api/events/evt-1/link')
      .set('x-user-id', '00000000-0000-0000-0000-000000000001');

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(typeof res.body.token).toBe('string');
    expect(res.body.token.length).toBeGreaterThan(0);
    // base64url tokens only contain [A-Za-z0-9_-]
    expect(res.body.token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(res.body.link).toBe(`/api/invite/${res.body.token}`);
    expect(createInvitationLink).toHaveBeenCalledWith(mockPool, {
      event_id: 'evt-1',
      token: expect.any(String),
    });
  });
});

describe('POST /api/events/:eventId/generate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when no x-user-id header is provided', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/events/evt-1/generate');
    expect(res.status).toBe(401);
  });

  it('returns 404 when event does not exist', async () => {
    (getEventById as any).mockResolvedValue(null);
    const app = buildApp();
    const res = await request(app)
      .post('/api/events/evt-1/generate')
      .set('x-user-id', '00000000-0000-0000-0000-000000000001');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });

  it('returns 403 when user is not the inviter', async () => {
    (getEventById as any).mockResolvedValue({
      id: 'evt-1',
      inviter_id: '00000000-0000-0000-0000-000000000001',
      status: 'collecting',
    });
    const app = buildApp();
    const res = await request(app)
      .post('/api/events/evt-1/generate')
      .set('x-user-id', '00000000-0000-0000-0000-000000000002');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('forbidden');
  });

  it('returns 409 when event status is not collecting', async () => {
    (getEventById as any).mockResolvedValue({
      id: 'evt-1',
      inviter_id: '00000000-0000-0000-0000-000000000001',
      status: 'options_ready',
    });
    (transitionEventStatus as any).mockResolvedValue(false);
    const app = buildApp();
    const res = await request(app)
      .post('/api/events/evt-1/generate')
      .set('x-user-id', '00000000-0000-0000-0000-000000000001');
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('invalid_status');
  });

  it('triggers generation and returns options on success', async () => {
    const mockEvent = {
      id: 'evt-1',
      inviter_id: '00000000-0000-0000-0000-000000000001',
      status: 'collecting',
    };
    const mockOptions = [
      { title: 'Hiking', description: 'Mountain trail', suggested_date: '2025-08-01', rank: 1 },
      { title: 'Bowling', description: 'Bowling alley', suggested_date: '2025-08-02', rank: 2 },
      { title: 'Movie', description: 'Cinema night', suggested_date: '2025-08-03', rank: 3 },
    ];
    (getEventById as any).mockResolvedValue(mockEvent);
    (transitionEventStatus as any).mockResolvedValue(true);
    (triggerGeneration as any).mockResolvedValue(mockOptions);

    const app = buildApp();
    const res = await request(app)
      .post('/api/events/evt-1/generate')
      .set('x-user-id', '00000000-0000-0000-0000-000000000001');

    expect(res.status).toBe(200);
    expect(res.body.options).toHaveLength(3);
    expect(res.body.options[0].title).toBe('Hiking');
    expect(triggerGeneration).toHaveBeenCalledWith('evt-1', { pool: mockPool });
  });

  it('returns at most three unique-ranked options', async () => {
    (getEventById as any).mockResolvedValue({
      id: 'evt-1',
      inviter_id: '00000000-0000-0000-0000-000000000001',
      status: 'collecting',
    });
    (transitionEventStatus as any).mockResolvedValue(true);
    (triggerGeneration as any).mockResolvedValue([
      { title: 'Late Duplicate', description: '', suggested_date: '2025-08-04', rank: 4 },
      { title: 'Bowling', description: '', suggested_date: '2025-08-02', rank: 2 },
      { title: 'Hiking', description: '', suggested_date: '2025-08-01', rank: 1 },
      { title: 'Duplicate Rank One', description: '', suggested_date: '2025-08-05', rank: 1 },
      { title: 'Movie', description: '', suggested_date: '2025-08-03', rank: 3 },
    ]);

    const app = buildApp();
    const res = await request(app)
      .post('/api/events/evt-1/generate')
      .set('x-user-id', '00000000-0000-0000-0000-000000000001');

    expect(res.status).toBe(200);
    expect(res.body.options).toHaveLength(3);
    expect(res.body.options.map((option: { rank: number }) => option.rank)).toEqual([1, 2, 3]);
  });

  it('returns 503 when generation fails', async () => {
    (getEventById as any).mockResolvedValue({
      id: 'evt-1',
      inviter_id: '00000000-0000-0000-0000-000000000001',
      status: 'collecting',
    });
    (triggerGeneration as any).mockRejectedValue(new Error('Gemini API failed'));

    const app = buildApp();
    const res = await request(app)
      .post('/api/events/evt-1/generate')
      .set('x-user-id', '00000000-0000-0000-0000-000000000001');

    expect(res.status).toBe(503);
    expect(res.body.error).toBe('generation_failed');
  });
});

describe('GET /api/events/:eventId/options', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when no x-user-id header is provided', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/events/evt-1/options');
    expect(res.status).toBe(401);
  });

  it('returns 404 when event does not exist', async () => {
    (getEventById as any).mockResolvedValue(null);
    const app = buildApp();
    const res = await request(app)
      .get('/api/events/evt-1/options')
      .set('x-user-id', '00000000-0000-0000-0000-000000000001');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });

  it('returns activity options for the event', async () => {
    const mockEvent = { id: 'evt-1', inviter_id: '00000000-0000-0000-0000-000000000001', status: 'options_ready' };
    const mockOptions = [
      { id: 'opt-1', event_id: 'evt-1', title: 'Hiking', description: 'Trail', suggested_date: '2025-08-01', rank: 1, is_selected: false },
      { id: 'opt-2', event_id: 'evt-1', title: 'Bowling', description: 'Alley', suggested_date: '2025-08-02', rank: 2, is_selected: false },
      { id: 'opt-3', event_id: 'evt-1', title: 'Movie', description: 'Cinema', suggested_date: '2025-08-03', rank: 3, is_selected: false },
    ];
    (getEventById as any).mockResolvedValue(mockEvent);
    (getActivityOptionsByEventId as any).mockResolvedValue(mockOptions);

    const app = buildApp();
    const res = await request(app)
      .get('/api/events/evt-1/options')
      .set('x-user-id', '00000000-0000-0000-0000-000000000001');

    expect(res.status).toBe(200);
    expect(res.body.options).toHaveLength(3);
    expect(res.body.options[0].title).toBe('Hiking');
    expect(res.body.options[2].rank).toBe(3);
    expect(getActivityOptionsByEventId).toHaveBeenCalledWith(mockPool, 'evt-1');
  });

  it('returns empty array when no options exist yet', async () => {
    (getEventById as any).mockResolvedValue({ id: 'evt-1', inviter_id: '00000000-0000-0000-0000-000000000001', status: 'collecting' });
    (getActivityOptionsByEventId as any).mockResolvedValue([]);

    const app = buildApp();
    const res = await request(app)
      .get('/api/events/evt-1/options')
      .set('x-user-id', '00000000-0000-0000-0000-000000000001');

    expect(res.status).toBe(200);
    expect(res.body.options).toEqual([]);
  });

  it('filters duplicate ranks before returning saved options', async () => {
    (getEventById as any).mockResolvedValue({ id: 'evt-1', inviter_id: '00000000-0000-0000-0000-000000000001', status: 'options_ready' });
    (getActivityOptionsByEventId as any).mockResolvedValue([
      { id: 'opt-4', event_id: 'evt-1', title: 'Late Duplicate', description: 'Later', suggested_date: '2025-08-04', rank: 4, is_selected: false },
      { id: 'opt-2', event_id: 'evt-1', title: 'Bowling', description: 'Alley', suggested_date: '2025-08-02', rank: 2, is_selected: false },
      { id: 'opt-1', event_id: 'evt-1', title: 'Hiking', description: 'Trail', suggested_date: '2025-08-01', rank: 1, is_selected: false },
      { id: 'opt-1b', event_id: 'evt-1', title: 'Duplicate Rank One', description: 'Trail', suggested_date: '2025-08-05', rank: 1, is_selected: false },
      { id: 'opt-3', event_id: 'evt-1', title: 'Movie', description: 'Cinema', suggested_date: '2025-08-03', rank: 3, is_selected: false },
    ]);

    const app = buildApp();
    const res = await request(app)
      .get('/api/events/evt-1/options')
      .set('x-user-id', '00000000-0000-0000-0000-000000000001');

    expect(res.status).toBe(200);
    expect(res.body.options).toHaveLength(3);
    expect(res.body.options.map((option: { rank: number }) => option.rank)).toEqual([1, 2, 3]);
  });
});

describe('POST /api/events/:eventId/select', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when no x-user-id header is provided', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/events/evt-1/select')
      .send({ activityOptionId: 'opt-1' });
    expect(res.status).toBe(401);
  });

  it('returns 400 when activityOptionId is missing', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/events/evt-1/select')
      .set('x-user-id', '00000000-0000-0000-0000-000000000001')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('missing_fields');
  });

  it('returns 404 when event does not exist', async () => {
    (getEventById as any).mockResolvedValue(null);
    const app = buildApp();
    const res = await request(app)
      .post('/api/events/nonexistent/select')
      .set('x-user-id', '00000000-0000-0000-0000-000000000001')
      .send({ activityOptionId: 'opt-1' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });

  it('returns 403 when user is not the inviter', async () => {
    (getEventById as any).mockResolvedValue({
      id: 'evt-1',
      inviter_id: '00000000-0000-0000-0000-000000000001',
      status: 'options_ready',
    });
    const app = buildApp();
    const res = await request(app)
      .post('/api/events/evt-1/select')
      .set('x-user-id', '00000000-0000-0000-0000-000000000002')
      .send({ activityOptionId: 'opt-1' });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('forbidden');
  });

  it('returns 409 when event is already finalized', async () => {
    (getEventById as any).mockResolvedValue({
      id: 'evt-1',
      inviter_id: '00000000-0000-0000-0000-000000000001',
      status: 'finalized',
    });
    const app = buildApp();
    const res = await request(app)
      .post('/api/events/evt-1/select')
      .set('x-user-id', '00000000-0000-0000-0000-000000000001')
      .send({ activityOptionId: 'opt-1' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('already_finalized');
  });

  it('returns 409 when event status is not options_ready', async () => {
    (getEventById as any).mockResolvedValue({
      id: 'evt-1',
      inviter_id: '00000000-0000-0000-0000-000000000001',
      status: 'collecting',
    });
    const app = buildApp();
    const res = await request(app)
      .post('/api/events/evt-1/select')
      .set('x-user-id', '00000000-0000-0000-0000-000000000001')
      .send({ activityOptionId: 'opt-1' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('invalid_status');
  });

  it('returns 404 when activity option does not exist', async () => {
    (getEventById as any).mockResolvedValue({
      id: 'evt-1',
      inviter_id: '00000000-0000-0000-0000-000000000001',
      status: 'options_ready',
    });
    (getActivityOptionById as any).mockResolvedValue(null);
    const app = buildApp();
    const res = await request(app)
      .post('/api/events/evt-1/select')
      .set('x-user-id', '00000000-0000-0000-0000-000000000001')
      .send({ activityOptionId: 'opt-999' });
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Activity option not found for this event.');
  });

  it('returns 404 when activity option belongs to a different event', async () => {
    (getEventById as any).mockResolvedValue({
      id: 'evt-1',
      inviter_id: '00000000-0000-0000-0000-000000000001',
      status: 'options_ready',
    });
    (getActivityOptionById as any).mockResolvedValue({
      id: 'opt-1',
      event_id: 'evt-other',
      title: 'Hiking',
      rank: 1,
      is_selected: false,
    });
    const app = buildApp();
    const res = await request(app)
      .post('/api/events/evt-1/select')
      .set('x-user-id', '00000000-0000-0000-0000-000000000001')
      .send({ activityOptionId: 'opt-1' });
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Activity option not found for this event.');
  });

  it('selects the option and finalizes the event on success', async () => {
    const mockEvent = {
      id: 'evt-1',
      inviter_id: '00000000-0000-0000-0000-000000000001',
      status: 'options_ready',
    };
    const mockOption = {
      id: 'opt-2',
      event_id: 'evt-1',
      title: 'Bowling',
      description: 'Bowling alley',
      suggested_date: '2025-08-02',
      rank: 2,
      is_selected: true,
    };
    const finalizedEvent = { ...mockEvent, status: 'finalized' };

    (getEventById as any).mockResolvedValue(mockEvent);
    (selectActivityOptionTx as any).mockResolvedValue(mockOption);
    
    mockClient.query.mockResolvedValueOnce({ rows: [] }); // BEGIN
    mockClient.query.mockResolvedValueOnce({ rows: [finalizedEvent] }); // UPDATE
    mockClient.query.mockResolvedValueOnce({ rows: [] }); // COMMIT

    const app = buildApp();
    const res = await request(app)
      .post('/api/events/evt-1/select')
      .set('x-user-id', '00000000-0000-0000-0000-000000000001')
      .send({ activityOptionId: 'opt-2' });

    expect(res.status).toBe(200);
    expect(res.body.event.status).toBe('finalized');
    expect(res.body.selectedOption.is_selected).toBe(true);
    expect(res.body.selectedOption.title).toBe('Bowling');
    expect(selectActivityOptionTx).toHaveBeenCalledWith(mockClient, 'evt-1', 'opt-2');
    expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
  });
});
