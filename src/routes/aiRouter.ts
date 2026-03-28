import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { createRequireAuth } from '../middleware/auth';
import { ChatOpenRouter } from '@langchain/openrouter';

export function createAiRouter(pool: Pool): Router {
  const router = Router();
  const requireAuth = createRequireAuth(pool);

  router.use(requireAuth);

  /**
   * POST /api/ai/test
   * Test AI connection with provided settings
   */
  router.post('/test', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { provider, model, apiKey } = req.body;

      if (!apiKey) {
        res.status(400).json({
          success: false,
          message: 'No API key provided',
        });
        return;
      }

      if (!model) {
        res.status(400).json({
          success: false,
          message: 'No model selected',
        });
        return;
      }

      // Create a minimal chat model for testing
      const chatModel = new ChatOpenRouter({
        model: model,
        apiKey: apiKey,
        temperature: 0.1,
        maxTokens: 10,
      });

      // Make a minimal call to test the connection
      const response = await chatModel.invoke('Respond with just "OK" if you can read this. Do not say anything else.');

      const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);

      // Check if we got a valid response
      if (content.toLowerCase().includes('ok')) {
        res.json({
          success: true,
          message: `Connection successful! Model "${model}" responded correctly.`,
        });
      } else {
        res.json({
          success: true,
          message: `Connection working, but response was unexpected: ${content.substring(0, 100)}`,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      
      // Provide helpful error messages based on common issues
      let userMessage = message;
      if (message.includes('401') || message.includes('authentication')) {
        userMessage = 'Invalid API key. Please check your API key and try again.';
      } else if (message.includes('403') || message.includes('forbidden')) {
        userMessage = 'API key does not have permission. Please check your API key settings.';
      } else if (message.includes('429') || message.includes('rate limit')) {
        userMessage = 'Rate limit exceeded. Please wait a moment and try again.';
      } else if (message.includes('404') || message.includes('not found')) {
        userMessage = 'Model not found. Please select a different model.';
      } else if (message.includes('network') || message.includes('fetch')) {
        userMessage = 'Network error. Please check your internet connection.';
      }

      res.status(400).json({
        success: false,
        message: userMessage,
      });
    }
  });

  return router;
}
