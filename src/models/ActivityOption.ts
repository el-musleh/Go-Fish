export interface ActivityOption {
  id: string;
  event_id: string;
  title: string;
  description: string;
  suggested_date: string;
  suggested_time: string | null;
  rank: number;
  is_selected: boolean;
  created_at: Date;
}
