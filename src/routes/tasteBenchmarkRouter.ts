import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { requireAuth } from '../middleware/auth';
import {
  createTasteBenchmark,
  getTasteBenchmarkByUserId,
} from '../repositories/tasteBenchmarkRepository';
import { updateUser } from '../repositories/userRepository';

const REQUIRED_QUESTIONS = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10'];

export function createTasteBenchmarkRouter(pool: Pool): Router {
  const router = Router();

  router.use(requireAuth);

  /**
   * POST /api/taste-benchmark
   * Submit a taste benchmark. All 10 questions must be answered.
   */
  router.post('/', async (req: Request, res: Response) => {
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

      const benchmark = await createTasteBenchmark(pool, {
        user_id: userId,
        answers: sanitizedAnswers,
      });

      await updateUser(pool, userId, { has_taste_benchmark: true });

      res.status(201).json(benchmark);
    } catch (error) {
      console.error('Error creating taste benchmark:', error);
      res.status(500).json({ error: 'internal_error', message: 'Failed to create taste benchmark.' });
    }
  });

  /**
   * GET /api/taste-benchmark
   * Return the current user's taste benchmark.
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as string;
      const benchmark = await getTasteBenchmarkByUserId(pool, userId);

      if (!benchmark) {
        res.status(404).json({ error: 'not_found', message: 'No taste benchmark found.' });
        return;
      }

      res.json(benchmark);
    } catch (error) {
      console.error('Error fetching taste benchmark:', error);
      res.status(500).json({ error: 'internal_error', message: 'Failed to fetch taste benchmark.' });
    }
  });

  return router;
}
