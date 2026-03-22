import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  scheduleResponseWindow,
  handleWindowExpiry,
  triggerEarly,
  triggerGeneration,
  cancelScheduledTimer,
  getActiveTimerCount,
  clearAllTimers,
} from './responseWindowScheduler';
import { Event } from '../models/Event';

// Mock dependencies
vi.mock('../repositories/responseRepository', () => ({
  getResponsesByEventId: vi.fn(),
}));
vi.mock('../repositories/tasteBenchmarkRepository', () => ({
  getTasteBenchmarkByUserId: vi.fn(),
}));
vi.mock('../repositories/activityOptionRepository', () => ({
  createActivityOption: vi.fn(),
}));
vi.mock('../repositories/eventRepository', () => ({
  getEventById: vi.fn(),
  updateEventStatus: vi.fn(),
}));
vi.mock('./decisionAgent', () => ({
  generateActivityOptions: vi.fn(),
}));
vi.mock('./realWorldData', () => ({
  fetchRealWorldContext: vi.fn(),
}));

import { getResponsesByEventId } from '../repositories/responseRepository';
import { getTasteBenchmarkByUserId } from '../repositories/tasteBenchmarkRepository';
import { createActivityOption } from '../repositories/activityOptionRepository';
import { getEventById, updateEventStatus } from '../repositories/eventRepository';
import { generateActivityOptions } from './decisionAgent';

const mockPool = {} as any;
const deps = { pool: mockPool, apiKey: 'test-key' };

function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: 'event-1',
    inviter_id: 'inviter-1',
    title: 'Test Event',
    description: 'A test event',
    response_window_start: new Date('2025-01-01T00:00:00Z'),
    response_window_end: new Date('2025-01-02T00:00:00Z'),
    status: 'collecting',
    created_at: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

const mockResponses = [
  { id: 'r1', event_id: 'event-1', invitee_id: 'user-1', available_dates: ['2025-01-15'], created_at: new Date() },
  { id: 'r2', event_id: 'event-1', invitee_id: 'user-2', available_dates: ['2025-01-15', '2025-01-16'], created_at: new Date() },
];

const mockBenchmarks = [
  { id: 'b1', user_id: 'user-1', answers: { q1: ['outdoor'] }, created_at: new Date() },
  { id: 'b2', user_id: 'user-2', answers: { q1: ['indoor'] }, created_at: new Date() },
];

const mockGeneratedOptions = [
  { title: 'Hiking', description: 'Mountain hike', suggested_date: '2025-01-15', rank: 1 },
  { title: 'Bowling', description: 'Bowling night', suggested_date: '2025-01-15', rank: 2 },
  { title: 'Movie', description: 'Movie night', suggested_date: '2025-01-16', rank: 3 },
];

