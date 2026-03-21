import { Router } from 'express';
import { Pool } from 'pg';
import { getUserByEmail, createUser } from '../repositories/userRepository';

export function createAuthRouter(pool: Pool): Router {
  const router = Router();

  // Stub email login: find or create user by email, return user id
  router.post('/email', async (req, res) => {
    try {
      const { email } = req.body;
      if (!email || typeof email !== 'string') {
        res.status(400).json({ error: 'Email is required.' });
        return;
      }

      let user = await getUserByEmail(pool, email.trim().toLowerCase());
      if (!user) {
        user = await createUser(pool, {
          email: email.trim().toLowerCase(),
          auth_provider: 'email',
        });
      }

      res.json({ userId: user.id, email: user.email, isNew: !user.has_taste_benchmark });
    } catch (err) {
      console.error('Auth email error:', err);
      res.status(500).json({ error: 'Authentication failed.' });
    }
  });

  // Stub Google login: just returns a message (no real OAuth)
  router.post('/google', async (_req, res) => {
    res.status(501).json({ message: 'Google OAuth not configured. Please use email login.' });
  });

  return router;
}
