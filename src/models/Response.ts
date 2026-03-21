export interface DateTimeWindow {
  date: string;       // "YYYY-MM-DD"
  start_time: string; // "HH:MM"
  end_time: string;   // "HH:MM"
}

export interface Response {
  id: string;
  event_id: string;
  invitee_id: string;
  available_dates: DateTimeWindow[];
  created_at: Date;
}
