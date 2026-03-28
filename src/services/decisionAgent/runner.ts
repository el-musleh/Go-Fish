import { BaseMessage, HumanMessage } from '@langchain/core/messages';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import type { Serialized } from '@langchain/core/load/serializable';
import type { LLMResult } from '@langchain/core/outputs';
import { CandidateRef, OverlapSlot, AgentRuntimeState, createAgentTools } from './tools';
import { createChatOpenRouterModel, extractJson } from './model';
import { FinalizedOptions, finalizedOptionsSchema } from './schemas';
import { createAgentPrompt, buildAgentUserPrompt, buildFinalizerPrompt } from './prompt';

/**
 * LangChain callback handler that logs every agent step to stdout.
 * These lines are picked up by the ⚡ GEN highlight in start.sh.
 */
class GenerationLogger extends BaseCallbackHandler {
  name = 'GenerationLogger';
  private stepCount = 0;

  handleChatModelStart(
    _llm: Serialized,
    messages: BaseMessage[][],
    _runId: string
  ): void {
    this.stepCount++;
    const msgCount = messages.reduce((n, m) => n + m.length, 0);
    console.log(`[AGENT step ${this.stepCount}] LLM call — ${msgCount} message(s) in context`);
  }

  handleLLMEnd(output: LLMResult, _runId: string): void {
    const gen = output.generations[0]?.[0];
    const text = (gen as unknown as { text?: string })?.text ?? '';
    const usage = (output.llmOutput as Record<string, unknown> | undefined)?.tokenUsage as
      | { promptTokens?: number; completionTokens?: number }
      | undefined;
    const tokenInfo = usage
      ? ` | in: ${usage.promptTokens ?? '?'} out: ${usage.completionTokens ?? '?'} tokens`
      : '';
    console.log(`[AGENT] LLM done — ${text.length} chars${tokenInfo}`);
  }

  handleToolStart(tool: Serialized, input: string, _runId: string): void {
    const name =
      (tool as unknown as { name?: string }).name ??
      (Array.isArray(tool.id) ? tool.id.slice(-1)[0] : undefined) ??
      'unknown';
    const preview = input.length > 160 ? input.slice(0, 160) + '…' : input;
    console.log(`[AGENT] → tool: ${name} | ${preview}`);
  }

  handleToolEnd(output: unknown, _runId: string): void {
    const text = String(output);
    const preview = text.length > 160 ? text.slice(0, 160) + '…' : text;
    console.log(`[AGENT] ← result: ${preview}`);
  }
}

export interface GeneratedOption {
  title: string;
  description: string;
  suggested_date: string;
  suggested_time: string;
  rank: number;
  source_url?: string | null;
  venue_name?: string | null;
  price_range?: string | null;
  weather_note?: string | null;
  image_url?: string | null;
}

function formatMessageContent(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') {
          return item;
        }
        if (item && typeof item === 'object' && 'text' in item) {
          return String((item as { text: unknown }).text);
        }
        return JSON.stringify(item);
      })
      .join('\n');
  }
  if (content === undefined || content === null) {
    return '';
  }
  return JSON.stringify(content);
}

function extractAgentShortlist(messages: BaseMessage[]): string {
  const assistantMessage = [...messages]
    .reverse()
    .find((message) => message.constructor.name === 'AIMessage');

  if (!assistantMessage) {
    throw new Error('Agent did not produce an assistant response');
  }

  return formatMessageContent(assistantMessage.content).trim();
}

function findOverlapSlot(
  overlaps: OverlapSlot[],
  date: string
): OverlapSlot | undefined {
  return overlaps.find((slot) => slot.date === date);
}

function isTimeWithinOverlap(slot: OverlapSlot, suggestedTime: string): boolean {
  return slot.windows.some(
    (window) => suggestedTime >= window.start_time && suggestedTime < window.end_time
  );
}

function buildDefaultWeatherNote(
  date: string,
  runtime: AgentRuntimeState
): string | null {
  const eventWeather = runtime.eventCandidates.find(
    (candidate) => candidate.suggested_date === date && candidate.weather_note
  );
  return eventWeather?.weather_note ?? null;
}

function getCandidateBySourceId(
  sourceKind: 'event' | 'venue' | 'custom',
  sourceId: string | null,
  runtime: AgentRuntimeState
): CandidateRef | null {
  if (sourceKind === 'custom') {
    return null;
  }
  if (!sourceId) {
    throw new Error(`source_id is required for source_kind "${sourceKind}"`);
  }

  const candidates =
    sourceKind === 'event' ? runtime.eventCandidates : runtime.venueCandidates;
  const candidate =
    candidates.find((entry) => entry.source_id === sourceId) ?? null;

  if (!candidate) {
    throw new Error(`Unknown ${sourceKind} source_id "${sourceId}"`);
  }

  return candidate;
}

