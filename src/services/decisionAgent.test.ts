import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TasteBenchmark } from '../models/TasteBenchmark';
import { RealWorldContext } from './realWorldData/types';

const {
  mockAgentInvoke,
  mockFinalizerInvoke,
  MockChatOpenRouter,
} = vi.hoisted(() => {
  const mockAgentInvoke = vi.fn();
  const mockFinalizerInvoke = vi.fn();
  const MockChatOpenRouter = vi.fn().mockImplementation(() => ({
    invoke: mockFinalizerInvoke,
    withStructuredOutput: vi.fn(() => ({
      invoke: mockFinalizerInvoke,
    })),
  }));

  return {
    mockAgentInvoke,
    mockFinalizerInvoke,
    MockChatOpenRouter,
  };
});

vi.mock('@langchain/langgraph/prebuilt', () => ({
  createReactAgent: vi.fn(() => ({
    invoke: async () => {
      const result = await mockAgentInvoke();
      return result;
    },
  })),
}));

vi.mock('langchain', () => ({
  tool: (handler: unknown, config: Record<string, unknown>) => ({
    handler,
    ...config,
  }),
}));

vi.mock('@langchain/openrouter', () => ({
  ChatOpenRouter: MockChatOpenRouter,
}));

const sampleBenchmarks: TasteBenchmark[] = [
  {
    id: 'benchmark-1',
    user_id: 'user-1',
    answers: { q1: ['Hiking', 'Live music'], q2: ['Board games'] },
    created_at: new Date(),
  },
  {
    id: 'benchmark-2',
    user_id: 'user-2',
    answers: { q1: ['Hiking', 'Museums'], q2: ['Cocktails'] },
    created_at: new Date(),
  },
];

const sampleAvailability = [
  {
    participant_index: 1,
    windows: [
      { date: '2025-08-02', start_time: '18:00', end_time: '22:00' },
      { date: '2025-08-03', start_time: '15:00', end_time: '20:00' },
    ],
  },
  {
    participant_index: 2,
    windows: [
      { date: '2025-08-02', start_time: '19:00', end_time: '23:00' },
      { date: '2025-08-03', start_time: '16:00', end_time: '19:00' },
    ],
  },
];

const sampleRealWorldContext: RealWorldContext = {
  events: [
    {
      source: 'ticketmaster',
      sourceId: 'event-1',
      title: 'Rooftop Jazz Night',
      description: 'Live music and city views',
      category: 'music',
      date: '2025-08-02',
      startTime: '19:00',
      endTime: null,
      venueName: 'Skyline Club',
      venueAddress: 'Berlin',
      priceRange: 'EUR 25-45',
      url: 'https://events.test/event-1',
      imageUrl: 'https://images.test/event-1.jpg',
    },
  ],
  venues: [
    {
      source: 'google_places',
      sourceId: 'venue-1',
      name: 'Canal Bar',
      category: 'bar',
      address: 'Berlin',
      rating: 4.7,
      priceLevel: 2,
      url: 'https://venues.test/venue-1',
      photoUrl: 'https://images.test/venue-1.jpg',
    },
  ],
  weather: [
    {
      date: '2025-08-02',
      tempHighC: 24,
      tempLowC: 16,
      description: 'clear sky',
      precipProbability: 10,
      windSpeedKmh: 11,
      isOutdoorFriendly: true,
    },
  ],
  location: {
    latitude: 52.52,
    longitude: 13.405,
    city: 'Berlin',
    country: 'DE',
  },
  fetchedAt: new Date(),
};

