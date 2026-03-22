import { DEFAULT_MODEL, resolveOpenRouterApiKey, extractJson, createChatOpenRouterModel } from './decisionAgent/model';
import { EventSuggestions } from '../models/Event';

export type { EventSuggestions };

function buildPrompt(event: { title: string; description: string; location_city: string | null }): string {
  return `You are a helpful event planning assistant. Given an event's title, description, and city, suggest realistic details.

Event:
- Title: ${event.title}
- Description: ${event.description || 'No description provided'}
- City: ${event.location_city || 'Unknown'}

Return ONLY a valid JSON object with this exact structure (no markdown, no extra text):
{
  "venue_ideas": ["<short venue/activity name>", "<short venue/activity name>", "<short venue/activity name>"],
  "estimated_cost_per_person": "<e.g. €15–25>",
  "estimated_duration_minutes": 90,
  "suggested_time": "<e.g. Evening (19:00–21:30)>",
  "suggested_day": "<e.g. Friday or Saturday>"
}`;
}

function parseResponse(text: string): EventSuggestions {
  const parsed = JSON.parse(extractJson(text));
  return {
    venue_ideas: Array.isArray(parsed.venue_ideas) ? parsed.venue_ideas : [],
    estimated_cost_per_person: parsed.estimated_cost_per_person ?? '—',
    estimated_duration_minutes: typeof parsed.estimated_duration_minutes === 'number' ? parsed.estimated_duration_minutes : 0,
    suggested_time: parsed.suggested_time ?? '—',
    suggested_day: parsed.suggested_day ?? '—',
  };
}

const cache = new Map<string, { data: EventSuggestions; expiry: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function generateEventSuggestions(event: {
  title: string;
  description: string;
  location_city: string | null;
}): Promise<EventSuggestions> {
  const cacheKey = `${event.title}|${event.description}|${event.location_city ?? ''}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiry > Date.now()) return cached.data;

  const model = createChatOpenRouterModel({ temperature: 0.4 });
  const prompt = buildPrompt(event);

  const res = await model.invoke(prompt);
  const result = parseResponse(res.content as string);
  cache.set(cacheKey, { data: result, expiry: Date.now() + CACHE_TTL_MS });
  return result;
}
