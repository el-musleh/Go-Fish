import { Pool } from 'pg';
import { User } from '../models/User';

export async function createUser(
  pool: Pool,
  data: Pick<User, 'email' | 'auth_provider'> & { name?: string | null }
): Promise<User> {
  const { rows } = await pool.query(
    `INSERT INTO "user" (email, name, auth_provider) VALUES ($1, $2, $3) RETURNING *`,
    [data.email, data.name ?? null, data.auth_provider]
  );
  return rows[0];
}

export async function getUserById(pool: Pool, id: string): Promise<User | null> {
  const { rows } = await pool.query(`SELECT * FROM "user" WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function getUserByEmail(pool: Pool, email: string): Promise<User | null> {
  const { rows } = await pool.query(`SELECT * FROM "user" WHERE email = $1`, [email]);
  return rows[0] ?? null;
}

export async function updateUser(
  pool: Pool,
  id: string,
  data: Partial<Pick<User, 'name' | 'has_taste_benchmark'>>
): Promise<User | null> {
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIdx = 1;

  if (data.name !== undefined) {
    setClauses.push('name = $' + paramIdx++);
    values.push(data.name);
  }
  if (data.has_taste_benchmark !== undefined) {
    setClauses.push('has_taste_benchmark = $' + paramIdx++);
    values.push(data.has_taste_benchmark);
  }

  if (setClauses.length === 0) return getUserById(pool, id);

  values.push(id);
  const query = 'UPDATE "user" SET ' + setClauses.join(', ') + ' WHERE id = $' + paramIdx + ' RETURNING *';
  const { rows } = await pool.query(query, values);
  return rows[0] ?? null;
}

export async function deleteUser(pool: Pool, id: string): Promise<boolean> {
  const { rowCount } = await pool.query(`DELETE FROM "user" WHERE id = $1`, [id]);
  return (rowCount ?? 0) > 0;
}
