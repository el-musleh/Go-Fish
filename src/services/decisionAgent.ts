import { GoogleGenerativeAI } from '@google/generative-ai';
import { TasteBenchmark } from '../models/TasteBenchmark';
import { DateTimeWindow } from '../models/Response';

export interface GeneratedOption {
  title: string;
  description: string;
  suggested_date: string;
  suggested_time: string;
  rank: number;
}

export interface ParticipantAvailability {
  participant_index: number;
  windows: DateTimeWindow[];
}

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 5000;

export function buildPrompt(
  benchmarks: TasteBenchmark[],
  participantAvailability: ParticipantAvailability[]
): string {
  const benchmarkSummary = benchmarks
    .map((b, i) => {
      const answers = Object.entries(b.answers)
        .map(([q, vals]) => `  ${q}: ${vals.join(', ')}`)
        .join('\n');
      return `Participant ${i + 1}:\n${answers}`;
    })
    .join('\n\n');

  const availabilitySummary = participantAvailability
    .map((pa) => {
      const windows = pa.windows
        .map((w) => `  ${w.date}: ${w.start_time} - ${w.end_time}`)
        .join('\n');
      return `Participant ${pa.participant_index}:\n${windows}`;
    })
    .join('\n\n');

  return `You are a group activity planner. Based on the following participant preferences and available time windows, suggest exactly 3 activity options that the group would enjoy together.

Participant Preferences:
${benchmarkSummary}

Participant Availability Windows:
${availabilitySummary}

Important: Find dates and time slots where participants have overlapping availability. Suggest a specific time that falls within the overlapping window for each activity.

Return a JSON array of exactly 3 objects, ranked by estimated group compatibility (1 = best fit). Each object must have:
- "title": a short activity name
- "description": a brief description of the activity
- "suggested_date": one of the available dates (YYYY-MM-DD format)
- "suggested_time": a specific start time within the overlapping availability window (HH:MM format, 24-hour)
- "rank": 1, 2, or 3

Example: [{"title":"Park Picnic","description":"A relaxed outdoor gathering","suggested_date":"2025-03-22","suggested_time":"14:00","rank":1}]

Return ONLY the JSON array, no other text.`;
}

export function parseGeminiResponse(text: string): GeneratedOption[] {
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('No JSON array found in Gemini response');
  }

  const parsed = JSON.parse(jsonMatch[0]);

  if (!Array.isArray(parsed) || parsed.length !== 3) {
    throw new Error('Gemini response must contain exactly 3 activity options');
  }

  const timeRegex = /^\d{2}:\d{2}$/;

  const options: GeneratedOption[] = parsed.map((item: Record<string, unknown>) => {
    if (!item.title || !item.description || !item.suggested_date || !item.rank || !item.suggested_time) {
      throw new Error('Each activity option must have title, description, suggested_date, suggested_time, and rank');
    }
    const suggestedTime = String(item.suggested_time);
    if (!timeRegex.test(suggestedTime)) {
      throw new Error(`Invalid suggested_time format: "${suggestedTime}" (expected HH:MM)`);
    }
    return {
      title: String(item.title),
      description: String(item.description),
      suggested_date: String(item.suggested_date),
      suggested_time: suggestedTime,
      rank: Number(item.rank),
    };
  });

  const ranks = options.map((o) => o.rank).sort();
  if (ranks[0] !== 1 || ranks[1] !== 2 || ranks[2] !== 3) {
    throw new Error('Activity options must have distinct ranks 1, 2, and 3');
  }

  return options;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function generateActivityOptions(
  benchmarks: TasteBenchmark[],
  participantAvailability: ParticipantAvailability[],
  apiKey?: string
): Promise<GeneratedOption[]> {
  const key = apiKey ?? process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const prompt = buildPrompt(benchmarks, participantAvailability);

  let lastError: Error | undefined;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      return parseGeminiResponse(text);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_RETRIES - 1) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        await sleep(delay);
      }
    }
  }

  throw new Error(
    `Activity generation failed after ${MAX_RETRIES} attempts: ${lastError?.message}`
  );
}
