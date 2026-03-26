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
      const hasBearer = !!(req.headers.authorization?.startsWith('Bearer '));
      console.log(`[Auth] Dev mode | ${req.method} ${req.path} | x-user-id="${userId}" | has-bearer=${hasBearer}`);

      // Basic UUID validation to prevent DB errors when legacy non-UUID strings are in localStorage
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      if (!userId || !uuidRegex.test(userId)) {
        console.warn(`[Auth] REJECTED — x-user-id missing or invalid. Tip: if the frontend has a Supabase session it must also send x-user-id (check client/src/api/client.ts).`);
        res.status(401).json({ error: 'unauthorized', message: 'Valid User ID required.' });
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
