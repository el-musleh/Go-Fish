import { GeoLocation, NormalizedVenue } from '../types';
import { apiCache, CACHE_TTL } from '../cache';

interface FoursquarePlace {
  fsq_place_id: string;
  name: string;
  categories: Array<{ fsq_category_id: string; name: string }>;
  location: {
    address?: string;
    locality?: string;
    country?: string;
    formatted_address?: string;
  };
  website?: string;
  link?: string;
}

interface FoursquareResponse {
  results: FoursquarePlace[];
}

const QUERY_CATEGORIES = [
  'restaurants and dining',
  'bars and nightlife',
  'parks and recreation',
  'arts and entertainment',
  'sports and activities',
];

export async function fetchFoursquareVenues(
  location: GeoLocation,
  preferenceKeywords?: string[]
): Promise<NormalizedVenue[]> {
  const apiKey = process.env.FOURSQUARE_API_KEY;
  if (!apiKey) {
    throw new Error('FOURSQUARE_API_KEY is not configured');
  }

  const cacheKey = apiCache.buildKey(
    'foursquare',
    `${location.latitude},${location.longitude}`,
    preferenceKeywords?.join(',') ?? 'default'
  );

  const cached = apiCache.get<NormalizedVenue[]>(cacheKey);
  if (cached) return cached;

  const queries = preferenceKeywords?.length
    ? preferenceKeywords.slice(0, 3)
    : QUERY_CATEGORIES.slice(0, 3);

  const allVenues: NormalizedVenue[] = [];

  for (const query of queries) {
    const params = new URLSearchParams({
      ll: `${location.latitude},${location.longitude}`,
      radius: '5000',
      query,
      limit: '5',
    });

    const response = await fetch(
      `https://places-api.foursquare.com/places/search?${params}`,
      {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'X-Places-Api-Version': '2025-06-17',
        },
      }
    );

    if (!response.ok) {
      throw new Error(
        `Foursquare API error: ${response.status} ${response.statusText}`
      );
    }

    const data = (await response.json()) as FoursquareResponse;

    for (const place of data.results) {
      allVenues.push({
        source: 'foursquare' as const,
        sourceId: place.fsq_place_id,
        name: place.name,
        category: place.categories[0]?.name?.toLowerCase() ?? 'unknown',
        address:
          place.location.formatted_address ?? place.location.address ?? '',
        rating: null,
        priceLevel: null,
        url: place.website ?? null,
        photoUrl: null,
      });
    }
  }

  const seen = new Set<string>();
  const deduped = allVenues.filter((v) => {
    if (seen.has(v.sourceId)) return false;
    seen.add(v.sourceId);
    return true;
  });

  apiCache.set(cacheKey, deduped, CACHE_TTL.VENUES);
  return deduped;
}
