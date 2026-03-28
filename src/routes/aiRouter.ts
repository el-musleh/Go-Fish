import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { ChatOpenRouter } from '@langchain/openrouter';

export function createAiRouter(_pool: Pool): Router {
  const router = Router();

  // Health check - no auth required
  router.get('/health', (_req, res) => {
    res.json({ status: 'ok', message: 'AI router is working' });
  });

  // Test endpoint - simple test without auth
  router.post('/test', (req: Request, res: Response) => {
    console.log('[AI Test] Received request body:', req.body);
    res.json({ 
      success: true, 
      message: 'Test endpoint working! API key: ' + (req.body?.apiKey ? 'provided' : 'not provided')
    });
  });

  // Real test endpoint with AI call
  router.post('/test-real', async (req: Request, res: Response) => {
    try {
      const { provider, model, apiKey } = req.body;

      console.log('[AI Test Real] Starting test with:', { 
        provider, 
        model: model ? 'set' : 'not set', 
        apiKey: apiKey ? 'provided' : 'not provided' 
      });

      if (!apiKey) {
        res.status(400).json({ success: false, message: 'No API key provided' });
        return;
      }

      if (!model) {
        res.status(400).json({ success: false, message: 'No model selected' });
        return;
      }

      const chatModel = new ChatOpenRouter({
        model: model,
        apiKey: apiKey,
        temperature: 0.1,
        maxTokens: 10,
      });

      console.log('[AI Test Real] Invoking model...');
      const response = await chatModel.invoke('Respond with just "OK" if you can read this.');
      console.log('[AI Test Real] Response received:', response.content);

      const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);

      res.json({
        success: true,
        message: `Connection successful! Response: ${content}`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[AI Test Real] Error:', message);
      
      let userMessage = message;
      if (message.includes('401') || message.includes('authentication')) {
        userMessage = 'Invalid API key.';
      } else if (message.includes('403')) {
        userMessage = 'API key does not have permission.';
      } else if (message.includes('429')) {
        userMessage = 'Rate limit exceeded.';
      } else if (message.includes('404')) {
        userMessage = 'Model not found.';
      }

      res.status(400).json({ success: false, message: userMessage });
    }
  });

  return router;
}
