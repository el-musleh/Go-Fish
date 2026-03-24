import { ChatOpenRouter } from "@langchain/openrouter";

export const DEFAULT_MODEL = 'deepseek-chat';
export const FALLBACK_MODEL = 'deepseek-reasoner';

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

/**
 * Robustly extracts the first JSON object from a string.
 * Handles cases where the model might include markdown fences or extra text.
 */
export function extractJson(text: string): string {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error('No JSON object found in text');
  }
  return text.substring(start, end + 1);
}

export function createChatOpenRouterModel(config: OpenRouterModelConfig = {}): ChatOpenRouter {
  return new ChatOpenRouter({
    apiKey: resolveOpenRouterApiKey(config.apiKey),
    model: resolveOpenRouterModelName(config.model),
    maxRetries: 0,
    temperature: config.temperature ?? 0.2,
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
