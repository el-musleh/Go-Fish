import { DEFAULT_MODEL, resolveOpenRouterApiKey } from './decisionAgent/model';
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
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON object found in AI response');
  const parsed = JSON.parse(match[0]);
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

  const apiKey = resolveOpenRouterApiKey();
  const prompt = buildPrompt(event);

  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.4,
      max_tokens: 512,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`DeepSeek API error ${res.status}: ${JSON.stringify(err)}`);
  }

  const data = await res.json() as { choices?: { message?: { content?: string } }[] };
  const text: string = data?.choices?.[0]?.message?.content ?? '';
  const result = parseResponse(text);
  cache.set(cacheKey, { data: result, expiry: Date.now() + CACHE_TTL_MS });
  return result;
}
