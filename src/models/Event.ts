export type EventStatus = 'collecting' | 'generating' | 'options_ready' | 'finalized';

export interface EventSuggestions {
  venue_ideas: string[];
  estimated_cost_per_person: string;
  estimated_duration_minutes: number;
  suggested_time: string;
  suggested_day: string;
}

export interface Event {
  id: string;
  inviter_id: string;
  title: string;
  description: string;
  response_window_start: Date;
  response_window_end: Date;
  location_city: string | null;
  location_country: string | null;
  location_lat: number | null;
  location_lng: number | null;
  preferred_date: string | null;
  preferred_time: string | null;
  duration_minutes: number | null;
  status: EventStatus;
  ai_suggestions: EventSuggestions | null;
  created_at: Date;
}
