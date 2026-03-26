import { Pool } from 'pg';
import { Response } from '../models/Response';

export async function createResponse(
  pool: Pool,
  data: Pick<Response, 'event_id' | 'invitee_id' | 'available_dates'>
): Promise<Response> {
  const { rows } = await pool.query(
    `INSERT INTO response (event_id, invitee_id, available_dates)
     VALUES ($1, $2, $3) RETURNING *`,
    [data.event_id, data.invitee_id, data.available_dates]
  );
  return rows[0];
}

export async function getResponseById(pool: Pool, id: string): Promise<Response | null> {
  const { rows } = await pool.query(`SELECT * FROM response WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function getResponsesByEventId(pool: Pool, eventId: string): Promise<Response[]> {
  const { rows } = await pool.query(
    `SELECT * FROM response WHERE event_id = $1 ORDER BY created_at ASC`,
    [eventId]
  );
  return rows;
}

export async function getResponseByEventAndInvitee(
  pool: Pool,
  eventId: string,
  inviteeId: string
): Promise<Response | null> {
  const { rows } = await pool.query(
    `SELECT * FROM response WHERE event_id = $1 AND invitee_id = $2`,
    [eventId, inviteeId]
  );
  return rows[0] ?? null;
}

export async function deleteResponse(pool: Pool, id: string): Promise<boolean> {
  const { rowCount } = await pool.query(`DELETE FROM response WHERE id = $1`, [id]);
  return (rowCount ?? 0) > 0;
}

export async function getEventIdsRespondedByUser(pool: Pool, userId: string): Promise<string[]> {
  const { rows } = await pool.query(
    `SELECT DISTINCT event_id FROM response WHERE invitee_id = $1`,
    [userId]
  );
  return rows.map((r: { event_id: string }) => r.event_id);
}

/**
 * Batch-fetch responses for multiple events in a single query.
 * Returns a Map from eventId → Response[] for O(1) lookup per event.
 */
export async function getResponsesForEvents(
  pool: Pool,
  eventIds: string[]
): Promise<Map<string, Response[]>> {
  if (eventIds.length === 0) return new Map();
  const { rows } = await pool.query(
    `SELECT * FROM response WHERE event_id = ANY($1) ORDER BY event_id, created_at ASC`,
    [eventIds]
  );
  const map = new Map<string, Response[]>();
  for (const row of rows) {
    const list = map.get(row.event_id) ?? [];
    list.push(row);
    map.set(row.event_id, list);
  }
  return map;
}
