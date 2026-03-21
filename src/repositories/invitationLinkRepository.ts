import { Pool } from 'pg';
import { InvitationLink } from '../models/InvitationLink';

export async function createInvitationLink(
  pool: Pool,
  data: Pick<InvitationLink, 'event_id' | 'token'>
): Promise<InvitationLink> {
  const { rows } = await pool.query(
    `INSERT INTO invitation_link (event_id, token) VALUES ($1, $2) RETURNING *`,
    [data.event_id, data.token]
  );
  return rows[0];
}

export async function getInvitationLinkByToken(
  pool: Pool,
  token: string
): Promise<InvitationLink | null> {
  const { rows } = await pool.query(
    `SELECT * FROM invitation_link WHERE token = $1`,
    [token]
  );
  return rows[0] ?? null;
}

export async function getInvitationLinkByEventId(
  pool: Pool,
  eventId: string
): Promise<InvitationLink | null> {
  const { rows } = await pool.query(
    `SELECT * FROM invitation_link WHERE event_id = $1`,
    [eventId]
  );
  return rows[0] ?? null;
}

export async function deleteInvitationLink(pool: Pool, id: string): Promise<boolean> {
  const { rowCount } = await pool.query(`DELETE FROM invitation_link WHERE id = $1`, [id]);
  return (rowCount ?? 0) > 0;
}
