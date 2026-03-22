import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildEmailBody,
  buildEmailText,
  sendNotificationEmails,
  sendWithRetry,
  type EmailTransport,
} from './emailService';
import { ActivityOption } from '../models/ActivityOption';

vi.mock('../repositories/eventRepository', () => ({
  getEventById: vi.fn(),
}));
vi.mock('../repositories/activityOptionRepository', () => ({
  getActivityOptionsByEventId: vi.fn(),
}));
vi.mock('../repositories/responseRepository', () => ({
  getResponsesByEventId: vi.fn(),
}));
vi.mock('../repositories/userRepository', () => ({
  getUserById: vi.fn(),
}));
vi.mock('../repositories/emailLogRepository', () => ({
  createEmailLog: vi.fn(),
  updateEmailLogStatus: vi.fn(),
}));

import { getEventById } from '../repositories/eventRepository';
import { getActivityOptionsByEventId } from '../repositories/activityOptionRepository';
import { getResponsesByEventId } from '../repositories/responseRepository';
import { getUserById } from '../repositories/userRepository';
import { createEmailLog, updateEmailLogStatus } from '../repositories/emailLogRepository';

const mockPool = {} as any;

function makeActivity(overrides?: Partial<ActivityOption>): ActivityOption {
  return {
    id: 'opt-1',
    event_id: 'evt-1',
    title: 'Bowling Night',
    description: 'Bowling at the local alley',
    suggested_date: '2025-02-15',
    suggested_time: '19:00',
    rank: 1,
    is_selected: true,
    source_url: null,
    venue_name: null,
    price_range: null,
    weather_note: null,
    image_url: null,
    created_at: new Date(),
    ...overrides,
  };
}

function makeMockTransport(sendImpl?: EmailTransport['send']): EmailTransport & { send: ReturnType<typeof vi.fn> } {
  return {
    send: vi.fn(sendImpl ?? (() => Promise.resolve())),
  };
}

describe('buildEmailBody', () => {
  it('includes activity title, description, and date in HTML', () => {
    const activity = makeActivity();
    const body = buildEmailBody(activity);
    expect(body).toContain('Bowling Night');
    expect(body).toContain('Bowling at the local alley');
    expect(body).toContain('2025-02-15');
  });
});

describe('buildEmailText', () => {
  it('includes activity title, description, and date in plain text', () => {
    const activity = makeActivity();
    const body = buildEmailText(activity);
    expect(body).toContain('Bowling Night');
    expect(body).toContain('Bowling at the local alley');
    expect(body).toContain('2025-02-15');
  });
});

