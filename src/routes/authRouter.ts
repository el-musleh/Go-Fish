import { Router } from 'express';
import { Pool } from 'pg';
import { getUserByEmail, createUser, getUserById, updateUser } from '../repositories/userRepository';
import { getSupabaseAdmin } from '../lib/supabaseAdmin';
import { createRequireAuth } from '../middleware/auth';

export function createAuthRouter(pool: Pool): Router {
  const router = Router();
  const requireAuth = createRequireAuth(pool);

  /**
   * GET /api/auth/me
   * Return the current authenticated user's profile.
   */
  router.get('/me', requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const user = await getUserById(pool, userId);
      if (!user) {
        res.status(404).json({ error: 'user_not_found', message: 'User not found.' });
        return;
      }
      res.json(user);
    } catch (error) {
      console.error('Error fetching user profile:', error);
      res.status(500).json({ error: 'internal_error', message: 'Failed to fetch user profile.' });
    }
  });

  /**
   * PATCH /api/auth/me
   * Update the current authenticated user's profile.
   */
  router.patch('/me', requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { name } = req.body;
      const user = await updateUser(pool, userId, { name });
      if (!user) {
        res.status(404).json({ error: 'user_not_found', message: 'User not found.' });
        return;
      }
      res.json(user);
    } catch (error) {
      console.error('Error updating user profile:', error);
      res.status(500).json({ error: 'internal_error', message: 'Failed to update user profile.' });
    }
  });

  /**
   * GET /api/auth/storage-info
   * Return data storage statistics for the user.
   */
  router.get('/storage-info', requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;

      const [eventsResult, responsesResult, benchmarkResult] = await Promise.all([
        pool.query('SELECT COUNT(*) FROM event WHERE inviter_id = $1', [userId]),
        pool.query('SELECT COUNT(*) FROM response WHERE invitee_id = $1', [userId]),
        pool.query('SELECT id FROM taste_benchmark WHERE user_id = $1', [userId]),
      ]);

      res.json({
        eventsCreated: parseInt(eventsResult.rows[0].count, 10),
        responsesSubmitted: parseInt(responsesResult.rows[0].count, 10),
        hasTasteBenchmark: benchmarkResult.rows.length > 0,
      });
    } catch (error) {
      console.error('Error fetching storage info:', error);
      res.status(500).json({ error: 'internal_error', message: 'Failed to fetch storage info.' });
    }
  });

  /**
   * POST /api/auth/email
...
...
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
