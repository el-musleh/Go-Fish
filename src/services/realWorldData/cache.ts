interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

// TTL constants
export const CACHE_TTL = {
  EVENTS: 4 * 60 * 60 * 1000,    // 4 hours
  VENUES: 24 * 60 * 60 * 1000,   // 24 hours
  WEATHER: 60 * 60 * 1000,       // 1 hour
} as const;

export class ApiCache {
  private store = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlMs: number): void {
    this.store.set(key, { data, expiresAt: Date.now() + ttlMs });
  }

  buildKey(provider: string, location: string, dateRange: string): string {
    return `${provider}:${location}:${dateRange}`;
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}

// Singleton instance
export const apiCache = new ApiCache();