describe('decisionAgent helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds exact overlap slots from participant windows', async () => {
    const { buildOverlapSlots } = await import('./decisionAgent');
    const overlaps = buildOverlapSlots(sampleAvailability);

    expect(overlaps).toHaveLength(2);
    expect(overlaps[0]).toEqual({
      date: '2025-08-02',
      participant_count: 2,
      participant_indices: [1, 2],
      windows: [{ start_time: '19:00', end_time: '22:00' }],
      priority: 1,
    });
    expect(overlaps[1].windows).toEqual([{ start_time: '16:00', end_time: '19:00' }]);
  });

  it('builds fallback overlap slots when nobody responded yet', async () => {
    const { buildRuntimeState } = await import('./decisionAgent');

    const runtime = buildRuntimeState(
      [],
      [],
      { title: 'Draft event', description: 'No responses yet' },
      sampleRealWorldContext
    );

    expect(runtime.overlaps).toEqual([
      {
        date: '2025-08-02',
        participant_count: 0,
        participant_indices: [],
        windows: [{ start_time: '10:00', end_time: '22:00' }],
        priority: 1,
      },
    ]);
  });

  it('finds shared preferences across the group', async () => {
    const { findCommonPreferences } = await import('./decisionAgent');
    const preferences = findCommonPreferences(sampleBenchmarks);

    expect(preferences['Outdoor activities']).toContain('Hiking');
    expect(preferences['Outdoor activities']).not.toContain('Live music');
  });

  it('validates and hydrates structured options from source IDs', async () => {
    const { buildRuntimeState, validateAndHydrateOptions } = await import('./decisionAgent');

    const runtime = buildRuntimeState(
      sampleBenchmarks,
      sampleAvailability,
      { title: 'Birthday', description: 'Night out' },
      sampleRealWorldContext
    );

    const hydrated = validateAndHydrateOptions(
      {
        options: [
          {
            title: 'Rooftop Jazz Night',
            description: 'Live music with skyline views',
            suggested_date: '2025-08-02',
            suggested_time: '19:00',
            rank: 1,
            source_kind: 'event',
            source_id: 'event-1',
            weather_note: null,
          },
          {
            title: 'Cocktails at Canal Bar',
            description: 'A relaxed bar night by the water',
            suggested_date: '2025-08-03',
            suggested_time: '16:30',
            rank: 2,
            source_kind: 'venue',
            source_id: 'venue-1',
            weather_note: 'Clear weather for an early evening walk',
          },
          {
            title: 'Board games at home',
            description: 'A custom fallback plan for everyone',
            suggested_date: '2025-08-03',
            suggested_time: '17:00',
            rank: 3,
            source_kind: 'custom',
            source_id: null,
            weather_note: null,
          },
        ],
      },
      runtime
    );

    expect(hydrated[0].source_url).toBe('https://events.test/event-1');
    expect(hydrated[0].image_url).toBe('https://images.test/event-1.jpg');
    expect(hydrated[1].venue_name).toBe('Canal Bar');
    expect(hydrated[1].image_url).toBe('https://images.test/venue-1.jpg');
    expect(hydrated[2].source_url).toBeNull();
  });

  it('rejects structured options that pick impossible times', async () => {
    const { buildRuntimeState, validateAndHydrateOptions } = await import('./decisionAgent');

    const runtime = buildRuntimeState(sampleBenchmarks, sampleAvailability);

    expect(() =>
      validateAndHydrateOptions(
        {
          options: [
            {
              title: 'A',
              description: 'B',
              suggested_date: '2025-08-02',
              suggested_time: '23:30',
              rank: 1,
              source_kind: 'custom',
              source_id: null,
              weather_note: null,
            },
            {
              title: 'C',
              description: 'D',
              suggested_date: '2025-08-03',
              suggested_time: '16:30',
              rank: 2,
              source_kind: 'custom',
              source_id: null,
              weather_note: null,
            },
            {
              title: 'E',
              description: 'F',
              suggested_date: '2025-08-03',
              suggested_time: '17:30',
              rank: 3,
              source_kind: 'custom',
              source_id: null,
              weather_note: null,
            },
          ],
        },
        runtime
      )
    ).toThrow('outside the valid overlap');
  });
});

