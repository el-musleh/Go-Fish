export type EventStatus = 'collecting' | 'generating' | 'options_ready' | 'finalized';

export interface Event {
  id: string;
  inviter_id: string;
  title: string;
  description: string;
  response_window_start: Date;
  response_window_end: Date;
  status: EventStatus;
  created_at: Date;
}
