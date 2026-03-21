import { TasteBenchmark } from '../../models/TasteBenchmark';
import { GeoLocation, RealWorldContext, NormalizedEvent, NormalizedVenue, DayWeather } from './types';
import { fetchTicketmasterEvents } from './providers/ticketmaster';
import { fetchWeatherForecast } from './providers/openWeatherMap';
import { fetchGooglePlacesVenues } from './providers/googlePlaces';
import { fetchFoursquareVenues } from './providers/foursquare';
import { fetchPredictHQEvents } from './providers/predicthq';
import { rankEvents, rankVenues, extractKeywords } from './relevanceScorer';

const MAX_EVENTS = 15;
const MAX_VENUES = 10;

export async function fetchRealWorldContext(
  location: GeoLocation,
  startDate: string,
  endDate: string,
  benchmarks: TasteBenchmark[]
): Promise<RealWorldContext> {
  const keywords = extractKeywords(benchmarks);

  // Fetch all data sources in parallel
  const [
    ticketmasterResult,
    predictHQResult,
    googlePlacesResult,
    foursquareResult,
    weatherResult,
  ] = await Promise.allSettled([
    fetchTicketmasterEvents(location, startDate, endDate, keywords),
    fetchPredictHQEvents(location, startDate, endDate),
    fetchGooglePlacesVenues(location, keywords),
    fetchFoursquareVenues(location, keywords),
    fetchWeatherForecast(location),
  ]);

  // Collect events from settled results
  const allEvents: NormalizedEvent[] = [];
  if (ticketmasterResult.status === 'fulfilled') {
    allEvents.push(...ticketmasterResult.value);
  } else {
    console.warn('Ticketmaster fetch failed:', ticketmasterResult.reason);
  }
  if (predictHQResult.status === 'fulfilled') {
    allEvents.push(...predictHQResult.value);
  } else {
    console.warn('PredictHQ fetch failed:', predictHQResult.reason);
  }

  // Collect venues
  const allVenues: NormalizedVenue[] = [];
  if (googlePlacesResult.status === 'fulfilled') {
    allVenues.push(...googlePlacesResult.value);
  } else {
    console.warn('Google Places fetch failed:', googlePlacesResult.reason);
  }
  if (foursquareResult.status === 'fulfilled') {
    allVenues.push(...foursquareResult.value);
  } else {
    console.warn('Foursquare fetch failed:', foursquareResult.reason);
  }

  // Weather
  let weather: DayWeather[] = [];
  if (weatherResult.status === 'fulfilled') {
    weather = weatherResult.value;
  } else {
    console.warn('Weather fetch failed:', weatherResult.reason);
  }

  // Deduplicate events by title + date (cross-source)
  const eventKey = (e: NormalizedEvent) => `${e.title.toLowerCase().trim()}:${e.date}`;
  const seenEvents = new Set<string>();
  const dedupedEvents = allEvents.filter((e) => {
    const key = eventKey(e);
    if (seenEvents.has(key)) return false;
    seenEvents.add(key);
    return true;
  });

  // Deduplicate venues by name similarity
  const seenVenueNames = new Set<string>();
  const dedupedVenues = allVenues.filter((v) => {
    const key = v.name.toLowerCase().trim();
    if (seenVenueNames.has(key)) return false;
    seenVenueNames.add(key);
    return true;
  });

  // Rank by relevance and limit
  const rankedEvents = rankEvents(dedupedEvents, benchmarks).slice(0, MAX_EVENTS);
  const rankedVenues = rankVenues(dedupedVenues, benchmarks).slice(0, MAX_VENUES);

  return {
    events: rankedEvents,
    venues: rankedVenues,
    weather,
    location,
    fetchedAt: new Date(),
  };
}
