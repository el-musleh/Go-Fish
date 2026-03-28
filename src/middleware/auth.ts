import { Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { getSupabaseAdmin } from '../lib/supabaseAdmin';
import { getUserByEmail } from '../repositories/userRepository';

// In-memory cache: email → { userId, exp }
const userIdCache = new Map<string, { userId: string; exp: number }>();
const USER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// JWKS client — created once, caches keys internally
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks(): ReturnType<typeof createRemoteJWKSet> | null {
  const supabaseUrl = process.env.SUPABASE_URL;
  if (!supabaseUrl) return null;
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`));
  }
  return jwks;
}

/**
 * Returns an auth middleware that verifies the Supabase JWT on every request.
 *
 * When SUPABASE_URL is set (production):
 *   - Expects `Authorization: Bearer <supabase-access-token>` header
 *   - Verifies the token locally via JWKS (supports ECC P-256 / ES256)
 *   - email→userId results are cached for 5 minutes to reduce DB hits
 *   - Falls back to supabase.auth.getUser() if JWKS is unavailable
 *
 * When SUPABASE_URL is absent (local dev / CI):
 *   - Trusts the `x-user-id` header (stub behaviour)
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
    let email: string | undefined;

    const jwksClient = getJwks();
    if (jwksClient) {
      // Local JWKS verification — no Supabase network call, supports ECC P-256 (ES256)
      try {
        const { payload } = await jwtVerify(token, jwksClient);
        email = (payload.email as string | undefined)?.toLowerCase();
      } catch {
        res.status(401).json({ error: 'unauthorized', message: 'Invalid or expired session.' });
        return;
      }
    } else {
      // Fallback: verify via Supabase network call when SUPABASE_URL is not configured
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user?.email) {
        res.status(401).json({ error: 'unauthorized', message: 'Invalid or expired session.' });
        return;
      }
      email = user.email.toLowerCase();
    }

    if (!email) {
      res.status(401).json({ error: 'unauthorized', message: 'Invalid token: missing email.' });
      return;
    }

    // Check email→userId cache before hitting the DB
    const cached = userIdCache.get(email);
    if (cached && cached.exp > Date.now()) {
      (req as any).userId = cached.userId;
      next();
      return;
    }

    const dbUser = await getUserByEmail(pool, email);
    if (!dbUser) {
      res.status(401).json({ error: 'unauthorized', message: 'User not found. Please sign in again.' });
      return;
    }

    userIdCache.set(email, { userId: dbUser.id, exp: Date.now() + USER_CACHE_TTL });
    (req as any).userId = dbUser.id;
    next();
  };
}