describe('responseWindowScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    clearAllTimers();
  });

  afterEach(() => {
    clearAllTimers();
    vi.useRealTimers();
  });

  describe('scheduleResponseWindow', () => {
    it('should schedule a timer that fires at response_window_end', async () => {
      const event = makeEvent({
        response_window_end: new Date(Date.now() + 5000),
      });

      (getEventById as any).mockResolvedValue(event);
      (getResponsesByEventId as any).mockResolvedValue(mockResponses);
      (getTasteBenchmarkByUserId as any).mockResolvedValue(mockBenchmarks[0]);
      (generateActivityOptions as any).mockResolvedValue(mockGeneratedOptions);
      (updateEventStatus as any).mockResolvedValue(event);
      (createActivityOption as any).mockResolvedValue({});

      scheduleResponseWindow(event, deps);
      expect(getActiveTimerCount()).toBe(1);

      // Timer hasn't fired yet
      expect(getEventById).not.toHaveBeenCalled();

      // Advance past the window
      await vi.advanceTimersByTimeAsync(5001);

      expect(getEventById).toHaveBeenCalledWith(mockPool, event.id);
    });

    it('should fire immediately if window already expired', async () => {
      const event = makeEvent({
        response_window_end: new Date(Date.now() - 1000),
      });

      (getEventById as any).mockResolvedValue(event);
      (getResponsesByEventId as any).mockResolvedValue(mockResponses);
      (getTasteBenchmarkByUserId as any).mockResolvedValue(mockBenchmarks[0]);
      (generateActivityOptions as any).mockResolvedValue(mockGeneratedOptions);
      (updateEventStatus as any).mockResolvedValue(event);
      (createActivityOption as any).mockResolvedValue({});

      scheduleResponseWindow(event, deps);

      await vi.advanceTimersByTimeAsync(1);

      expect(getEventById).toHaveBeenCalledWith(mockPool, event.id);
    });
  });

  describe('cancelScheduledTimer', () => {
    it('should cancel an active timer', () => {
      const event = makeEvent({
        response_window_end: new Date(Date.now() + 60000),
      });

      scheduleResponseWindow(event, deps);
      expect(getActiveTimerCount()).toBe(1);

      const cancelled = cancelScheduledTimer(event.id);
      expect(cancelled).toBe(true);
      expect(getActiveTimerCount()).toBe(0);
    });

    it('should return false for non-existent timer', () => {
      expect(cancelScheduledTimer('nonexistent')).toBe(false);
    });
  });

  describe('handleWindowExpiry', () => {
    it('should trigger generation when >= 1 responses exist', async () => {
      const event = makeEvent();
      (getEventById as any).mockResolvedValue(event);
      (getResponsesByEventId as any).mockResolvedValue(mockResponses);
      (getTasteBenchmarkByUserId as any)
        .mockResolvedValueOnce(mockBenchmarks[0])
        .mockResolvedValueOnce(mockBenchmarks[1]);
      (generateActivityOptions as any).mockResolvedValue(mockGeneratedOptions);
      (updateEventStatus as any).mockResolvedValue(event);
      (createActivityOption as any).mockResolvedValue({});

      await handleWindowExpiry('event-1', deps);

      expect(updateEventStatus).toHaveBeenCalledWith(mockPool, 'event-1', 'generating');
      expect(generateActivityOptions).toHaveBeenCalled();
      expect(createActivityOption).toHaveBeenCalledTimes(3);
      expect(updateEventStatus).toHaveBeenCalledWith(mockPool, 'event-1', 'options_ready');
    });

    it('should trigger generation even when 0 responses exist', async () => {
      const event = makeEvent();
      (getEventById as any).mockResolvedValue(event);
      (getResponsesByEventId as any).mockResolvedValue([]);
      (generateActivityOptions as any).mockResolvedValue(mockGeneratedOptions);
      (updateEventStatus as any).mockResolvedValue(event);
      (createActivityOption as any).mockResolvedValue({});

      await handleWindowExpiry('event-1', deps);

      expect(updateEventStatus).toHaveBeenCalledWith(mockPool, 'event-1', 'generating');
      expect(generateActivityOptions).toHaveBeenCalledWith(
        [],
        [],
        'test-key',
        { title: 'Test Event', description: 'A test event' },
        undefined
      );
      expect(createActivityOption).toHaveBeenCalledTimes(3);
      expect(updateEventStatus).toHaveBeenCalledWith(mockPool, 'event-1', 'options_ready');
    });

    it('should skip if event is not in collecting status', async () => {
      (getEventById as any).mockResolvedValue(makeEvent({ status: 'options_ready' }));

      await handleWindowExpiry('event-1', deps);

      expect(getResponsesByEventId).not.toHaveBeenCalled();
      expect(updateEventStatus).not.toHaveBeenCalled();
    });

    it('should skip if event does not exist', async () => {
      (getEventById as any).mockResolvedValue(null);

      await handleWindowExpiry('event-1', deps);

      expect(getResponsesByEventId).not.toHaveBeenCalled();
    });
  });

  describe('triggerEarly', () => {
    it('should cancel timer and trigger generation', async () => {
      const event = makeEvent({
        response_window_end: new Date(Date.now() + 60000),
      });

      scheduleResponseWindow(event, deps);
      expect(getActiveTimerCount()).toBe(1);

      (getEventById as any).mockResolvedValue(event);
      (getResponsesByEventId as any).mockResolvedValue(mockResponses);
      (getTasteBenchmarkByUserId as any)
        .mockResolvedValueOnce(mockBenchmarks[0])
        .mockResolvedValueOnce(mockBenchmarks[1]);
      (generateActivityOptions as any).mockResolvedValue(mockGeneratedOptions);
      (updateEventStatus as any).mockResolvedValue(event);
      (createActivityOption as any).mockResolvedValue({});

      await triggerEarly(event.id, deps);

      expect(getActiveTimerCount()).toBe(0);
      expect(updateEventStatus).toHaveBeenCalledWith(mockPool, event.id, 'generating');
      expect(generateActivityOptions).toHaveBeenCalled();
      expect(updateEventStatus).toHaveBeenCalledWith(mockPool, event.id, 'options_ready');
    });
  });

  describe('triggerGeneration', () => {
    it('should collect benchmarks and per-participant dates, pass event context', async () => {
      const event = makeEvent();
      (getEventById as any).mockResolvedValue(event);
      (getResponsesByEventId as any).mockResolvedValue(mockResponses);
      (getTasteBenchmarkByUserId as any)
        .mockResolvedValueOnce(mockBenchmarks[0])
        .mockResolvedValueOnce(mockBenchmarks[1]);
      (generateActivityOptions as any).mockResolvedValue(mockGeneratedOptions);
      (updateEventStatus as any).mockResolvedValue(event);
      (createActivityOption as any).mockResolvedValue({});

      const result = await triggerGeneration('event-1', deps);

      expect(updateEventStatus).toHaveBeenCalledWith(mockPool, 'event-1', 'generating');
      expect(getTasteBenchmarkByUserId).toHaveBeenCalledWith(mockPool, 'user-1');
      expect(getTasteBenchmarkByUserId).toHaveBeenCalledWith(mockPool, 'user-2');
      // Now passes per-participant availability, event context, and optional realWorldContext
      expect(generateActivityOptions).toHaveBeenCalledWith(
        [mockBenchmarks[0], mockBenchmarks[1]],
        expect.any(Array),
        'test-key',
        { title: 'Test Event', description: 'A test event' },
        undefined
      );
      expect(createActivityOption).toHaveBeenCalledTimes(3);
      expect(updateEventStatus).toHaveBeenCalledWith(mockPool, 'event-1', 'options_ready');
      expect(result).toEqual(mockGeneratedOptions);
    });

    it('should skip benchmarks for users without one', async () => {
      const event = makeEvent();
      (getEventById as any).mockResolvedValue(event);
      (getResponsesByEventId as any).mockResolvedValue(mockResponses);
      (getTasteBenchmarkByUserId as any)
        .mockResolvedValueOnce(mockBenchmarks[0])
        .mockResolvedValueOnce(null);
      (generateActivityOptions as any).mockResolvedValue(mockGeneratedOptions);
      (updateEventStatus as any).mockResolvedValue(event);
      (createActivityOption as any).mockResolvedValue({});

      await triggerGeneration('event-1', deps);

      expect(generateActivityOptions).toHaveBeenCalledWith(
        [mockBenchmarks[0]],
        expect.any(Array),
        'test-key',
        { title: 'Test Event', description: 'A test event' },
        undefined
      );
    });

    it('should generate options with empty benchmarks and availability when nobody responded', async () => {
      const event = makeEvent();
      (getEventById as any).mockResolvedValue(event);
      (getResponsesByEventId as any).mockResolvedValue([]);
      (generateActivityOptions as any).mockResolvedValue(mockGeneratedOptions);
      (updateEventStatus as any).mockResolvedValue(event);
      (createActivityOption as any).mockResolvedValue({});

      const result = await triggerGeneration('event-1', deps);

      expect(generateActivityOptions).toHaveBeenCalledWith(
        [],
        [],
        'test-key',
        { title: 'Test Event', description: 'A test event' },
        undefined
      );
      expect(result).toEqual(mockGeneratedOptions);
    });

    it('should revert to collecting status on generation failure', async () => {
      const event = makeEvent();
      (getEventById as any).mockResolvedValue(event);
      (getResponsesByEventId as any).mockResolvedValue(mockResponses);
      (getTasteBenchmarkByUserId as any).mockResolvedValue(mockBenchmarks[0]);
      (generateActivityOptions as any).mockRejectedValue(new Error('Gemini API failed'));
      (updateEventStatus as any).mockResolvedValue(event);

      await expect(triggerGeneration('event-1', deps)).rejects.toThrow('Gemini API failed');

      expect(updateEventStatus).toHaveBeenCalledWith(mockPool, 'event-1', 'generating');
      expect(updateEventStatus).toHaveBeenCalledWith(mockPool, 'event-1', 'collecting');
    });
  });
});
