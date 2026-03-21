import { Pool } from 'pg';
import { ActivityOption } from '../models/ActivityOption';

export async function createActivityOption(
  pool: Pool,
  data: Pick<ActivityOption, 'event_id' | 'title' | 'description' | 'suggested_date' | 'rank'>
): Promise<ActivityOption> {
  const { rows } = await pool.query(
    `INSERT INTO activity_option (event_id, title, description, suggested_date, rank)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [data.event_id, data.title, data.description, data.suggested_date, data.rank]
  );
  return rows[0];
}

export async function getActivityOptionById(
  pool: Pool,
  id: string
): Promise<ActivityOption | null> {
  const { rows } = await pool.query(`SELECT * FROM activity_option WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function getActivityOptionsByEventId(
  pool: Pool,
  eventId: string
): Promise<ActivityOption[]> {
  const { rows } = await pool.query(
    `SELECT * FROM activity_option WHERE event_id = $1 ORDER BY rank ASC`,
    [eventId]
  );
  return rows;
}

export async function markActivityOptionSelected(
  pool: Pool,
  id: string
): Promise<ActivityOption | null> {
  const { rows } = await pool.query(
    `UPDATE activity_option SET is_selected = TRUE WHERE id = $1 RETURNING *`,
    [id]
  );
  return rows[0] ?? null;
}

export async function deleteActivityOption(pool: Pool, id: string): Promise<boolean> {
  const { rowCount } = await pool.query(`DELETE FROM activity_option WHERE id = $1`, [id]);
  return (rowCount ?? 0) > 0;
}
