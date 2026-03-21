import { Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { getUserById } from '../repositories/userRepository';

/**
 * Middleware that gates access to event response forms.
 * Requires the user to have completed their Taste Benchmark.
 * Must be used after requireAuth (expects req.userId to be set).
 */
export function tasteBenchmarkGate(pool: Pool) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = (req as any).userId as string | undefined;
    if (!userId) {
      res.status(401).json({ error: 'unauthorized', message: 'Authentication required.' });
      return;
    }

    try {
      const user = await getUserById(pool, userId);
      if (!user) {
        res.status(401).json({ error: 'unauthorized', message: 'User not found.' });
        return;
      }

      if (!user.has_taste_benchmark) {
        res.status(403).json({
          error: 'benchmark_required',
          message: 'Please complete your Taste Benchmark before accessing event responses.',
          redirect: '/api/taste-benchmark',
        });
        return;
      }

      next();
    } catch {
      res.status(500).json({ error: 'internal', message: 'An unexpected error occurred.' });
    }
  };
}
