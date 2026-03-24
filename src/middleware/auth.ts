import { Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { getSupabaseAdmin } from '../lib/supabaseAdmin';
import { getUserByEmail } from '../repositories/userRepository';

/**
 * Returns an auth middleware that verifies the Supabase JWT on every request.
 *
 * When SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set (production):
 *   - Expects `Authorization: Bearer <supabase-access-token>` header
 *   - Verifies the token via the Supabase admin client
 *   - Looks up the backend user by the verified email, sets req.userId
 *
 * When those env vars are absent (local dev / CI):
 *   - Falls back to trusting the `x-user-id` header (stub behaviour)
 */
export function createRequireAuth(pool: Pool) {
  return async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    const supabase = getSupabaseAdmin();

    if (!supabase) {
      // Dev/test fallback — no Supabase configured
      const userId = req.headers['x-user-id'] as string | undefined;
      if (!userId) {
        res.status(401).json({ error: 'unauthorized', message: 'Authentication required.' });
        return;
      }
      (req as any).userId = userId;
      next();
      return;
    }

    // Verify Supabase JWT
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'unauthorized', message: 'Authentication required.' });
      return;
    }

    const token = authHeader.slice(7);
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user?.email) {
      res.status(401).json({ error: 'unauthorized', message: 'Invalid or expired session.' });
      return;
    }

    const dbUser = await getUserByEmail(pool, user.email.toLowerCase());
    if (!dbUser) {
      res.status(401).json({ error: 'unauthorized', message: 'User not found. Please sign in again.' });
      return;
    }

    (req as any).userId = dbUser.id;
    next();
  };
}
