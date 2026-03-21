export type EventStatus = 'collecting' | 'generating' | 'options_ready' | 'finalized';

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
  status: EventStatus;
  created_at: Date;
}
