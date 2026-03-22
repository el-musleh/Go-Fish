export interface GeoLocation {
  latitude: number;
  longitude: number;
  city: string;
  country: string;
}

export interface NormalizedEvent {
  source: 'ticketmaster';
  sourceId: string;
  title: string;
  description: string;
  category: string;
  date: string;             // YYYY-MM-DD
  startTime: string | null; // HH:MM
  endTime: string | null;
  venueName: string | null;
  venueAddress: string | null;
  priceRange: string | null;
  url: string | null;
  imageUrl: string | null;
}

export interface NormalizedVenue {
  source: 'google_places' | 'foursquare';
  sourceId: string;
  name: string;
  category: string;
  address: string;
  rating: number | null;
  priceLevel: number | null; // 1-4
  url: string | null;
  photoUrl: string | null;
}

export interface DayWeather {
  date: string;              // YYYY-MM-DD
  tempHighC: number;
  tempLowC: number;
  description: string;
  precipProbability: number; // 0-100
  windSpeedKmh: number;
  isOutdoorFriendly: boolean;
}

export interface RealWorldContext {
  events: NormalizedEvent[];
  venues: NormalizedVenue[];
  weather: DayWeather[];
  location: GeoLocation;
  fetchedAt: Date;
}
