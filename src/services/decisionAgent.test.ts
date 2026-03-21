import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildPrompt, parseGeminiResponse } from './decisionAgent';
import { TasteBenchmark } from '../models/TasteBenchmark';

const mockGenerateContent = vi.fn();

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: vi.fn().mockReturnValue({
      generateContent: mockGenerateContent,
    }),
  })),
}));

const sampleBenchmarks: TasteBenchmark[] = [
  {
    id: '1',
    user_id: 'u1',
    answers: { q1: ['hiking', 'biking'], q2: ['outdoors'] },
    created_at: new Date(),
  },
  {
    id: '2',
    user_id: 'u2',
    answers: { q1: ['cooking', 'movies'], q2: ['indoors'] },
    created_at: new Date(),
  },
];

const sampleDates = ['2025-08-01', '2025-08-02', '2025-08-03'];

const validGeminiResponse = JSON.stringify([
  { title: 'Outdoor Cooking', description: 'Cook together in a park', suggested_date: '2025-08-01', rank: 1 },
  { title: 'Movie Night', description: 'Watch a film outdoors', suggested_date: '2025-08-02', rank: 2 },
  { title: 'Bike & Brunch', description: 'Bike ride then brunch', suggested_date: '2025-08-03', rank: 3 },
]);

describe('buildPrompt', () => {
  it('includes all participant preferences', () => {
    const prompt = buildPrompt(sampleBenchmarks, sampleDates);
    expect(prompt).toContain('Participant 1');
    expect(prompt).toContain('hiking, biking');
    expect(prompt).toContain('Participant 2');
    expect(prompt).toContain('cooking, movies');
  });

  it('includes all available dates', () => {
    const prompt = buildPrompt(sampleBenchmarks, sampleDates);
    expect(prompt).toContain('2025-08-01');
    expect(prompt).toContain('2025-08-02');
    expect(prompt).toContain('2025-08-03');
  });

  it('requests JSON array of exactly 3 options', () => {
    const prompt = buildPrompt(sampleBenchmarks, sampleDates);
    expect(prompt).toContain('exactly 3');
    expect(prompt).toContain('JSON array');
  });
});

describe('parseGeminiResponse', () => {
  it('parses valid JSON response', () => {
    const options = parseGeminiResponse(validGeminiResponse);
    expect(options).toHaveLength(3);
    expect(options[0].title).toBe('Outdoor Cooking');
    expect(options[0].rank).toBe(1);
    expect(options[2].rank).toBe(3);
  });

  it('extracts JSON from text with surrounding content', () => {
    const text = 'Here are the options:\n' + validGeminiResponse + '\nHope this helps!';
    const options = parseGeminiResponse(text);
    expect(options).toHaveLength(3);
  });

  it('throws if no JSON array found', () => {
    expect(() => parseGeminiResponse('no json here')).toThrow('No JSON array found');
  });

  it('throws if array does not have exactly 3 items', () => {
    const twoItems = JSON.stringify([
      { title: 'A', description: 'B', suggested_date: '2025-01-01', rank: 1 },
      { title: 'C', description: 'D', suggested_date: '2025-01-02', rank: 2 },
    ]);
    expect(() => parseGeminiResponse(twoItems)).toThrow('exactly 3');
  });

  it('throws if an option is missing required fields', () => {
    const missing = JSON.stringify([
      { title: 'A', description: 'B', suggested_date: '2025-01-01', rank: 1 },
      { title: 'C', description: 'D', rank: 2 },
      { title: 'E', description: 'F', suggested_date: '2025-01-03', rank: 3 },
    ]);
    expect(() => parseGeminiResponse(missing)).toThrow('must have title, description, suggested_date, and rank');
  });

  it('throws if ranks are not distinct 1, 2, 3', () => {
    const badRanks = JSON.stringify([
      { title: 'A', description: 'B', suggested_date: '2025-01-01', rank: 1 },
      { title: 'C', description: 'D', suggested_date: '2025-01-02', rank: 1 },
      { title: 'E', description: 'F', suggested_date: '2025-01-03', rank: 3 },
    ]);
    expect(() => parseGeminiResponse(badRanks)).toThrow('distinct ranks');
  });
});

describe('generateActivityOptions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns parsed options on successful API call', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      response: { text: () => validGeminiResponse },
    });

    const { generateActivityOptions } = await import('./decisionAgent');
    const options = await generateActivityOptions(sampleBenchmarks, sampleDates, 'test-key');
    expect(options).toHaveLength(3);
    expect(options[0].title).toBe('Outdoor Cooking');
    expect(options[1].rank).toBe(2);
  });

  it('throws if no API key is provided', async () => {
    const origKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    const { generateActivityOptions } = await import('./decisionAgent');
    await expect(generateActivityOptions(sampleBenchmarks, sampleDates)).rejects.toThrow(
      'GEMINI_API_KEY is not configured'
    );

    if (origKey) process.env.GEMINI_API_KEY = origKey;
  });

  it('retries on failure with exponential backoff', async () => {
    mockGenerateContent
      .mockRejectedValueOnce(new Error('API error'))
      .mockRejectedValueOnce(new Error('API error'))
      .mockResolvedValueOnce({
        response: { text: () => validGeminiResponse },
      });

    const { generateActivityOptions } = await import('./decisionAgent');
    const options = await generateActivityOptions(sampleBenchmarks, sampleDates, 'test-key');
    expect(options).toHaveLength(3);
    expect(mockGenerateContent).toHaveBeenCalledTimes(3);
  });

  it('throws after exhausting all retry attempts', async () => {
    mockGenerateContent
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockRejectedValueOnce(new Error('fail 3'));

    const { generateActivityOptions } = await import('./decisionAgent');
    await expect(
      generateActivityOptions(sampleBenchmarks, sampleDates, 'test-key')
    ).rejects.toThrow('Activity generation failed after 3 attempts');
    expect(mockGenerateContent).toHaveBeenCalledTimes(3);
  });

  it('retries on parse failure', async () => {
    mockGenerateContent
      .mockResolvedValueOnce({
        response: { text: () => 'not valid json' },
      })
      .mockResolvedValueOnce({
        response: { text: () => validGeminiResponse },
      });

    const { generateActivityOptions } = await import('./decisionAgent');
    const options = await generateActivityOptions(sampleBenchmarks, sampleDates, 'test-key');
    expect(options).toHaveLength(3);
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
  });
});
