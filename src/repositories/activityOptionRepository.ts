import { Pool, PoolClient } from 'pg';
import { ActivityOption } from '../models/ActivityOption';

export async function createActivityOption(
  pool: Pool,
  data: Pick<ActivityOption, 'event_id' | 'title' | 'description' | 'suggested_date' | 'suggested_time' | 'rank'> & {
    source_url?: string | null;
    venue_name?: string | null;
    price_range?: string | null;
    weather_note?: string | null;
    image_url?: string | null;
  }
): Promise<ActivityOption> {
  const { rows } = await pool.query(
    `INSERT INTO activity_option (event_id, title, description, suggested_date, suggested_time, rank, source_url, venue_name, price_range, weather_note, image_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
    [data.event_id, data.title, data.description, data.suggested_date, data.suggested_time, data.rank, data.source_url ?? null, data.venue_name ?? null, data.price_range ?? null, data.weather_note ?? null, data.image_url ?? null]
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

/**
 * Atomically selects one activity option for an event within a caller-managed
 * transaction. Clears all other options' is_selected flags first to prevent
 * multiple selected options on the same event.
 *
 * @param client - A checked-out PoolClient with an open transaction
 */
export async function selectActivityOptionTx(
  client: PoolClient,
  eventId: string,
  optionId: string
): Promise<ActivityOption | null> {
  // Clear any previously selected option for this event
  await client.query(
    `UPDATE activity_option SET is_selected = FALSE WHERE event_id = $1`,
    [eventId]
  );
  const { rows } = await client.query(
    `UPDATE activity_option SET is_selected = TRUE WHERE id = $1 AND event_id = $2 RETURNING *`,
    [optionId, eventId]
  );
  return rows[0] ?? null;
}

/**
 * Batch-fetch activity options for multiple events in a single query.
 * Returns a Map from eventId → ActivityOption[] for O(1) lookup per event.
 */
export async function getActivityOptionsForEvents(
  pool: Pool,
  eventIds: string[]
): Promise<Map<string, ActivityOption[]>> {
  if (eventIds.length === 0) return new Map();
  const { rows } = await pool.query(
    `SELECT * FROM activity_option WHERE event_id = ANY($1) ORDER BY event_id, rank ASC`,
    [eventIds]
  );
  const map = new Map<string, ActivityOption[]>();
  for (const row of rows) {
    const list = map.get(row.event_id) ?? [];
    list.push(row);
    map.set(row.event_id, list);
  }
  return map;
}

export async function deleteActivityOption(pool: Pool, id: string): Promise<boolean> {
  const { rowCount } = await pool.query(`DELETE FROM activity_option WHERE id = $1`, [id]);
  return (rowCount ?? 0) > 0;
}
