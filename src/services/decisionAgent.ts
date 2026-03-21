import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import type { Schema } from '@google/generative-ai';
import { TasteBenchmark } from '../models/TasteBenchmark';
import { DateTimeWindow } from '../models/Response';
import { RealWorldContext } from './realWorldData/types';

export interface GeneratedOption {
  title: string;
  description: string;
  suggested_date: string;
  suggested_time: string;
  rank: number;
  source_url?: string | null;
  venue_name?: string | null;
  price_range?: string | null;
  weather_note?: string | null;
  image_url?: string | null;
}

export interface ParticipantAvailability {
  participant_index: number;
  windows: DateTimeWindow[];
}

export interface EventContext {
  title: string;
  description: string;
}

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 5000;

/** Human-readable labels for the 10 benchmark questions. */
const QUESTION_LABELS: Record<string, string> = {
  q1: 'Outdoor activities',
  q2: 'Indoor activities',
  q3: 'Food preferences',
  q4: 'Sports interests',
  q5: 'Creative activities',
  q6: 'Social setting preferences',
  q7: 'Entertainment preferences',
  q8: 'Adventure activities',
  q9: 'Relaxation activities',
  q10: 'Learning activities',
};

/**
 * Build a preference summary per participant using labeled questions.
 */
function summarizeParticipant(benchmark: TasteBenchmark, index: number): string {
  const lines = Object.entries(benchmark.answers).map(([q, vals]) => {
    const label = QUESTION_LABELS[q] ?? q;
    return `  - ${label}: ${vals.join(', ')}`;
  });
  return `Participant ${index + 1}:\n${lines.join('\n')}`;
}

/**
 * Compute date availability ranked by how many participants selected each date.
 */
export function rankDatesByOverlap(
  participantAvailability: ParticipantAvailability[]
): { date: string; count: number }[] {
  const freq = new Map<string, number>();
  for (const pa of participantAvailability) {
    for (const w of pa.windows) {
      freq.set(w.date, (freq.get(w.date) ?? 0) + 1);
    }
  }
  return Array.from(freq.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => b.count - a.count || a.date.localeCompare(b.date));
}

/**
 * Find preferences shared by the majority of participants (> 50%).
 */
export function findCommonPreferences(
  benchmarks: TasteBenchmark[]
): Record<string, string[]> {
  const total = benchmarks.length;
  if (total === 0) return {};

  const freqByQuestion = new Map<string, Map<string, number>>();

  for (const b of benchmarks) {
    for (const [q, vals] of Object.entries(b.answers)) {
      if (!freqByQuestion.has(q)) freqByQuestion.set(q, new Map());
      const qMap = freqByQuestion.get(q)!;
      for (const v of vals) {
        qMap.set(v, (qMap.get(v) ?? 0) + 1);
      }
    }
  }

  const common: Record<string, string[]> = {};
  for (const [q, qMap] of freqByQuestion) {
    const majority = Array.from(qMap.entries())
      .filter(([, count]) => count > total / 2)
      .map(([val]) => val);
    if (majority.length > 0) {
      const label = QUESTION_LABELS[q] ?? q;
      common[label] = majority;
    }
  }
  return common;
}

/**
 * Build the full prompt with event context, labeled preferences,
 * date-overlap ranking with time windows, and shared-preference highlights.
 */
