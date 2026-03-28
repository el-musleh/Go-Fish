import { Pool } from 'pg';

export interface GenerationLog {
  id: string;
  event_id: string;
  status: 'started' | 'success' | 'failed';
  model_used: string | null;
  provider_used: string | null;
  attempt_number: number;
  real_world_ms: number | null;
  agent_ms: number | null;
  duration_ms: number | null;
  error_message: string | null;
  started_at: string;
  finished_at: string | null;
}

export async function insertGenerationLog(
  pool: Pool,
  data: Pick<GenerationLog, 'event_id' | 'model_used' | 'provider_used' | 'attempt_number'>
): Promise<GenerationLog> {
  const { rows } = await pool.query(
    `INSERT INTO generation_log (event_id, model_used, provider_used, attempt_number)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [data.event_id, data.model_used ?? null, data.provider_used ?? null, data.attempt_number]
  );
  return rows[0];
}

export async function finalizeGenerationLog(
  pool: Pool,
  id: string,
  data: Pick<GenerationLog, 'status' | 'real_world_ms' | 'agent_ms' | 'duration_ms' | 'error_message'>
): Promise<void> {
  await pool.query(
    `UPDATE generation_log
     SET status        = $1,
         real_world_ms = $2,
         agent_ms      = $3,
         duration_ms   = $4,
         error_message = $5,
         finished_at   = NOW()
     WHERE id = $6`,
    [data.status, data.real_world_ms ?? null, data.agent_ms ?? null, data.duration_ms ?? null, data.error_message ?? null, id]
  );
}

export async function getGenerationLogsByEventId(
  pool: Pool,
  eventId: string
): Promise<GenerationLog[]> {
  const { rows } = await pool.query(
    `SELECT * FROM generation_log WHERE event_id = $1 ORDER BY started_at DESC`,
    [eventId]
  );
  return rows;
}
