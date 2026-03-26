import { Pool } from 'pg';

export interface UserPreferences {
  user_id: string;
  email_on_event_confirmed: boolean;
  email_on_new_rsvp: boolean;
  email_on_options_ready: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface UpdateUserPreferencesData {
  email_on_event_confirmed?: boolean;
  email_on_new_rsvp?: boolean;
  email_on_options_ready?: boolean;
}

/**
 * Get user preferences by user ID
 */
export async function getUserPreferences(
  pool: Pool,
  userId: string
): Promise<UserPreferences | null> {
  const result = await pool.query<UserPreferences>(
    `SELECT * FROM user_preferences WHERE user_id = $1`,
    [userId]
  );
  return result.rows[0] ?? null;
}

/**
 * Create default user preferences for a new user
 */
export async function createDefaultUserPreferences(
  pool: Pool,
  userId: string
): Promise<UserPreferences> {
  const result = await pool.query<UserPreferences>(
    `INSERT INTO user_preferences (user_id)
     VALUES ($1)
     RETURNING *`,
    [userId]
  );
  return result.rows[0];
}

/**
 * Get or create user preferences
 */
export async function getOrCreateUserPreferences(
  pool: Pool,
  userId: string
): Promise<UserPreferences> {
  const existing = await getUserPreferences(pool, userId);
  if (existing) return existing;
  return createDefaultUserPreferences(pool, userId);
}

/**
 * Update user preferences
 */
export async function updateUserPreferences(
  pool: Pool,
  userId: string,
  data: UpdateUserPreferencesData
): Promise<UserPreferences | null> {
  const updates: string[] = [];
  const values: (boolean | string)[] = [];
  let paramIndex = 1;

  if (data.email_on_event_confirmed !== undefined) {
    updates.push(`email_on_event_confirmed = $${paramIndex++}`);
    values.push(data.email_on_event_confirmed);
  }
  if (data.email_on_new_rsvp !== undefined) {
    updates.push(`email_on_new_rsvp = $${paramIndex++}`);
    values.push(data.email_on_new_rsvp);
  }
  if (data.email_on_options_ready !== undefined) {
    updates.push(`email_on_options_ready = $${paramIndex++}`);
    values.push(data.email_on_options_ready);
  }

  if (updates.length === 0) {
    return getUserPreferences(pool, userId);
  }

  values.push(userId);
  const result = await pool.query<UserPreferences>(
    `UPDATE user_preferences 
     SET ${updates.join(', ')}
     WHERE user_id = $${paramIndex}
     RETURNING *`,
    values
  );
  return result.rows[0] ?? null;
}

/**
 * Check if user should receive email for event confirmation
 */
export async function shouldSendEventConfirmedEmail(
  pool: Pool,
  userId: string
): Promise<boolean> {
  const prefs = await getUserPreferences(pool, userId);
  // Default to true if no preferences exist
  return prefs?.email_on_event_confirmed ?? true;
}

/**
 * Check if user should receive email for new RSVP
 */
export async function shouldSendNewRsvpEmail(
  pool: Pool,
  userId: string
): Promise<boolean> {
  const prefs = await getUserPreferences(pool, userId);
  return prefs?.email_on_new_rsvp ?? false;
}

/**
 * Check if user should receive email when options are ready
 */
export async function shouldSendOptionsReadyEmail(
  pool: Pool,
  userId: string
): Promise<boolean> {
  const prefs = await getUserPreferences(pool, userId);
  return prefs?.email_on_options_ready ?? false;
}
