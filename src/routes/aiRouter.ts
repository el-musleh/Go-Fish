import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { createChatOpenRouterModel } from '../services/decisionAgent/model';

export function createAiRouter(_pool: Pool): Router {
  const router = Router();

  // Health check - no auth required
  router.get('/health', (_req, res) => {
    res.json({ status: 'ok', message: 'AI router is working' });
  });

  // Real test endpoint — verifies the API key and model work with the selected provider
  router.post('/test-real', async (req: Request, res: Response) => {
    try {
      const { provider, model, apiKey } = req.body;

      console.log('[AI Test] Starting test with:', {
        provider: provider ?? 'not set',
        model: model ? 'set' : 'not set',
        apiKey: apiKey ? 'provided' : 'not provided',
      });

      if (!apiKey) {
        res.status(400).json({ success: false, message: 'No API key provided' });
        return;
      }

      if (!model) {
        res.status(400).json({ success: false, message: 'No model selected' });
        return;
      }

      const chatModel = createChatOpenRouterModel({
        apiKey,
        model,
        provider,
        temperature: 0.1,
        maxTokens: 10,
      });

      console.log('[AI Test] Invoking model...');
      const response = await chatModel.invoke('Respond with just "OK" if you can read this.');
      console.log('[AI Test] Response received.');

      const content =
        typeof response.content === 'string'
          ? response.content
          : JSON.stringify(response.content);

      res.json({
        success: true,
        message: `Connection successful! Response: ${content}`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[AI Test] Error:', message);

      let userMessage = message;
      if (message.includes('401') || message.includes('authentication') || message.includes('Authentication') || message.includes('Unauthorized')) {
        userMessage = 'Invalid API key or authentication failed.';
      } else if (message.includes('403')) {
        userMessage = 'API key does not have permission for this model.';
      } else if (message.includes('429')) {
        userMessage = 'Rate limit exceeded. Try again later.';
      } else if (message.includes('404') || message.includes('not found') || message.includes('model')) {
        userMessage = `Model not found: "${req.body?.model}". Check the model ID.`;
      }

      res.status(400).json({ success: false, message: userMessage });
    }
  });

  return router;
}
