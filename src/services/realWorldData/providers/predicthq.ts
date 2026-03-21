import { GeoLocation, NormalizedEvent } from '../types';
import { apiCache, CACHE_TTL } from '../cache';

interface PredictHQEvent {
  id: string;
  title: string;
  description: string;
  category: string;
  start: string; // ISO 8601
  end: string | null;
  entities: Array<{
    entity_id: string;
    name: string;
    type: string;
    formatted_address?: string;
  }>;
}

interface PredictHQResponse {
  count: number;
  results: PredictHQEvent[];
}

const RELEVANT_CATEGORIES = [
  'community',
  'concerts',
  'conferences',
  'expos',
  'festivals',
  'performing-arts',
  'sports',
];

export async function fetchPredictHQEvents(
  location: GeoLocation,
  startDate: string,
  endDate: string
): Promise<NormalizedEvent[]> {
  const apiToken = process.env.PREDICTHQ_API_TOKEN;
  if (!apiToken) {
    throw new Error('PREDICTHQ_API_TOKEN is not configured');
  }

  const cacheKey = apiCache.buildKey(
    'predicthq',
    `${location.latitude},${location.longitude}`,
    `${startDate}_${endDate}`
  );

  const cached = apiCache.get<NormalizedEvent[]>(cacheKey);
  if (cached) return cached;

  const params = new URLSearchParams({
    within: `5km@${location.latitude},${location.longitude}`,
    'start.gte': startDate,
    'start.lte': endDate,
    category: RELEVANT_CATEGORIES.join(','),
    limit: '20',
    sort: 'start',
  });

  const response = await fetch(
    `https://api.predicthq.com/v1/events?${params}`,
    {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${apiToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      `PredictHQ API error: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as PredictHQResponse;

  const normalized: NormalizedEvent[] = data.results.map((event) => {
    const venue = event.entities.find((e) => e.type === 'venue');
    const startDt = new Date(event.start);
    const endDt = event.end ? new Date(event.end) : null;

    return {
      source: 'predicthq' as const,
      sourceId: event.id,
      title: event.title,
      description: event.description || '',
      category: event.category,
      date: startDt.toISOString().split('T')[0],
      startTime:
        startDt.toISOString().split('T')[1]?.substring(0, 5) ?? null,
      endTime: endDt
        ? (endDt.toISOString().split('T')[1]?.substring(0, 5) ?? null)
        : null,
      venueName: venue?.name ?? null,
      venueAddress: venue?.formatted_address ?? null,
      priceRange: null,
      url: null,
      imageUrl: null,
    };
  });

  apiCache.set(cacheKey, normalized, CACHE_TTL.EVENTS);
  return normalized;
}
