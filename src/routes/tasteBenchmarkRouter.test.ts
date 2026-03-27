import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createTasteBenchmarkRouter } from './tasteBenchmarkRouter';

// Mock repositories
vi.mock('../repositories/tasteBenchmarkRepository', () => ({
  createTasteBenchmark: vi.fn(),
  getTasteBenchmarkByUserId: vi.fn(),
}));

vi.mock('../lib/supabaseAdmin', () => ({
  getSupabaseAdmin: vi.fn().mockReturnValue(null),
}));
vi.mock('../repositories/userRepository', () => ({
  updateUser: vi.fn(),
}));

import { createTasteBenchmark, getTasteBenchmarkByUserId } from '../repositories/tasteBenchmarkRepository';
import { updateUser } from '../repositories/userRepository';

const mockClient = {
  query: vi.fn(),
  release: vi.fn(),
};

const mockPool = {
  connect: vi.fn().mockResolvedValue(mockClient),
  query: vi.fn(),
} as any;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/taste-benchmark', createTasteBenchmarkRouter(mockPool));
  return app;
}

function makeFullAnswers(): Record<string, string[]> {
  const answers: Record<string, string[]> = {};
  for (let i = 1; i <= 10; i++) {
    answers[`q${i}`] = ['optionA'];
  }
  return answers;
}

describe('POST /api/taste-benchmark', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when no x-user-id header is provided', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/taste-benchmark').send({ answers: {} });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('unauthorized');
  });

  it('returns 400 with all 10 missing questions when answers is missing', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/taste-benchmark')
      .set('x-user-id', '00000000-0000-0000-0000-000000000001')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('incomplete_benchmark');
    expect(res.body.missingQuestions).toHaveLength(10);
  });

  it('returns 400 with specific missing questions when submission is incomplete', async () => {
    const app = buildApp();
    const answers = makeFullAnswers();
    delete answers.q3;
    delete answers.q7;

    const res = await request(app)
      .post('/api/taste-benchmark')
      .set('x-user-id', '00000000-0000-0000-0000-000000000001')
      .send({ answers });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('incomplete_benchmark');
    expect(res.body.missingQuestions).toEqual(expect.arrayContaining(['q3', 'q7']));
    expect(res.body.missingQuestions).toHaveLength(2);
  });

  it('returns 400 when a question has an empty array', async () => {
    const app = buildApp();
    const answers = makeFullAnswers();
    answers.q5 = [];

    const res = await request(app)
      .post('/api/taste-benchmark')
      .set('x-user-id', '00000000-0000-0000-0000-000000000001')
      .send({ answers });

    expect(res.status).toBe(400);
    expect(res.body.missingQuestions).toEqual(['q5']);
  });

  it('returns 201 and stores benchmark when all 10 questions are answered', async () => {
    const answers = makeFullAnswers();
    const mockBenchmark = { id: 'bm-1', user_id: '00000000-0000-0000-0000-000000000001', answers, created_at: new Date() };
    
    mockClient.query.mockResolvedValueOnce({ rows: [] }); // BEGIN
    mockClient.query.mockResolvedValueOnce({ rows: [mockBenchmark] }); // INSERT
    mockClient.query.mockResolvedValueOnce({ rows: [] }); // UPDATE
    mockClient.query.mockResolvedValueOnce({ rows: [] }); // COMMIT

    const app = buildApp();
    const res = await request(app)
      .post('/api/taste-benchmark')
      .set('x-user-id', '00000000-0000-0000-0000-000000000001')
      .send({ answers });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('bm-1');
    expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    expect(mockClient.release).toHaveBeenCalled();
  });
});

describe('GET /api/taste-benchmark', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when no x-user-id header is provided', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/taste-benchmark');
    expect(res.status).toBe(401);
  });

  it('returns 404 when user has no benchmark', async () => {
    (getTasteBenchmarkByUserId as any).mockResolvedValue(null);
    const app = buildApp();
    const res = await request(app)
      .get('/api/taste-benchmark')
      .set('x-user-id', '00000000-0000-0000-0000-000000000001');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });

  it('returns the benchmark when it exists', async () => {
    const mockBenchmark = { id: 'bm-1', user_id: '00000000-0000-0000-0000-000000000001', answers: { q1: ['a'] }, created_at: new Date() };
    (getTasteBenchmarkByUserId as any).mockResolvedValue(mockBenchmark);

    const app = buildApp();
    const res = await request(app)
      .get('/api/taste-benchmark')
      .set('x-user-id', '00000000-0000-0000-0000-000000000001');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('bm-1');
    expect(getTasteBenchmarkByUserId).toHaveBeenCalledWith(mockPool, '00000000-0000-0000-0000-000000000001');
  });
});
