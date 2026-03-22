import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createResponseRouter } from './responseRouter';

vi.mock('../repositories/eventRepository', () => ({
  getEventById: vi.fn(),
}));

vi.mock('../repositories/responseRepository', () => ({
  createResponse: vi.fn(),
  getResponsesByEventId: vi.fn(),
  getResponseByEventAndInvitee: vi.fn(),
}));

vi.mock('../repositories/userRepository', () => ({
  getUserById: vi.fn(),
}));

import { getEventById } from '../repositories/eventRepository';
import {
  createResponse,
  getResponsesByEventId,
  getResponseByEventAndInvitee,
} from '../repositories/responseRepository';
import { getUserById } from '../repositories/userRepository';

const mockPool = {} as any;
const sampleAvailability = [
  { date: '2025-01-15', start_time: '18:00', end_time: '21:00' },
];
const alternateAvailability = [
  { date: '2025-01-20', start_time: '19:00', end_time: '22:00' },
];
const multiDayAvailability = [
  { date: '2025-01-15', start_time: '18:00', end_time: '21:00' },
  { date: '2025-01-16', start_time: '17:30', end_time: '20:30' },
];

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/events/:eventId/responses', createResponseRouter(mockPool));
  return app;
}

function openEvent(overrides: Record<string, unknown> = {}) {
  const now = Date.now();
  return {
    id: 'evt-1',
    inviter_id: 'inviter-1',
    title: 'Game Night',
    description: 'Board games',
    response_window_start: new Date(now - 1000),
    response_window_end: new Date(now + 24 * 60 * 60 * 1000),
    status: 'collecting',
    created_at: new Date(now),
    ...overrides,
  };
}

function closedEvent() {
  const past = Date.now() - 48 * 60 * 60 * 1000;
  return openEvent({
    response_window_start: new Date(past),
    response_window_end: new Date(past + 24 * 60 * 60 * 1000),
  });
}

describe('POST /api/events/:eventId/responses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: user has completed taste benchmark
    (getUserById as any).mockResolvedValue({ id: 'user-1', has_taste_benchmark: true });
  });

  it('returns 401 when no x-user-id header is provided', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/events/evt-1/responses')
      .send({ available_dates: sampleAvailability });
    expect(res.status).toBe(401);
  });

  it('returns 403 when user has not completed taste benchmark', async () => {
    (getUserById as any).mockResolvedValue({ id: 'user-1', has_taste_benchmark: false });
    const app = buildApp();
    const res = await request(app)
      .post('/api/events/evt-1/responses')
      .set('x-user-id', 'user-1')
      .send({ available_dates: sampleAvailability });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('benchmark_required');
  });

  it('returns 400 when available_dates is missing', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/events/evt-1/responses')
      .set('x-user-id', 'user-1')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_dates');
  });

  it('returns 400 when available_dates is an empty array', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/events/evt-1/responses')
      .set('x-user-id', 'user-1')
      .send({ available_dates: [] });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_dates');
  });

  it('returns 404 when event does not exist', async () => {
    (getEventById as any).mockResolvedValue(null);
    const app = buildApp();
    const res = await request(app)
      .post('/api/events/nonexistent/responses')
      .set('x-user-id', 'user-1')
      .send({ available_dates: sampleAvailability });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });

  it('returns 403 when response window is closed', async () => {
    (getEventById as any).mockResolvedValue(closedEvent());
    const app = buildApp();
    const res = await request(app)
      .post('/api/events/evt-1/responses')
      .set('x-user-id', 'user-1')
      .send({ available_dates: sampleAvailability });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('window_closed');
  });

  it('returns 409 when invitee has already responded', async () => {
    (getEventById as any).mockResolvedValue(openEvent());
    (getResponseByEventAndInvitee as any).mockResolvedValue({
      id: 'resp-1',
      event_id: 'evt-1',
      invitee_id: 'user-1',
      available_dates: sampleAvailability,
    });
    const app = buildApp();
    const res = await request(app)
      .post('/api/events/evt-1/responses')
      .set('x-user-id', 'user-1')
      .send({ available_dates: alternateAvailability });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('duplicate_response');
  });

  it('creates response and returns 201 on valid submission', async () => {
    const event = openEvent();
    (getEventById as any).mockResolvedValue(event);
    (getResponseByEventAndInvitee as any).mockResolvedValue(null);
    const mockResponse = {
      id: 'resp-1',
      event_id: 'evt-1',
      invitee_id: 'user-1',
      available_dates: multiDayAvailability,
      created_at: new Date(),
    };
    (createResponse as any).mockResolvedValue(mockResponse);

    const app = buildApp();
    const res = await request(app)
      .post('/api/events/evt-1/responses')
      .set('x-user-id', 'user-1')
      .send({ available_dates: multiDayAvailability });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('resp-1');
    expect(res.body.available_dates).toEqual(multiDayAvailability);
    expect(createResponse).toHaveBeenCalledWith(mockPool, {
      event_id: 'evt-1',
      invitee_id: 'user-1',
      available_dates: multiDayAvailability,
    });
  });
});

describe('GET /api/events/:eventId/responses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when no x-user-id header is provided', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/events/evt-1/responses');
    expect(res.status).toBe(401);
  });

  it('returns 404 when event does not exist', async () => {
    (getEventById as any).mockResolvedValue(null);
    const app = buildApp();
    const res = await request(app)
      .get('/api/events/evt-1/responses')
      .set('x-user-id', 'user-1');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });

  it('returns 403 when user is not the inviter', async () => {
    (getEventById as any).mockResolvedValue(openEvent({ inviter_id: 'other-user' }));
    const app = buildApp();
    const res = await request(app)
      .get('/api/events/evt-1/responses')
      .set('x-user-id', 'user-1');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('forbidden');
  });

  it('returns responses when user is the inviter', async () => {
    (getEventById as any).mockResolvedValue(openEvent({ inviter_id: 'user-1' }));
    const mockResponses = [
      { id: 'r1', event_id: 'evt-1', invitee_id: 'inv-1', available_dates: sampleAvailability },
      { id: 'r2', event_id: 'evt-1', invitee_id: 'inv-2', available_dates: alternateAvailability },
    ];
    (getResponsesByEventId as any).mockResolvedValue(mockResponses);

    const app = buildApp();
    const res = await request(app)
      .get('/api/events/evt-1/responses')
      .set('x-user-id', 'user-1');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].id).toBe('r1');
    expect(res.body[1].id).toBe('r2');
    expect(getResponsesByEventId).toHaveBeenCalledWith(mockPool, 'evt-1');
  });
});
