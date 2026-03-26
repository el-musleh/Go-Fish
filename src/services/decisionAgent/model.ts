import { ChatOpenRouter } from "@langchain/openrouter";

export const DEFAULT_MODEL = 'deepseek-chat';
export const FALLBACK_MODEL = 'deepseek-reasoner';

export interface OpenRouterModelConfig {
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
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
      'No AI API key configured. Set OPENROUTER_API_KEY, DEEPSEEK_API_KEY, GOOGLE_API_KEY, or GEMINI_API_KEY in your environment.'
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
 * Robustly extracts the first complete JSON object from a string using
 * bracket counting. Handles models that wrap output in markdown fences or
 * add trailing commentary after the JSON.
 */
export function extractJson(text: string): string {
  const start = text.indexOf('{');
  if (start === -1) {
    throw new Error('No JSON object found in model output');
  }
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  throw new Error('Unmatched braces in model output — JSON object is incomplete');
}

export function createChatOpenRouterModel(config: OpenRouterModelConfig = {}): ChatOpenRouter {
  return new ChatOpenRouter({
    apiKey: resolveOpenRouterApiKey(config.apiKey),
    model: resolveOpenRouterModelName(config.model),
    maxRetries: 0,
    temperature: config.temperature ?? 0.2,
    maxTokens: config.maxTokens ?? 2048,
  });
}

export function shouldUseFallbackModel(error: unknown, activeModel: string): boolean {
  // Only switch to fallback when the currently active model is the default.
  // Compare directly against activeModel (not re-resolved from env) so this
  // works correctly when OPENROUTER_MODEL env var overrides the default.
  if (activeModel !== DEFAULT_MODEL) {
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
