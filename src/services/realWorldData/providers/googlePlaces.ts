import { GeoLocation, NormalizedVenue } from '../types';
import { apiCache, CACHE_TTL } from '../cache';

const PRICE_LEVEL_MAP: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

interface GooglePlace {
  id: string;
  displayName: {
    text: string;
    languageCode: string;
  };
  formattedAddress: string;
  rating?: number;
  priceLevel?: string;
  types: string[];
  primaryType?: string;
  websiteUri?: string;
  photos?: Array<{
    name: string;
    widthPx: number;
    heightPx: number;
  }>;
}

interface TextSearchResponse {
  places?: GooglePlace[];
}

// Category queries to search for different venue types
const VENUE_QUERIES = [
  'restaurants',
  'bars and nightlife',
  'parks and outdoor activities',
  'museums and cultural venues',
  'entertainment and fun activities',
];

export async function fetchGooglePlacesVenues(
  location: GeoLocation,
  preferenceKeywords?: string[]
): Promise<NormalizedVenue[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_PLACES_API_KEY is not configured');
  }

  const cacheKey = apiCache.buildKey(
    'google_places',
    `${location.latitude},${location.longitude}`,
    preferenceKeywords?.join(',') ?? 'default'
  );

  const cached = apiCache.get<NormalizedVenue[]>(cacheKey);
  if (cached) return cached;

  // Use preference keywords if available, otherwise use default queries
  const queries = preferenceKeywords?.length
    ? preferenceKeywords.map((kw) => `${kw} in ${location.city}`)
    : VENUE_QUERIES.map((q) => `${q} in ${location.city}`);

  // Fetch top 2-3 queries to stay within rate limits
  const selectedQueries = queries.slice(0, 3);

  const allVenues: NormalizedVenue[] = [];

  for (const query of selectedQueries) {
    const fieldMask =
      'places.id,places.displayName,places.formattedAddress,places.rating,places.priceLevel,places.types,places.primaryType,places.websiteUri,places.photos';

    const response = await fetch(
      'https://places.googleapis.com/v1/places:searchText',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': fieldMask,
        },
        body: JSON.stringify({
          textQuery: query,
          locationBias: {
            circle: {
              center: {
                latitude: location.latitude,
                longitude: location.longitude,
              },
              radius: 5000.0,
            },
          },
          maxResultCount: 5,
          languageCode: 'de',
        }),
      }
    );

    if (!response.ok) {
      throw new Error(
        `Google Places API error: ${response.status} ${response.statusText}`
      );
    }

    const data = (await response.json()) as TextSearchResponse;
    const places = data.places ?? [];

    for (const place of places) {
      // Build photo URL if available
      const photoUrl = place.photos?.[0]
        ? `https://places.googleapis.com/v1/${place.photos[0].name}/media?maxWidthPx=400&key=${apiKey}`
        : null;

      allVenues.push({
        source: 'google_places' as const,
        sourceId: place.id,
        name: place.displayName.text,
        category: place.primaryType ?? place.types[0] ?? 'unknown',
        address: place.formattedAddress,
        rating: place.rating ?? null,
        priceLevel: place.priceLevel
          ? (PRICE_LEVEL_MAP[place.priceLevel] ?? null)
          : null,
        url: place.websiteUri ?? null,
        photoUrl,
      });
    }
  }

  // Deduplicate by sourceId
  const seen = new Set<string>();
  const deduped = allVenues.filter((v) => {
    if (seen.has(v.sourceId)) return false;
    seen.add(v.sourceId);
    return true;
  });

  apiCache.set(cacheKey, deduped, CACHE_TTL.VENUES);
  return deduped;
}
