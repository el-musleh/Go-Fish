import { GeoLocation, NormalizedVenue } from '../types';
import { apiCache, CACHE_TTL } from '../cache';

interface FoursquarePlace {
  fsq_id: string;
  name: string;
  categories: Array<{ id: number; name: string }>;
  location: {
    address?: string;
    locality?: string;
    country?: string;
    formatted_address?: string;
  };
  rating?: number;
  price?: number;
  link?: string;
  photos?: Array<{
    prefix: string;
    suffix: string;
    width: number;
    height: number;
  }>;
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
      fields: 'fsq_id,name,categories,location,rating,price,link,photos',
      limit: '5',
    });

    const response = await fetch(
      `https://api.foursquare.com/v3/places/search?${params}`,
      {
        headers: {
          Accept: 'application/json',
          Authorization: apiKey,
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
      const photoUrl = place.photos?.[0]
        ? `${place.photos[0].prefix}300x300${place.photos[0].suffix}`
        : null;

      allVenues.push({
        source: 'foursquare' as const,
        sourceId: place.fsq_id,
        name: place.name,
        category: place.categories[0]?.name?.toLowerCase() ?? 'unknown',
        address:
          place.location.formatted_address ?? place.location.address ?? '',
        rating: place.rating
          ? Math.round((place.rating / 2) * 10) / 10
          : null, // Convert 10-scale to 5-scale
        priceLevel: place.price ?? null,
        url: place.link ?? null,
        photoUrl,
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
