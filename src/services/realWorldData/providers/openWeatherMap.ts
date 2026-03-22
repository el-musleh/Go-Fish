import { GeoLocation, DayWeather } from '../types';
import { apiCache, CACHE_TTL } from '../cache';

interface ForecastItem {
  dt: number;
  main: {
    temp: number;
    temp_min: number;
    temp_max: number;
    humidity: number;
  };
  weather: Array<{
    id: number;
    main: string;
    description: string;
  }>;
  wind: {
    speed: number;
    deg: number;
    gust?: number;
  };
  pop: number;
  rain?: { '3h': number };
  snow?: { '3h': number };
  dt_txt: string;
}

interface ForecastResponse {
  cod: string;
  list: ForecastItem[];
  city: {
    name: string;
    country: string;
  };
}

export async function fetchWeatherForecast(
  location: GeoLocation
): Promise<DayWeather[]> {
  const apiKey = process.env.OPENWEATHERMAP_API_KEY;
  if (!apiKey) {
    throw new Error('OPENWEATHERMAP_API_KEY is not configured');
  }

  const cacheKey = apiCache.buildKey(
    'openweathermap',
    `${location.latitude},${location.longitude}`,
    'forecast'
  );

  const cached = apiCache.get<DayWeather[]>(cacheKey);
  if (cached) return cached;

  const params = new URLSearchParams({
    lat: String(location.latitude),
    lon: String(location.longitude),
    appid: apiKey,
    units: 'metric',
  });

  const url = `https://api.openweathermap.org/data/2.5/forecast?${params}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `OpenWeatherMap API error: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as ForecastResponse;

  // Group 3-hour forecasts by day and aggregate
  const dayMap = new Map<string, ForecastItem[]>();
  for (const item of data.list) {
    const date = item.dt_txt.split(' ')[0]; // YYYY-MM-DD
    const existing = dayMap.get(date) ?? [];
    existing.push(item);
    dayMap.set(date, existing);
  }

  const weather: DayWeather[] = Array.from(dayMap.entries()).map(
    ([date, items]) => {
      const temps = items.map((i) => i.main.temp);
      const tempHighC = Math.round(Math.max(...temps) * 10) / 10;
      const tempLowC = Math.round(Math.min(...temps) * 10) / 10;

      // Average precipitation probability across day
      const precipProbability = Math.round(
        (items.reduce((sum, i) => sum + i.pop, 0) / items.length) * 100
      );

      // Average wind speed (m/s to km/h)
      const avgWindSpeed =
        items.reduce((sum, i) => sum + i.wind.speed, 0) / items.length;
      const windSpeedKmh = Math.round(avgWindSpeed * 3.6 * 10) / 10;

      // Pick midday forecast for description, fall back to middle entry
      const middayItem =
        items.find((i) => i.dt_txt.includes('12:00:00')) ??
        items[Math.floor(items.length / 2)];
      const description = middayItem.weather[0]?.description ?? 'unknown';

      // Outdoor-friendly: no heavy rain/snow, temp > 5C, wind < 40 km/h
      const hasHeavyPrecip = items.some(
        (i) => (i.rain?.['3h'] ?? 0) > 5 || (i.snow?.['3h'] ?? 0) > 2
      );
      const isOutdoorFriendly =
        !hasHeavyPrecip &&
        tempHighC > 5 &&
        windSpeedKmh < 40 &&
        precipProbability < 70;

      return {
        date,
        tempHighC,
        tempLowC,
        description,
        precipProbability,
        windSpeedKmh,
        isOutdoorFriendly,
      };
    }
  );

  apiCache.set(cacheKey, weather, CACHE_TTL.WEATHER);
  return weather;
}
