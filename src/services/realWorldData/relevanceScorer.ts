import { TasteBenchmark } from '../../models/TasteBenchmark';
import { NormalizedEvent, NormalizedVenue } from './types';

/**
 * Extract relevant keywords from taste benchmarks.
 * TasteBenchmark.answers is Record<string, string[]> — e.g. { q1: ["Outdoor activities", "Live music"], q2: [...] }
 */
function extractKeywords(benchmarks: TasteBenchmark[]): string[] {
  const keywords: string[] = [];
  for (const benchmark of benchmarks) {
    for (const values of Object.values(benchmark.answers)) {
      for (const value of values) {
        keywords.push(value.toLowerCase());
      }
    }
  }
  return keywords;
}

function scoreText(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  let score = 0;
  for (const keyword of keywords) {
    if (lower.includes(keyword)) score += 1;
    // Partial word matching
    const words = keyword.split(/\s+/);
    for (const word of words) {
      if (word.length > 3 && lower.includes(word)) score += 0.5;
    }
  }
  return score;
}

export function rankEvents(
  events: NormalizedEvent[],
  benchmarks: TasteBenchmark[]
): NormalizedEvent[] {
  const keywords = extractKeywords(benchmarks);

  const scored = events.map((event) => {
    const score = scoreText(
      `${event.title} ${event.description} ${event.category}`,
      keywords
    );
    return { event, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.event);
}

export function rankVenues(
  venues: NormalizedVenue[],
  benchmarks: TasteBenchmark[]
): NormalizedVenue[] {
  const keywords = extractKeywords(benchmarks);

  const scored = venues.map((venue) => {
    let score = scoreText(
      `${venue.name} ${venue.category}`,
      keywords
    );
    // Boost higher-rated venues
    if (venue.rating) score += venue.rating * 0.2;
    return { venue, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.venue);
}

export { extractKeywords };