describe('sendNotificationEmails', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, EMAIL_FROM: 'Go Fish <hello@example.com>' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('sends emails to all respondents and the inviter', async () => {
    const mockTransport = makeMockTransport();

    vi.mocked(getEventById).mockResolvedValue({
      id: 'evt-1', inviter_id: 'user-inviter', title: 'Test', description: 'Desc',
      response_window_start: new Date(), response_window_end: new Date(),
      status: 'finalized', created_at: new Date(),
    });
    vi.mocked(getActivityOptionsByEventId).mockResolvedValue([makeActivity()]);
    vi.mocked(getResponsesByEventId).mockResolvedValue([
      { id: 'r1', event_id: 'evt-1', invitee_id: 'user-a', available_dates: ['2025-02-15'], created_at: new Date() },
      { id: 'r2', event_id: 'evt-1', invitee_id: 'user-b', available_dates: ['2025-02-15'], created_at: new Date() },
    ]);
    vi.mocked(getUserById).mockImplementation(async (_pool, id) => ({
      id, email: `${id}@test.com`, name: null, auth_provider: 'email' as const,
      has_taste_benchmark: true, created_at: new Date(),
    }));
    vi.mocked(createEmailLog).mockImplementation(async (_pool, data) => ({
      id: `log-${data.user_id}`, event_id: data.event_id, user_id: data.user_id,
      status: 'pending' as const, retry_count: 0, last_attempt: null, created_at: new Date(),
    }));
    vi.mocked(updateEmailLogStatus).mockResolvedValue(null);

    await sendNotificationEmails(mockPool, 'evt-1', mockTransport);

    expect(createEmailLog).toHaveBeenCalledTimes(3);
    expect(mockTransport.send).toHaveBeenCalledTimes(3);
    expect(updateEmailLogStatus).toHaveBeenCalledTimes(3);
    expect(mockTransport.send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Go Fish <hello@example.com>',
        to: 'user-a@test.com',
        subject: 'Go Fish: Bowling Night',
      })
    );
  });

  it('does nothing if event is not finalized', async () => {
    const mockTransport = makeMockTransport();
    vi.mocked(getEventById).mockResolvedValue({
      id: 'evt-1', inviter_id: 'user-inviter', title: 'Test', description: 'Desc',
      response_window_start: new Date(), response_window_end: new Date(),
      status: 'options_ready', created_at: new Date(),
    });

    await sendNotificationEmails(mockPool, 'evt-1', mockTransport);
    expect(createEmailLog).not.toHaveBeenCalled();
    expect(mockTransport.send).not.toHaveBeenCalled();
  });

  it('does nothing if no selected activity option exists', async () => {
    const mockTransport = makeMockTransport();
    vi.mocked(getEventById).mockResolvedValue({
      id: 'evt-1', inviter_id: 'user-inviter', title: 'Test', description: 'Desc',
      response_window_start: new Date(), response_window_end: new Date(),
      status: 'finalized', created_at: new Date(),
    });
    vi.mocked(getActivityOptionsByEventId).mockResolvedValue([makeActivity({ is_selected: false })]);

    await sendNotificationEmails(mockPool, 'evt-1', mockTransport);
    expect(createEmailLog).not.toHaveBeenCalled();
    expect(mockTransport.send).not.toHaveBeenCalled();
  });

  it('deduplicates when inviter is also a respondent', async () => {
    const mockTransport = makeMockTransport();
    vi.mocked(getEventById).mockResolvedValue({
      id: 'evt-1', inviter_id: 'user-a', title: 'Test', description: 'Desc',
      response_window_start: new Date(), response_window_end: new Date(),
      status: 'finalized', created_at: new Date(),
    });
    vi.mocked(getActivityOptionsByEventId).mockResolvedValue([makeActivity()]);
    vi.mocked(getResponsesByEventId).mockResolvedValue([
      { id: 'r1', event_id: 'evt-1', invitee_id: 'user-a', available_dates: ['2025-02-15'], created_at: new Date() },
    ]);
    vi.mocked(getUserById).mockImplementation(async (_pool, id) => ({
      id, email: `${id}@test.com`, name: null, auth_provider: 'email' as const,
      has_taste_benchmark: true, created_at: new Date(),
    }));
    vi.mocked(createEmailLog).mockImplementation(async (_pool, data) => ({
      id: `log-${data.user_id}`, event_id: data.event_id, user_id: data.user_id,
      status: 'pending' as const, retry_count: 0, last_attempt: null, created_at: new Date(),
    }));
    vi.mocked(updateEmailLogStatus).mockResolvedValue(null);

    await sendNotificationEmails(mockPool, 'evt-1', mockTransport);
    expect(createEmailLog).toHaveBeenCalledTimes(1);
    expect(mockTransport.send).toHaveBeenCalledTimes(1);
  });

  it('keeps processing other recipients when one email log insert fails', async () => {
    const mockTransport = makeMockTransport();

    vi.mocked(getEventById).mockResolvedValue({
      id: 'evt-1', inviter_id: 'user-inviter', title: 'Test', description: 'Desc',
      response_window_start: new Date(), response_window_end: new Date(),
      status: 'finalized', created_at: new Date(),
    });
    vi.mocked(getActivityOptionsByEventId).mockResolvedValue([makeActivity()]);
    vi.mocked(getResponsesByEventId).mockResolvedValue([
      { id: 'r1', event_id: 'evt-1', invitee_id: 'user-a', available_dates: ['2025-02-15'], created_at: new Date() },
      { id: 'r2', event_id: 'evt-1', invitee_id: 'user-b', available_dates: ['2025-02-15'], created_at: new Date() },
    ]);
    vi.mocked(getUserById).mockImplementation(async (_pool, id) => ({
      id, email: `${id}@test.com`, name: null, auth_provider: 'email' as const,
      has_taste_benchmark: true, created_at: new Date(),
    }));
    vi.mocked(createEmailLog).mockImplementation(async (_pool, data) => {
      if (data.user_id === 'user-b') {
        throw new Error('fk violation');
      }
      return {
        id: `log-${data.user_id}`, event_id: data.event_id, user_id: data.user_id,
        status: 'pending' as const, retry_count: 0, last_attempt: null, created_at: new Date(),
      };
    });
    vi.mocked(updateEmailLogStatus).mockResolvedValue(null);

    await sendNotificationEmails(mockPool, 'evt-1', mockTransport);

    expect(mockTransport.send).toHaveBeenCalledTimes(2);
    expect(mockTransport.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'user-a@test.com' })
    );
    expect(mockTransport.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'user-inviter@test.com' })
    );
  });
});

describe('sendWithRetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('marks the email as sent on success', async () => {
    const mockTransport = makeMockTransport();
    vi.mocked(updateEmailLogStatus).mockResolvedValue(null);

    await sendWithRetry(mockPool, mockTransport, 'log-1', 'a@b.com', 'from@test.com', 'Sub', '<p>Body</p>', 'Body');
    expect(updateEmailLogStatus).toHaveBeenCalledWith(mockPool, 'log-1', 'sent');
  });

  it('retries up to three times then marks the email as failed', async () => {
    const mockTransport = makeMockTransport(async () => {
      throw new Error('rate limited');
    });
    vi.mocked(updateEmailLogStatus).mockResolvedValue(null);

    const promise = sendWithRetry(mockPool, mockTransport, 'log-1', 'a@b.com', 'from@test.com', 'Sub', '<p>Body</p>', 'Body');
    await vi.advanceTimersByTimeAsync(5_000);
    await vi.advanceTimersByTimeAsync(5_000);
    await promise;

    expect(mockTransport.send).toHaveBeenCalledTimes(3);
    const lastCall = vi.mocked(updateEmailLogStatus).mock.calls.at(-1);
    expect(lastCall?.[2]).toBe('failed');
  });

  it('succeeds on the second attempt after an initial failure', async () => {
    const mockTransport = makeMockTransport(
      vi.fn()
        .mockRejectedValueOnce(new Error('rate limited'))
        .mockResolvedValueOnce(undefined)
    );
    vi.mocked(updateEmailLogStatus).mockResolvedValue(null);

    const promise = sendWithRetry(mockPool, mockTransport, 'log-1', 'a@b.com', 'from@test.com', 'Sub', '<p>Body</p>', 'Body');
    await vi.advanceTimersByTimeAsync(5_000);
    await promise;

    expect(mockTransport.send).toHaveBeenCalledTimes(2);
    const lastCall = vi.mocked(updateEmailLogStatus).mock.calls.at(-1);
    expect(lastCall?.[2]).toBe('sent');
  });
});
