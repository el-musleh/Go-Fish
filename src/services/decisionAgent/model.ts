import { ChatOpenRouter } from '@langchain/openrouter';

export const DEFAULT_OPENROUTER_MODEL = 'google/gemini-3-flash-preview';
export const FALLBACK_OPENROUTER_MODEL = 'google/gemini-2.5-flash';

const LEGACY_MODEL_ALIASES: Record<string, string> = {
  'gemini-3-flash-preview': DEFAULT_OPENROUTER_MODEL,
  'gemini-2.5-flash': FALLBACK_OPENROUTER_MODEL,
};

export interface OpenRouterModelConfig {
  apiKey?: string;
  model?: string;
  temperature?: number;
}

function normalizeOpenRouterModelName(modelName: string): string {
  return LEGACY_MODEL_ALIASES[modelName] ?? modelName;
}

export function resolveOpenRouterApiKey(apiKey?: string): string {
  const resolved =
    apiKey ??
    process.env.OPENROUTER_API_KEY ??
    process.env.GOOGLE_API_KEY ??
    process.env.GEMINI_API_KEY;
  if (!resolved) {
    throw new Error(
      'OPENROUTER_API_KEY is not configured (legacy GOOGLE_API_KEY/GEMINI_API_KEY fallback is still supported)'
    );
  }
  return resolved;
}

export function resolveOpenRouterModelName(model?: string): string {
  const resolved =
    model ??
    process.env.OPENROUTER_MODEL ??
    process.env.GOOGLE_MODEL ??
    DEFAULT_OPENROUTER_MODEL;

  return normalizeOpenRouterModelName(resolved);
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
  if (resolveOpenRouterModelName(modelName) !== DEFAULT_OPENROUTER_MODEL) {
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