describe.skip('generateActivityOptions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_MODEL;
    delete process.env.GOOGLE_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_MODEL;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses the planning agent and structured finalizer to return hydrated options', async () => {
    mockAgentInvoke.mockResolvedValue({
      messages: [
        { getType: () => 'human', content: 'ignored' },
        {
          getType: () => 'ai',
          content: '1. event:event-1 on 2025-08-02 at 19:00\n2. venue:venue-1 on 2025-08-03 at 16:30\n3. custom on 2025-08-03 at 17:00',
        },
      ],
    });

    mockFinalizerInvoke.mockResolvedValue({
      content: JSON.stringify({
        options: [
          {
            title: 'Rooftop Jazz Night',
            description: 'Live music and drinks',
            suggested_date: '2025-08-02',
            suggested_time: '19:00',
            rank: 1,
            source_kind: 'event',
            source_id: 'event-1',
            weather_note: null,
          },
          {
            title: 'Cocktails at Canal Bar',
            description: 'A bar pick for the group',
            suggested_date: '2025-08-03',
            suggested_time: '16:30',
            rank: 2,
            source_kind: 'venue',
            source_id: 'venue-1',
            weather_note: null,
          },
          {
            title: 'Apartment board games',
            description: 'A custom social fallback',
            suggested_date: '2025-08-03',
            suggested_time: '17:00',
            rank: 3,
            source_kind: 'custom',
            source_id: null,
            weather_note: null,
          },
        ],
      }),
    });

    const { generateActivityOptions } = await import('./decisionAgent');
    const options = await generateActivityOptions(
      sampleBenchmarks,
      sampleAvailability,
      'test-key',
      { title: 'Birthday', description: 'Night out' },
      sampleRealWorldContext
    );

    expect(options).toHaveLength(3);
    expect(options[0].title).toBe('Rooftop Jazz Night');
    expect(options[0].source_url).toBe('https://events.test/event-1');
    expect(options[1].venue_name).toBe('Canal Bar');
    const { createReactAgent } = await import('@langchain/langgraph/prebuilt');
    expect(createReactAgent).toHaveBeenCalledTimes(1);
    expect(MockChatOpenRouter).toHaveBeenCalled();
  }, 60000);

  it('retries when the structured output fails validation', async () => {
    mockAgentInvoke.mockResolvedValue({
      messages: [
        {
          getType: () => 'ai',
          content: 'invalid first, valid second',
        },
      ],
    });

    mockFinalizerInvoke
      .mockResolvedValueOnce({
        content: JSON.stringify({
          options: [
            {
              title: 'Bad option',
              description: 'Invalid date',
              suggested_date: '2025-08-20',
              suggested_time: '19:00',
              rank: 1,
              source_kind: 'custom',
              source_id: null,
              weather_note: null,
            },
            {
              title: 'Bad option 2',
              description: 'Invalid date',
              suggested_date: '2025-08-20',
              suggested_time: '19:30',
              rank: 2,
              source_kind: 'custom',
              source_id: null,
              weather_note: null,
            },
            {
              title: 'Bad option 3',
              description: 'Invalid date',
              suggested_date: '2025-08-20',
              suggested_time: '20:00',
              rank: 3,
              source_kind: 'custom',
              source_id: null,
              weather_note: null,
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        content: JSON.stringify({
          options: [
            {
              title: 'Rooftop Jazz Night',
              description: 'Live music and drinks',
              suggested_date: '2025-08-02',
              suggested_time: '19:00',
              rank: 1,
              source_kind: 'event',
              source_id: 'event-1',
              weather_note: null,
            },
            {
              title: 'Cocktails at Canal Bar',
              description: 'A bar pick for the group',
              suggested_date: '2025-08-03',
              suggested_time: '16:30',
              rank: 2,
              source_kind: 'venue',
              source_id: 'venue-1',
              weather_note: null,
            },
            {
              title: 'Apartment board games',
              description: 'A custom social fallback',
              suggested_date: '2025-08-03',
              suggested_time: '17:00',
              rank: 3,
              source_kind: 'custom',
              source_id: null,
              weather_note: null,
            },
          ],
        }),
      });

    const { generateActivityOptions } = await import('./decisionAgent');

    const promise = generateActivityOptions(
      sampleBenchmarks,
      sampleAvailability,
      'test-key',
      { title: 'Birthday', description: 'Night out' },
      sampleRealWorldContext
    );

    await vi.advanceTimersByTimeAsync(6000);
    const options = await promise;

    expect(options).toHaveLength(3);
    expect(mockAgentInvoke).toHaveBeenCalledTimes(2);
    expect(mockFinalizerInvoke).toHaveBeenCalledTimes(2);
  }, 60000);

  it('falls back to the stable model when the preview model is unsupported', async () => {
    process.env.OPENROUTER_MODEL = 'gemini-3-flash-preview';

    mockAgentInvoke
      .mockRejectedValueOnce(new Error('Model not found'))
      .mockResolvedValueOnce({
        messages: [
          {
            getType: () => 'ai',
            content: 'fallback run',
          },
        ],
      });

    mockFinalizerInvoke.mockResolvedValue({
      content: JSON.stringify({
        options: [
          {
            title: 'Rooftop Jazz Night',
            description: 'Live music and drinks',
            suggested_date: '2025-08-02',
            suggested_time: '19:00',
            rank: 1,
            source_kind: 'event',
            source_id: 'event-1',
            weather_note: null,
          },
          {
            title: 'Cocktails at Canal Bar',
            description: 'A bar pick for the group',
            suggested_date: '2025-08-03',
            suggested_time: '16:30',
            rank: 2,
            source_kind: 'venue',
            source_id: 'venue-1',
            weather_note: null,
          },
          {
            title: 'Apartment board games',
            description: 'A custom social fallback',
            suggested_date: '2025-08-03',
            suggested_time: '17:00',
            rank: 3,
            source_kind: 'custom',
            source_id: null,
            weather_note: null,
          },
        ],
      }),
    });

    const { generateActivityOptions } = await import('./decisionAgent');
    const options = await generateActivityOptions(
      sampleBenchmarks,
      sampleAvailability,
      'test-key',
      { title: 'Birthday', description: 'Night out' },
      sampleRealWorldContext
    );

    expect(options[0].title).toBe('Rooftop Jazz Night');

    const usedModels = MockChatOpenRouter.mock.calls.map((call) => {
      const firstArg = call[0];
      return typeof firstArg === 'string' ? firstArg : firstArg.model;
    });

    expect(usedModels).toContain('google/gemini-3-flash-preview');
    expect(usedModels).toContain('google/gemini-2.5-flash');
  }, 60000);

  it('can generate options even when no participant responses exist', async () => {
    mockAgentInvoke.mockResolvedValue({
      messages: [
        {
          getType: () => 'ai',
          content: '1. event:event-1 on 2025-08-02 at 19:00\n2. venue:venue-1 on 2025-08-02 at 18:00\n3. custom on 2025-08-02 at 20:00',
        },
      ],
    });

    mockFinalizerInvoke.mockResolvedValue({
      content: JSON.stringify({
        options: [
          {
            title: 'Rooftop Jazz Night',
            description: 'Live music and drinks',
            suggested_date: '2025-08-02',
            suggested_time: '19:00',
            rank: 1,
            source_kind: 'event',
            source_id: 'event-1',
            weather_note: null,
          },
          {
            title: 'Cocktails at Canal Bar',
            description: 'A relaxed venue pick',
            suggested_date: '2025-08-02',
            suggested_time: '18:00',
            rank: 2,
            source_kind: 'venue',
            source_id: 'venue-1',
            weather_note: null,
          },
          {
            title: 'Open planning night',
            description: 'A flexible custom fallback',
            suggested_date: '2025-08-02',
            suggested_time: '20:00',
            rank: 3,
            source_kind: 'custom',
            source_id: null,
            weather_note: null,
          },
        ],
      }),
    });

    const { generateActivityOptions } = await import('./decisionAgent');
    const options = await generateActivityOptions(
      [],
      [],
      'test-key',
      { title: 'Draft event', description: 'No responses yet' },
      sampleRealWorldContext
    );

    expect(options).toHaveLength(3);
    expect(options[0].title).toBe('Rooftop Jazz Night');
    expect(options[1].venue_name).toBe('Canal Bar');
  }, 60000);

  it('reads the API key from OPENROUTER_API_KEY first', async () => {
    process.env.OPENROUTER_API_KEY = 'openrouter-key';
    mockAgentInvoke.mockResolvedValue({
      messages: [{ getType: () => 'ai', content: 'ok' }],
    });
    mockFinalizerInvoke.mockResolvedValue({
      content: JSON.stringify({
        options: [
          {
            title: 'Rooftop Jazz Night',
            description: 'Live music and drinks',
            suggested_date: '2025-08-02',
            suggested_time: '19:00',
            rank: 1,
            source_kind: 'event',
            source_id: 'event-1',
            weather_note: null,
          },
          {
            title: 'Cocktails at Canal Bar',
            description: 'A bar pick for the group',
            suggested_date: '2025-08-03',
            suggested_time: '16:30',
            rank: 2,
            source_kind: 'venue',
            source_id: 'venue-1',
            weather_note: null,
          },
          {
            title: 'Apartment board games',
            description: 'A custom social fallback',
            suggested_date: '2025-08-03',
            suggested_time: '17:00',
            rank: 3,
            source_kind: 'custom',
            source_id: null,
            weather_note: null,
          },
        ],
      }),
    });

    const { generateActivityOptions } = await import('./decisionAgent');
    await generateActivityOptions(
      sampleBenchmarks,
      sampleAvailability,
      undefined,
      { title: 'Birthday', description: 'Night out' },
      sampleRealWorldContext
    );

    const firstConstructorArgs = MockChatOpenRouter.mock.calls[0][0] as { apiKey: string };
    expect(firstConstructorArgs.apiKey).toBe('openrouter-key');
  }, 60000);
});
