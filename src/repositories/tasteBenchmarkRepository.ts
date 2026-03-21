import { Pool } from 'pg';
import { TasteBenchmark } from '../models/TasteBenchmark';

export async function createTasteBenchmark(
  pool: Pool,
  data: Pick<TasteBenchmark, 'user_id' | 'answers'>
): Promise<TasteBenchmark> {
  const { rows } = await pool.query(
    `INSERT INTO taste_benchmark (user_id, answers) VALUES ($1, $2) RETURNING *`,
    [data.user_id, JSON.stringify(data.answers)]
  );
  return rows[0];
}

export async function getTasteBenchmarkByUserId(
  pool: Pool,
  userId: string
): Promise<TasteBenchmark | null> {
  const { rows } = await pool.query(
    `SELECT * FROM taste_benchmark WHERE user_id = $1`,
    [userId]
  );
  return rows[0] ?? null;
}

export async function deleteTasteBenchmark(pool: Pool, id: string): Promise<boolean> {
  const { rowCount } = await pool.query(`DELETE FROM taste_benchmark WHERE id = $1`, [id]);
  return (rowCount ?? 0) > 0;
}
