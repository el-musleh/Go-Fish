import { Pool } from 'pg';
import { EmailLog, EmailStatus } from '../models/EmailLog';

export async function createEmailLog(
  pool: Pool,
  data: Pick<EmailLog, 'event_id' | 'user_id'>
): Promise<EmailLog> {
  const { rows } = await pool.query(
    `INSERT INTO email_log (event_id, user_id) VALUES ($1, $2) RETURNING *`,
    [data.event_id, data.user_id]
  );
  return rows[0];
}

export async function getEmailLogById(pool: Pool, id: string): Promise<EmailLog | null> {
  const { rows } = await pool.query(`SELECT * FROM email_log WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function getEmailLogsByEventId(pool: Pool, eventId: string): Promise<EmailLog[]> {
  const { rows } = await pool.query(
    `SELECT * FROM email_log WHERE event_id = $1 ORDER BY created_at ASC`,
    [eventId]
  );
  return rows;
}

export async function updateEmailLogStatus(
  pool: Pool,
  id: string,
  status: EmailStatus
): Promise<EmailLog | null> {
  // Only increment retry_count on failure, not on success
  const { rows } = await pool.query(
    `UPDATE email_log
     SET status = $1,
         retry_count = CASE WHEN $1 = 'sent' THEN retry_count ELSE retry_count + 1 END,
         last_attempt = NOW()
     WHERE id = $2 RETURNING *`,
    [status, id]
  );
  return rows[0] ?? null;
}

export async function getPendingEmailLogs(
  pool: Pool,
  limit = 100
): Promise<EmailLog[]> {
  const { rows } = await pool.query(
    `SELECT * FROM email_log
     WHERE status = 'pending' AND retry_count < 3
     ORDER BY created_at ASC
     LIMIT $1`,
    [limit]
  );
  return rows;
}

export async function deleteEmailLog(pool: Pool, id: string): Promise<boolean> {
  const { rowCount } = await pool.query(`DELETE FROM email_log WHERE id = $1`, [id]);
  return (rowCount ?? 0) > 0;
}
