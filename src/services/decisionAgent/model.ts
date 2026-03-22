import { ChatGoogle } from '@langchain/google';

export const DEFAULT_GOOGLE_MODEL = 'gemini-3-flash-preview';
export const FALLBACK_GOOGLE_MODEL = 'gemini-2.5-flash';

export interface GoogleModelConfig {
  apiKey?: string;
  model?: string;
  temperature?: number;
}

export function resolveGoogleApiKey(apiKey?: string): string {
  const resolved = apiKey ?? process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!resolved) {
    throw new Error('GOOGLE_API_KEY or GEMINI_API_KEY is not configured');
  }
  return resolved;
}

export function resolveGoogleModelName(model?: string): string {
  return model ?? process.env.GOOGLE_MODEL ?? DEFAULT_GOOGLE_MODEL;
}

export function createChatGoogleModel(config: GoogleModelConfig = {}): ChatGoogle {
  return new ChatGoogle({
    apiKey: resolveGoogleApiKey(config.apiKey),
    model: resolveGoogleModelName(config.model),
    maxRetries: 0,
    temperature: config.temperature ?? 0.2,
  });
}

export function shouldUseFallbackModel(error: unknown, modelName: string): boolean {
  if (modelName !== DEFAULT_GOOGLE_MODEL) {
    return false;
  }

  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes('model') &&
    (message.includes('not found') ||
      message.includes('unsupported') ||
      message.includes('invalid') ||
      message.includes('unknown'))
  );
}
