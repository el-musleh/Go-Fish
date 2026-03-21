export type EmailStatus = 'pending' | 'sent' | 'failed';

export interface EmailLog {
  id: string;
  event_id: string;
  user_id: string;
  status: EmailStatus;
  retry_count: number;
  last_attempt: Date | null;
  created_at: Date;
}
