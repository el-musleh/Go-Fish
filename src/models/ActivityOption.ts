export interface ActivityOption {
  id: string;
  event_id: string;
  title: string;
  description: string;
  suggested_date: string;
  suggested_time: string | null;
  rank: number;
  is_selected: boolean;
  source_url: string | null;
  venue_name: string | null;
  price_range: string | null;
  weather_note: string | null;
  image_url: string | null;
  created_at: Date;
}