export function buildPrompt(
  benchmarks: TasteBenchmark[],
  participantAvailability: ParticipantAvailability[],
  eventContext?: EventContext,
  realWorldContext?: RealWorldContext
): string {
  const participantSummaries = benchmarks
    .map((b, i) => summarizeParticipant(b, i))
    .join('\n\n');

  const rankedDates = rankDatesByOverlap(participantAvailability);
  const totalParticipants = participantAvailability.length;
  const datesSection = rankedDates
    .map((d) => `  - ${d.date} (${d.count}/${totalParticipants} available)`)
    .join('\n');

  const availabilitySummary = participantAvailability
    .map((pa) => {
      const windows = pa.windows
        .map((w) => `  ${w.date}: ${w.start_time} - ${w.end_time}`)
        .join('\n');
      return `Participant ${pa.participant_index}:\n${windows}`;
    })
    .join('\n\n');

  const commonPrefs = findCommonPreferences(benchmarks);
  const commonSection = Object.keys(commonPrefs).length > 0
    ? `\nShared Group Preferences (majority agree):\n${Object.entries(commonPrefs)
        .map(([cat, vals]) => `  - ${cat}: ${vals.join(', ')}`)
        .join('\n')}\n`
    : '';

  const eventSection = eventContext
    ? `Event: "${eventContext.title}"\nDescription: ${eventContext.description}\n\n`
    : '';

  // Build real-world data section if available
  let realWorldSection = '';
  if (realWorldContext) {
    const { events, venues, weather, location } = realWorldContext;

    realWorldSection += `\n=== REAL-WORLD DATA ===\n\nLocation: ${location.city}, ${location.country}\n`;

    if (weather.length > 0) {
      realWorldSection += '\nWeather Forecast:\n';
      for (const w of weather) {
        const outdoor = w.isOutdoorFriendly ? 'outdoor-friendly' : 'NOT outdoor-friendly';
        realWorldSection += `  - ${w.date}: ${w.tempHighC}°C/${w.tempLowC}°C, ${w.description}, ${w.precipProbability}% rain, ${outdoor}\n`;
      }
    }

    if (events.length > 0) {
      realWorldSection += '\nUpcoming Events (nearby, on available dates):\n';
      for (let i = 0; i < events.length; i++) {
        const e = events[i];
        const time = e.startTime ? ` ${e.startTime}` : '';
        const venue = e.venueName ? ` at ${e.venueName}` : '';
        const price = e.priceRange ? ` | Price: ${e.priceRange}` : '';
        const url = e.url ? ` | URL: ${e.url}` : '';
        const img = e.imageUrl ? ` | Image: ${e.imageUrl}` : '';
        realWorldSection += `  ${i + 1}. "${e.title}" - ${e.category} - ${e.date}${time}${venue}${price}${url}${img}\n`;
      }
    }

    if (venues.length > 0) {
      realWorldSection += '\nNearby Venues:\n';
      for (let i = 0; i < venues.length; i++) {
        const v = venues[i];
        const rating = v.rating ? ` - Rating: ${v.rating}/5` : '';
        const price = v.priceLevel !== null ? ` - ${'€'.repeat(v.priceLevel + 1)}` : '';
        const url = v.url ? ` | URL: ${v.url}` : '';
        const img = v.photoUrl ? ` | Image: ${v.photoUrl}` : '';
        realWorldSection += `  ${i + 1}. "${v.name}" - ${v.category}${rating}${price}${url}${img}\n`;
      }
    }
  }

  const realWorldInstructions = realWorldContext
    ? `- IMPORTANT: Base your suggestions on the REAL-WORLD DATA provided above. At least 2 of your 3 suggestions MUST reference actual events or venues from the data.
- Include the source_url from the real event/venue data when available.
- Include the venue_name from the real data when applicable.
- Include the price_range from the real data when available.
- Include a weather_note considering the forecast for the suggested date.
- Include the image_url from the real event/venue data when available.
- You may suggest one creative option if none of the real data fits well.`
    : `- source_url, venue_name, price_range, weather_note, and image_url should be null when no real-world data is available.`;

  return `You are Go Fish, an AI group activity planner. Your job is to suggest 3 activity options that maximize group enjoyment by finding the sweet spot across everyone's preferences.

${eventSection}GROUP PROFILE (${benchmarks.length} participants):

${participantSummaries}
${commonSection}
DATE AVAILABILITY (ranked by overlap):
${datesSection}

PARTICIPANT TIME WINDOWS:
${availabilitySummary}
${realWorldSection}
INSTRUCTIONS:
- Suggest exactly 3 activity options ranked by estimated group compatibility (1 = best fit).
- Strongly prefer dates where the most participants are available.
- Find overlapping time windows and suggest a specific time within the overlap.
- Blend the group's shared preferences; for conflicts, find creative compromises.
- Each suggestion should feel distinct — don't suggest 3 variations of the same thing.
- Descriptions should be specific and actionable (include what, where-type, and why it fits the group).
- suggested_date must be one of the available dates listed above in YYYY-MM-DD format.
- suggested_time must be in HH:MM format (24-hour) within the overlapping availability window.
${realWorldInstructions}`;
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
      source_url: item.source_url ? String(item.source_url) : null,
      venue_name: item.venue_name ? String(item.venue_name) : null,
      price_range: item.price_range ? String(item.price_range) : null,
      weather_note: item.weather_note ? String(item.weather_note) : null,
      image_url: item.image_url ? String(item.image_url) : null,
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

/** JSON schema for Gemini structured output mode. */
const RESPONSE_SCHEMA: Schema = {
  type: SchemaType.ARRAY,
  items: {
    type: SchemaType.OBJECT,
    properties: {
      title: { type: SchemaType.STRING, description: 'Short activity name (use real event/venue name if based on real data)' },
      description: { type: SchemaType.STRING, description: 'Brief, actionable description of the activity' },
      suggested_date: { type: SchemaType.STRING, description: 'One of the available dates in YYYY-MM-DD format' },
      suggested_time: { type: SchemaType.STRING, description: 'Start time in HH:MM 24-hour format within overlapping availability' },
      rank: { type: SchemaType.INTEGER, description: 'Rank 1-3 where 1 is best fit' },
      source_url: { type: SchemaType.STRING, description: 'URL to the real event/venue page, or null if custom suggestion', nullable: true },
      venue_name: { type: SchemaType.STRING, description: 'Name of the venue, or null if not applicable', nullable: true },
      price_range: { type: SchemaType.STRING, description: 'Estimated cost (e.g. "Free", "EUR 15-30"), or null', nullable: true },
      weather_note: { type: SchemaType.STRING, description: 'Brief weather consideration for this activity, or null', nullable: true },
      image_url: { type: SchemaType.STRING, description: 'Image URL from the real event/venue data, or null', nullable: true },
    },
    required: ['title', 'description', 'suggested_date', 'suggested_time', 'rank'],
  },
};

export async function generateActivityOptions(
  benchmarks: TasteBenchmark[],
  participantAvailability: ParticipantAvailability[],
  apiKey?: string,
  eventContext?: EventContext,
  realWorldContext?: RealWorldContext
): Promise<GeneratedOption[]> {
  const key = apiKey ?? process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0.7,
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
    },
  });
  const prompt = buildPrompt(benchmarks, participantAvailability, eventContext, realWorldContext);

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
