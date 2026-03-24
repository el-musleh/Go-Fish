import { Router } from 'express';
import { Pool } from 'pg';
import { getUserByEmail, createUser } from '../repositories/userRepository';
import { getSupabaseAdmin } from '../lib/supabaseAdmin';

export function createAuthRouter(pool: Pool): Router {
  const router = Router();

  /**
   * POST /api/auth/email
   * Find-or-create the backend user after Supabase auth completes.
   *
   * When Supabase is configured: verifies the JWT and extracts the email from it.
   * When Supabase is absent (dev/test): reads email from the request body.
   */
  router.post('/email', async (req, res) => {
    try {
      let email: string;
      const supabase = getSupabaseAdmin();

      if (supabase) {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
          res.status(401).json({ error: 'Authentication required.' });
          return;
        }
        const token = authHeader.slice(7);
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user?.email) {
          res.status(401).json({ error: 'Invalid or expired session.' });
          return;
        }
        email = user.email.toLowerCase();
      } else {
        // Dev/test fallback
        const bodyEmail = req.body.email;
        if (!bodyEmail || typeof bodyEmail !== 'string') {
          res.status(400).json({ error: 'Email is required.' });
          return;
        }
        if (bodyEmail.length > 254) {
          res.status(400).json({ error: 'Email address is too long.' });
          return;
        }
        email = bodyEmail.trim().toLowerCase();
      }

      let user = await getUserByEmail(pool, email);
      if (!user) {
        user = await createUser(pool, { email, auth_provider: 'email' });
      }

      res.json({ userId: user.id, email: user.email, isNew: !user.has_taste_benchmark });
    } catch (err) {
      console.error('Auth email error:', err);
      res.status(500).json({ error: 'Authentication failed.' });
    }
  });

  // Stub Google login
  router.post('/google', async (_req, res) => {
    res.status(501).json({ message: 'Google OAuth not configured. Please use email login.' });
  });

  return router;
}
