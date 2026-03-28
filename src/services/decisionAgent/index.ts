import { TasteBenchmark } from '../../models/TasteBenchmark';
import { RealWorldContext } from '../realWorldData/types';
import {
  EventContext,
  ParticipantAvailability,
  buildRuntimeState,
  buildOverlapSlots,
  buildGroupPreferenceSummary,
  createAgentTools,
  findCommonPreferences,
  rankDatesByOverlap,
  summarizeParticipant,
  AgentRuntimeState,
  CandidateRef,
  OverlapSlot,
  GroupPreferenceSummary,
} from './tools';
import {
  createChatOpenRouterModel,
  DEFAULT_MODEL,
  FALLBACK_MODEL,
  resolveOpenRouterApiKey,
  resolveOpenRouterModelName,
  shouldUseFallbackModel,
} from './model';
import {
  GeneratedOption,
  runPlanningAgent,
  validateAndHydrateOptions,
} from './runner';
import { FinalizedOption, FinalizedOptions } from './schemas';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 5000;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createPlanningRuntime(
  benchmarks: TasteBenchmark[],
  participantAvailability: ParticipantAvailability[],
  eventContext?: EventContext,
  realWorldContext?: RealWorldContext
): AgentRuntimeState {
  return buildRuntimeState(
    benchmarks,
    participantAvailability,
    eventContext,
    realWorldContext
  );
}

export async function generateActivityOptions(
  benchmarks: TasteBenchmark[],
  participantAvailability: ParticipantAvailability[],
  apiKey?: string,
  eventContext?: EventContext,
  realWorldContext?: RealWorldContext,
  model?: string,
  provider?: string
): Promise<GeneratedOption[]> {
  const resolvedApiKey = resolveOpenRouterApiKey(apiKey);
  let activeModel = resolveOpenRouterModelName(model);
  let lastError: Error | undefined;

  const runtime = createPlanningRuntime(
    benchmarks,
    participantAvailability,
    eventContext,
    realWorldContext
  );

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await runPlanningAgent(runtime, resolvedApiKey, activeModel, provider);
    } catch (error) {
      if (shouldUseFallbackModel(error, activeModel)) {
        activeModel = FALLBACK_MODEL;
        continue;
      }

      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < MAX_RETRIES - 1) {
        await sleep(BASE_DELAY_MS * Math.pow(2, attempt));
      }
    }
  }

  throw new Error(
    `Activity generation failed after ${MAX_RETRIES} attempts: ${lastError?.message}`
  );
}

export {
  AgentRuntimeState,
  CandidateRef,
  DEFAULT_MODEL,
  EventContext,
  FALLBACK_MODEL,
  FinalizedOption,
  FinalizedOptions,
  GeneratedOption,
  GroupPreferenceSummary,
  OverlapSlot,
  ParticipantAvailability,
  buildGroupPreferenceSummary,
  buildOverlapSlots,
  buildRuntimeState,
  createAgentTools,
  createChatOpenRouterModel,
  findCommonPreferences,
  rankDatesByOverlap,
  resolveOpenRouterApiKey,
  resolveOpenRouterModelName,
  shouldUseFallbackModel,
  summarizeParticipant,
  validateAndHydrateOptions,
};
