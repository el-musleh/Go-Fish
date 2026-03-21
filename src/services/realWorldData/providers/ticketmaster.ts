import { GeoLocation, NormalizedEvent } from '../types';
import { apiCache, CACHE_TTL } from '../cache';

interface TicketmasterEvent {
  id: string;
  name: string;
  dates: {
    start: {
      localDate: string;
      localTime?: string;
      dateTime?: string;
    };
  };
  classifications?: Array<{
    segment?: { name: string };
    genre?: { name: string };
  }>;
  priceRanges?: Array<{
    min: number;
    max: number;
    currency: string;
  }>;
  url?: string;
  images?: Array<{ url: string; ratio: string; width: number }>;
  _embedded?: {
    venues?: Array<{
      name: string;
      address?: { line1: string };
      city?: { name: string };
    }>;
  };
}

interface TicketmasterResponse {
  _embedded?: {
    events: TicketmasterEvent[];
  };
}

export async function fetchTicketmasterEvents(
  location: GeoLocation,
  startDate: string,
  endDate: string,
  keywords?: string[]
): Promise<NormalizedEvent[]> {
  const apiKey = process.env.TICKETMASTER_API_KEY;
  if (!apiKey) {
    throw new Error('TICKETMASTER_API_KEY is not configured');
  }

  const cacheKey = apiCache.buildKey(
    'ticketmaster',
    `${location.latitude},${location.longitude}`,
    `${startDate}_${endDate}`
  );

  const cached = apiCache.get<NormalizedEvent[]>(cacheKey);
  if (cached) return cached;

  const params = new URLSearchParams({
    apikey: apiKey,
    latlong: `${location.latitude},${location.longitude}`,
    radius: '50',
    unit: 'km',
    startDateTime: `${startDate}T00:00:00Z`,
    endDateTime: `${endDate}T23:59:59Z`,
    size: '20',
    sort: 'date,asc',
    countryCode: location.country,
  });

  if (keywords?.length) {
    params.set('keyword', keywords.join(' '));
  }

  const url = `https://app.ticketmaster.com/discovery/v2/events.json?${params}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Ticketmaster API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as TicketmasterResponse;
  const events = data._embedded?.events ?? [];

  const normalized: NormalizedEvent[] = events.map((event) => {
    const venue = event._embedded?.venues?.[0];
    const classification = event.classifications?.[0];
    const price = event.priceRanges?.[0];
    const image = event.images?.find((img) => img.ratio === '16_9') ?? event.images?.[0];

    return {
      source: 'ticketmaster' as const,
      sourceId: event.id,
      title: event.name,
      description: classification
        ? `${classification.segment?.name ?? ''} - ${classification.genre?.name ?? ''}`.trim()
        : '',
      category: classification?.segment?.name?.toLowerCase() ?? 'other',
      date: event.dates.start.localDate,
      startTime: event.dates.start.localTime
        ? event.dates.start.localTime.substring(0, 5)
        : null,
      endTime: null,
      venueName: venue?.name ?? null,
      venueAddress: venue
        ? [venue.address?.line1, venue.city?.name].filter(Boolean).join(', ')
        : null,
      priceRange: price
        ? `${price.currency} ${price.min}–${price.max}`
        : null,
      url: event.url ?? null,
      imageUrl: image?.url ?? null,
    };
  });

  apiCache.set(cacheKey, normalized, CACHE_TTL.EVENTS);
  return normalized;
}
