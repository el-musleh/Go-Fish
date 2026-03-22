import { AgentRuntimeState } from './tools';

export function buildAgentSystemPrompt(runtime: AgentRuntimeState): string {
  const hasRealWorldCandidates =
    runtime.eventCandidates.length > 0 || runtime.venueCandidates.length > 0;

  return [
    'You are Go Fish, an activity planning agent.',
    'You must use tools before deciding on dates, times, and sources.',
    'Always call get_date_overlaps first.',
    'Use only dates and times returned by get_date_overlaps.',
    'Never invent URLs, venue names, price ranges, source IDs, or images.',
    'When real-world candidates exist, at least one shortlisted option must use a returned event or venue source_id.',
    'You are preparing a shortlist for a structured finalizer, not returning final JSON yourself.',
    hasRealWorldCandidates
      ? 'Use real-world events or venues when they genuinely fit the group.'
      : 'If there are no real-world candidates, focus on high-fit custom ideas.',
  ].join(' ');
}

export function buildAgentUserPrompt(runtime: AgentRuntimeState): string {
  const eventSection = runtime.eventContext
    ? `Event title: ${runtime.eventContext.title}\nEvent description: ${runtime.eventContext.description}\n`
    : '';
  const availabilityMode =
    runtime.participantAvailability.length === 0
      ? 'No participants responded yet. Treat the overlap dates as fallback planning windows for draft suggestions.'
      : 'Use the overlap dates as the real shared availability.';

  return [
    eventSection,
    `Participants with benchmarks: ${runtime.participantSummaries.length}`,
    `Participants with responses: ${runtime.participantAvailability.length}`,
    `Available overlap dates: ${runtime.overlaps.length}`,
    availabilityMode,
    'Task:',
    '- inspect the group preferences',
    '- inspect date overlaps',
    '- inspect real-world candidates when available',
    '- produce a concise shortlist of the best 3 options',
    '- include reasoning, chosen date, chosen time, and explicit source references such as "event:<source_id>", "venue:<source_id>", or "custom"',
  ].join('\n');
}

export function buildFinalizerPrompt(
  runtime: AgentRuntimeState,
  agentShortlist: string
): string {
  return [
    'Convert the planning notes below into a strict JSON object with an "options" array of exactly 3 items.',
    'Each option must include title, description, suggested_date, suggested_time, rank, source_kind, source_id, and weather_note.',
    'Use only dates and times from the overlap data.',
    'Use source_kind "event", "venue", or "custom".',
    'When using event or venue, source_id must exactly match a listed candidate ID.',
    'Do not invent URLs, prices, venue names, or images.',
    '',
    'OVERLAPS:',
    JSON.stringify(runtime.overlaps, null, 2),
    '',
    'EVENT CANDIDATES:',
    JSON.stringify(runtime.eventCandidates, null, 2),
    '',
    'VENUE CANDIDATES:',
    JSON.stringify(runtime.venueCandidates, null, 2),
    '',
    'GROUP PREFERENCES:',
    JSON.stringify(runtime.groupPreferences, null, 2),
    '',
    'AGENT SHORTLIST:',
    agentShortlist,
  ].join('\n');
}
