import { Pool } from 'pg';
import { Event, EventStatus, EventSuggestions } from '../models/Event';

export async function createEvent(
  pool: Pool,
  data: Pick<Event, 'inviter_id' | 'title' | 'description'> & {
    response_window_end: Date;
    location_city?: string | null;
    location_country?: string | null;
    location_lat?: number | null;
    location_lng?: number | null;
  }
): Promise<Event> {
  const { rows } = await pool.query(
    `INSERT INTO event (inviter_id, title, description, response_window_end, location_city, location_country, location_lat, location_lng)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [data.inviter_id, data.title, data.description, data.response_window_end, data.location_city ?? null, data.location_country ?? null, data.location_lat ?? null, data.location_lng ?? null]
  );
  return rows[0];
}

export async function getEventById(pool: Pool, id: string): Promise<Event | null> {
  const { rows } = await pool.query(`SELECT * FROM event WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function updateEventStatus(
  pool: Pool,
  id: string,
  status: EventStatus
): Promise<Event | null> {
  const { rows } = await pool.query(
    `UPDATE event SET status = $1 WHERE id = $2 RETURNING *`,
    [status, id]
  );
  return rows[0] ?? null;
}

export async function getEventsByInviterId(pool: Pool, inviterId: string): Promise<Event[]> {
  const { rows } = await pool.query(
    `SELECT * FROM event WHERE inviter_id = $1 ORDER BY created_at DESC`,
    [inviterId]
  );
  return rows;
}

export async function deleteEvent(pool: Pool, id: string): Promise<boolean> {
  const { rowCount } = await pool.query(`DELETE FROM event WHERE id = $1`, [id]);
  return (rowCount ?? 0) > 0;
}

export async function getEventsByIds(pool: Pool, ids: string[]): Promise<Event[]> {
  if (ids.length === 0) return [];
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
  const { rows } = await pool.query(
    `SELECT * FROM event WHERE id IN (${placeholders}) ORDER BY created_at DESC`,
    ids
  );
  return rows;
}

export async function saveEventSuggestions(
  pool: Pool,
  id: string,
  suggestions: EventSuggestions
): Promise<void> {
  await pool.query(`UPDATE event SET ai_suggestions = $1 WHERE id = $2`, [
    suggestions,
    id,
  ]);
}

export async function closeResponseWindow(pool: Pool, id: string): Promise<Event | null> {
  const { rows } = await pool.query(
    `UPDATE event SET response_window_end = NOW() WHERE id = $1 RETURNING *`,
    [id]
  );
  return rows[0] ?? null;
}

export async function archiveEvent(pool: Pool, id: string): Promise<Event | null> {
  const { rows } = await pool.query(
    `UPDATE event SET archived = TRUE WHERE id = $1 RETURNING *`,
    [id]
  );
  return rows[0] ?? null;
}
