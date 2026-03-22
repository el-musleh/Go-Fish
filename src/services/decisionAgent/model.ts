import { ChatOpenAI } from '@langchain/openai';

export const DEFAULT_MODEL = 'deepseek-chat';
export const FALLBACK_MODEL = 'deepseek-reasoner';

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1';

export interface OpenRouterModelConfig {
  apiKey?: string;
  model?: string;
  temperature?: number;
}

export function resolveOpenRouterApiKey(apiKey?: string): string {
  const resolved =
    apiKey ??
    process.env.DEEPSEEK_API_KEY ??
    process.env.OPENROUTER_API_KEY ??
    process.env.GOOGLE_API_KEY ??
    process.env.GEMINI_API_KEY;
  if (!resolved) {
    throw new Error(
      'DEEPSEEK_API_KEY is not configured (set it in .env)'
    );
  }
  return resolved;
}

export function resolveOpenRouterModelName(model?: string): string {
  return (
    model ??
    process.env.DEEPSEEK_MODEL ??
    process.env.OPENROUTER_MODEL ??
    DEFAULT_MODEL
  );
}

export function createChatOpenRouterModel(config: OpenRouterModelConfig = {}): ChatOpenAI {
  return new ChatOpenAI({
    apiKey: resolveOpenRouterApiKey(config.apiKey),
    model: resolveOpenRouterModelName(config.model),
    maxRetries: 0,
    temperature: config.temperature ?? 0.2,
    configuration: {
      baseURL: DEEPSEEK_BASE_URL,
    },
  });
}

export function shouldUseFallbackModel(error: unknown, modelName: string): boolean {
  if (resolveOpenRouterModelName(modelName) !== DEFAULT_MODEL) {
    return false;
  }

  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes('model') &&
    (message.includes('not found') ||
      message.includes('unsupported') ||
      message.includes('invalid') ||
      message.includes('unknown') ||
      message.includes('unavailable'))
  );
}
