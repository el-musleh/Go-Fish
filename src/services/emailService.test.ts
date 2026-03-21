import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildEmailBody,
  buildEmailText,
  sendNotificationEmails,
  sendWithRetry,
} from './emailService';
import { ActivityOption } from '../models/ActivityOption';

// Mock all repository modules
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
    rank: 1,
    is_selected: true,
    created_at: new Date(),
    ...overrides,
  };
}

function makeMockResend(sendResult: { data?: any; error?: any }) {
  return { emails: { send: vi.fn().mockResolvedValue(sendResult) } } as any;
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
  beforeEach(() => { vi.clearAllMocks(); });

  it('sends emails to all respondents and the inviter', async () => {
    const mockResend = makeMockResend({ data: { id: 'msg-1' } });

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

    await sendNotificationEmails(mockPool, 'evt-1', mockResend);

    expect(createEmailLog).toHaveBeenCalledTimes(3);
    expect(mockResend.emails.send).toHaveBeenCalledTimes(3);
    expect(updateEmailLogStatus).toHaveBeenCalledTimes(3);
    for (const call of vi.mocked(updateEmailLogStatus).mock.calls) {
      expect(call[2]).toBe('sent');
    }
  });

  it('does nothing if event is not finalized', async () => {
    const mockResend = makeMockResend({ data: { id: 'msg-1' } });
    vi.mocked(getEventById).mockResolvedValue({
      id: 'evt-1', inviter_id: 'user-inviter', title: 'Test', description: 'Desc',
      response_window_start: new Date(), response_window_end: new Date(),
      status: 'options_ready', created_at: new Date(),
    });

    await sendNotificationEmails(mockPool, 'evt-1', mockResend);
    expect(createEmailLog).not.toHaveBeenCalled();
  });

  it('does nothing if no selected activity option', async () => {
    const mockResend = makeMockResend({ data: { id: 'msg-1' } });
    vi.mocked(getEventById).mockResolvedValue({
      id: 'evt-1', inviter_id: 'user-inviter', title: 'Test', description: 'Desc',
      response_window_start: new Date(), response_window_end: new Date(),
      status: 'finalized', created_at: new Date(),
    });
    vi.mocked(getActivityOptionsByEventId).mockResolvedValue([makeActivity({ is_selected: false })]);

    await sendNotificationEmails(mockPool, 'evt-1', mockResend);
    expect(createEmailLog).not.toHaveBeenCalled();
  });

  it('deduplicates when inviter is also a respondent', async () => {
    const mockResend = makeMockResend({ data: { id: 'msg-1' } });
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

    await sendNotificationEmails(mockPool, 'evt-1', mockResend);
    expect(createEmailLog).toHaveBeenCalledTimes(1);
    expect(mockResend.emails.send).toHaveBeenCalledTimes(1);
  });
});

describe('sendWithRetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it('marks as sent on success', async () => {
    const mockResend = makeMockResend({ data: { id: 'msg-1' } });
    vi.mocked(updateEmailLogStatus).mockResolvedValue(null);

    await sendWithRetry(mockPool, mockResend, 'log-1', 'a@b.com', 'test@test.com', 'Sub', '<p>Body</p>', 'Body');
    expect(updateEmailLogStatus).toHaveBeenCalledWith(mockPool, 'log-1', 'sent');
  });

  it('retries up to 3 times then marks as failed', async () => {
    const mockResend = makeMockResend({ error: { message: 'rate limited' } });
    vi.mocked(updateEmailLogStatus).mockResolvedValue(null);

    const promise = sendWithRetry(mockPool, mockResend, 'log-1', 'a@b.com', 'test@test.com', 'Sub', '<p>Body</p>', 'Body');
    await vi.advanceTimersByTimeAsync(5_000);
    await vi.advanceTimersByTimeAsync(5_000);
    await promise;

    expect(mockResend.emails.send).toHaveBeenCalledTimes(3);
    const lastCall = vi.mocked(updateEmailLogStatus).mock.calls.at(-1);
    expect(lastCall?.[2]).toBe('failed');
  });

  it('succeeds on second attempt after first failure', async () => {
    const mockResend = {
      emails: {
        send: vi.fn()
          .mockResolvedValueOnce({ error: { message: 'rate limited' } })
          .mockResolvedValueOnce({ data: { id: 'msg-1' } }),
      },
    } as any;
    vi.mocked(updateEmailLogStatus).mockResolvedValue(null);

    const promise = sendWithRetry(mockPool, mockResend, 'log-1', 'a@b.com', 'test@test.com', 'Sub', '<p>Body</p>', 'Body');
    await vi.advanceTimersByTimeAsync(5_000);
    await promise;

    expect(mockResend.emails.send).toHaveBeenCalledTimes(2);
    const lastCall = vi.mocked(updateEmailLogStatus).mock.calls.at(-1);
    expect(lastCall?.[2]).toBe('sent');
  });
});
