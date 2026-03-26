import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { createRequireAuth } from '../middleware/auth';
import {
  createTasteBenchmark,
  getTasteBenchmarkByUserId,
} from '../repositories/tasteBenchmarkRepository';
import { updateUser } from '../repositories/userRepository';

const REQUIRED_QUESTIONS = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10'];

export function createTasteBenchmarkRouter(pool: Pool): Router {
  const router = Router();
  const requireAuth = createRequireAuth(pool);

  router.use(requireAuth);

  /**
   * POST /api/taste-benchmark
   * Submit a taste benchmark. All 10 questions must be answered.
   */
  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      const { answers } = req.body;

      if (!answers || typeof answers !== 'object') {
        res.status(400).json({
          error: 'incomplete_benchmark',
          missingQuestions: REQUIRED_QUESTIONS,
        });
        return;
      }

      const missingQuestions = REQUIRED_QUESTIONS.filter(
        (q) => !answers[q] || !Array.isArray(answers[q]) || answers[q].length === 0
      );

      if (missingQuestions.length > 0) {
        res.status(400).json({
          error: 'incomplete_benchmark',
          missingQuestions,
        });
        return;
      }

      // Only keep the 10 required question keys
      const sanitizedAnswers: Record<string, string[]> = {};
      for (const q of REQUIRED_QUESTIONS) {
        sanitizedAnswers[q] = answers[q];
      }

      // Create benchmark and update user flag atomically
      const client = await pool.connect();
      let benchmark;
      try {
        await client.query('BEGIN');
        const { rows } = await client.query(
          `INSERT INTO taste_benchmark (user_id, answers) VALUES ($1, $2) RETURNING *`,
          [userId, sanitizedAnswers]
        );
        benchmark = rows[0];
        await client.query(
          `UPDATE "user" SET has_taste_benchmark = TRUE WHERE id = $1`,
          [userId]
        );
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }

      res.status(201).json(benchmark);
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/taste-benchmark
   * Return the current user's taste benchmark.
   */
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      const benchmark = await getTasteBenchmarkByUserId(pool, userId);

      if (!benchmark) {
        res.status(404).json({ error: 'not_found', message: 'No taste benchmark found.' });
        return;
      }

      res.json(benchmark);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