export function validateAndHydrateOptions(
  finalized: FinalizedOptions,
  runtime: AgentRuntimeState
): GeneratedOption[] {
  const sortedByRank = [...finalized.options].sort((left, right) => left.rank - right.rank);
  const ranks = sortedByRank.map((option) => option.rank);
  if (ranks[0] !== 1 || ranks[1] !== 2 || ranks[2] !== 3) {
    throw new Error('Structured output must contain distinct ranks 1, 2, and 3');
  }

  return sortedByRank.map((option) => {
    const overlap = findOverlapSlot(runtime.overlaps, option.suggested_date);
    if (!overlap) {
      throw new Error(`No valid overlap exists for date ${option.suggested_date}`);
    }
    if (!isTimeWithinOverlap(overlap, option.suggested_time)) {
      throw new Error(
        `Suggested time ${option.suggested_time} is outside the valid overlap for ${option.suggested_date}`
      );
    }

    const candidate = getCandidateBySourceId(option.source_kind, option.source_id, runtime);
    if (option.source_kind === 'event' && candidate) {
      if (candidate.suggested_date && candidate.suggested_date !== option.suggested_date) {
        throw new Error(
          `Event source ${candidate.source_id} is fixed to ${candidate.suggested_date}, not ${option.suggested_date}`
        );
      }
      if (candidate.suggested_time && candidate.suggested_time !== option.suggested_time) {
        throw new Error(
          `Event source ${candidate.source_id} is fixed to ${candidate.suggested_time}, not ${option.suggested_time}`
        );
      }
    }

    return {
      title: option.title,
      description: option.description,
      suggested_date: option.suggested_date,
      suggested_time: option.suggested_time,
      rank: option.rank,
      source_url: candidate?.source_url ?? null,
      venue_name:
        option.source_kind === 'custom'
          ? null
          : candidate?.venue_name ?? null,
      price_range: candidate?.price_range ?? null,
      weather_note:
        option.weather_note ?? candidate?.weather_note ?? buildDefaultWeatherNote(option.suggested_date, runtime),
      image_url: candidate?.image_url ?? null,
    };
  });
}

export async function runPlanningAgent(
  runtime: AgentRuntimeState,
  apiKey?: string,
  modelName?: string,
  provider?: string
): Promise<GeneratedOption[]> {
  if (runtime.overlaps.length === 0) {
    throw new Error('No valid overlapping time windows are available');
  }

  const AGENT_TIMEOUT_MS = 60_000;
  const logger = new GenerationLogger();

  console.log(`[GEN] Planning agent starting — model: ${modelName ?? 'default'}, provider: ${provider ?? 'openrouter'}`);
  console.log(`[GEN] Runtime: ${runtime.overlaps.length} overlap slot(s), ${runtime.eventCandidates.length} event candidate(s), ${runtime.venueCandidates.length} venue candidate(s)`);

  const agentApp = createReactAgent({
    llm: createChatOpenRouterModel({ apiKey, model: modelName, temperature: 0.2, provider }),
    tools: [...createAgentTools(runtime)],
    messageModifier: createAgentPrompt(runtime),
  });

  // Abort the agent if it runs longer than AGENT_TIMEOUT_MS
  const agentController = new AbortController();
  const agentTimer = setTimeout(() => agentController.abort(), AGENT_TIMEOUT_MS);
  const agentStart = Date.now();
  let shortlistResult;
  try {
    shortlistResult = await agentApp.invoke(
      { messages: [new HumanMessage(buildAgentUserPrompt(runtime))] },
      { recursionLimit: 25, signal: agentController.signal, callbacks: [logger] }
    );
  } finally {
    clearTimeout(agentTimer);
  }
  console.log(`[GEN] Agent shortlisting done in ${Date.now() - agentStart}ms`);

  const shortlist = extractAgentShortlist(shortlistResult.messages);

  // Use manual JSON extraction instead of .withStructuredOutput() for
  // compatibility with models that don't support JSON schema response_format.
  const finalizer = createChatOpenRouterModel({ apiKey, model: modelName, temperature: 0.1, provider });

  const finalizerController = new AbortController();
  const finalizerTimer = setTimeout(() => finalizerController.abort(), AGENT_TIMEOUT_MS);
  const finalizerStart = Date.now();
  let finalizerResult;
  try {
    finalizerResult = await finalizer.invoke(
      [new HumanMessage({
        content: buildFinalizerPrompt(runtime, shortlist) + '\n\nIMPORTANT: Return ONLY a raw JSON object — no markdown fences, no commentary.',
      })],
      { signal: finalizerController.signal, callbacks: [logger] }
    );
  } finally {
    clearTimeout(finalizerTimer);
  }
  console.log(`[GEN] Finalizer done in ${Date.now() - finalizerStart}ms`);

  const finalizerText = formatMessageContent(finalizerResult.content);
  const finalized = finalizedOptionsSchema.parse(JSON.parse(extractJson(finalizerText)));
  return validateAndHydrateOptions(finalized, runtime);
}