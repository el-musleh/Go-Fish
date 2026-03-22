import { tool } from 'langchain';
import { TasteBenchmark } from '../../models/TasteBenchmark';
import { DateTimeWindow } from '../../models/Response';
import { RealWorldContext } from '../realWorldData/types';
import {
  emptyToolInputSchema,
  listCandidatesInputSchema,
  listDateOverlapsInputSchema,
} from './schemas';

export interface ParticipantAvailability {
  participant_index: number;
  windows: DateTimeWindow[];
}

export interface EventContext {
  title: string;
  description: string;
}

export interface OverlapWindow {
  start_time: string;
  end_time: string;
}

export interface OverlapSlot {
  date: string;
  participant_count: number;
  participant_indices: number[];
  windows: OverlapWindow[];
  priority: number;
}

export interface CandidateRef {
  source_kind: 'event' | 'venue';
  source_id: string;
  title: string;
  description: string;
  suggested_date: string | null;
  suggested_time: string | null;
  venue_name: string | null;
  source_url: string | null;
  price_range: string | null;
  weather_note: string | null;
  image_url: string | null;
}

export interface PreferenceConflict {
  category: string;
  values: string[];
}

export interface GroupPreferenceSummary {
  shared: Record<string, string[]>;
  conflicts: PreferenceConflict[];
}

export interface AgentRuntimeState {
  eventContext?: EventContext;
  participantSummaries: string[];
  participantAvailability: ParticipantAvailability[];
  overlaps: OverlapSlot[];
  groupPreferences: GroupPreferenceSummary;
  eventCandidates: CandidateRef[];
  venueCandidates: CandidateRef[];
}

const QUESTION_LABELS: Record<string, string> = {
  q1: 'Outdoor activities',
  q2: 'Indoor activities',
  q3: 'Food preferences',
  q4: 'Sports interests',
  q5: 'Creative activities',
  q6: 'Social setting preferences',
  q7: 'Entertainment preferences',
  q8: 'Adventure activities',
  q9: 'Relaxation activities',
  q10: 'Learning activities',
};

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map((part) => Number(part));
  return hours * 60 + minutes;
}

function minutesToTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function dedupeWindows(windows: OverlapWindow[]): OverlapWindow[] {
  const seen = new Set<string>();
  return windows.filter((window) => {
    const key = `${window.start_time}-${window.end_time}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function intersectWindows(left: OverlapWindow, right: DateTimeWindow): OverlapWindow | null {
  const start = Math.max(timeToMinutes(left.start_time), timeToMinutes(right.start_time));
  const end = Math.min(timeToMinutes(left.end_time), timeToMinutes(right.end_time));
  if (start >= end) {
    return null;
  }
  return {
    start_time: minutesToTime(start),
    end_time: minutesToTime(end),
  };
}

function computeCommonWindows(groups: DateTimeWindow[][]): OverlapWindow[] {
  if (groups.length === 0) {
    return [];
  }

  let current: OverlapWindow[] = groups[0].map((window) => ({
    start_time: window.start_time,
    end_time: window.end_time,
  }));

  for (const group of groups.slice(1)) {
    const next: OverlapWindow[] = [];
    for (const overlap of current) {
      for (const window of group) {
        const intersected = intersectWindows(overlap, window);
        if (intersected) {
          next.push(intersected);
        }
      }
    }
    current = dedupeWindows(next);
    if (current.length === 0) {
      return [];
    }
  }

  return current.sort(
    (a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time)
  );
}

export function rankDatesByOverlap(
  participantAvailability: ParticipantAvailability[]
): { date: string; count: number }[] {
  const frequency = new Map<string, number>();
  for (const participant of participantAvailability) {
    const dates = new Set(participant.windows.map((window) => window.date));
    for (const date of dates) {
      frequency.set(date, (frequency.get(date) ?? 0) + 1);
    }
  }
  return Array.from(frequency.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => b.count - a.count || a.date.localeCompare(b.date));
}

export function findCommonPreferences(
  benchmarks: TasteBenchmark[]
): Record<string, string[]> {
  const total = benchmarks.length;
  if (total === 0) {
    return {};
  }

  const frequencyByQuestion = new Map<string, Map<string, number>>();
  for (const benchmark of benchmarks) {
    for (const [question, values] of Object.entries(benchmark.answers)) {
      const questionMap = frequencyByQuestion.get(question) ?? new Map<string, number>();
      for (const value of values) {
        questionMap.set(value, (questionMap.get(value) ?? 0) + 1);
      }
      frequencyByQuestion.set(question, questionMap);
    }
  }

  const shared: Record<string, string[]> = {};
  for (const [question, valueMap] of frequencyByQuestion.entries()) {
    const values = Array.from(valueMap.entries())
      .filter(([, count]) => count > total / 2)
      .map(([value]) => value);
    if (values.length > 0) {
      shared[QUESTION_LABELS[question] ?? question] = values;
    }
  }

  return shared;
}

export function summarizeParticipant(benchmark: TasteBenchmark, index: number): string {
  const lines = Object.entries(benchmark.answers).map(([question, values]) => {
    const label = QUESTION_LABELS[question] ?? question;
    return `${label}: ${values.join(', ')}`;
  });

  return `Participant ${index + 1}: ${lines.join(' | ')}`;
}

export function buildGroupPreferenceSummary(
  benchmarks: TasteBenchmark[]
): GroupPreferenceSummary {
  const shared = findCommonPreferences(benchmarks);
  const conflicts: PreferenceConflict[] = [];

  const frequencyByQuestion = new Map<string, Set<string>>();
  for (const benchmark of benchmarks) {
    for (const [question, values] of Object.entries(benchmark.answers)) {
      const current = frequencyByQuestion.get(question) ?? new Set<string>();
      for (const value of values) {
        current.add(value);
      }
      frequencyByQuestion.set(question, current);
    }
  }

  for (const [question, values] of frequencyByQuestion.entries()) {
    if (values.size > 1 && !(QUESTION_LABELS[question] in shared)) {
      conflicts.push({
        category: QUESTION_LABELS[question] ?? question,
        values: Array.from(values).sort(),
      });
    }
  }

  return { shared, conflicts };
}

export function buildOverlapSlots(
  participantAvailability: ParticipantAvailability[]
): OverlapSlot[] {
  const byDate = new Map<string, Map<number, DateTimeWindow[]>>();

  for (const participant of participantAvailability) {
    for (const window of participant.windows) {
      const dateMap = byDate.get(window.date) ?? new Map<number, DateTimeWindow[]>();
      const participantWindows = dateMap.get(participant.participant_index) ?? [];
      participantWindows.push(window);
      dateMap.set(participant.participant_index, participantWindows);
      byDate.set(window.date, dateMap);
    }
  }

  const slots: OverlapSlot[] = [];
  for (const [date, participantMap] of byDate.entries()) {
    const participantIndices = Array.from(participantMap.keys()).sort((a, b) => a - b);
    const groups = participantIndices.map((index) => participantMap.get(index) ?? []);
    const windows = computeCommonWindows(groups);
    if (windows.length === 0) {
      continue;
    }

    slots.push({
      date,
      participant_count: participantIndices.length,
      participant_indices: participantIndices,
      windows,
      priority: 0,
    });
  }

  return slots
    .sort((a, b) => {
      if (b.participant_count !== a.participant_count) {
        return b.participant_count - a.participant_count;
      }
      return a.date.localeCompare(b.date);
    })
    .map((slot, index) => ({ ...slot, priority: index + 1 }));
}

function buildWeatherNoteMap(realWorldContext?: RealWorldContext): Map<string, string> {
  const map = new Map<string, string>();
  for (const day of realWorldContext?.weather ?? []) {
    const outdoor = day.isOutdoorFriendly ? 'outdoor-friendly' : 'better indoors';
    map.set(
      day.date,
      `${day.description}, ${day.tempHighC}C high, ${day.precipProbability}% rain, ${outdoor}`
    );
  }
  return map;
}

export function buildCandidateRefs(realWorldContext?: RealWorldContext): {
  events: CandidateRef[];
  venues: CandidateRef[];
} {
  const weatherNotes = buildWeatherNoteMap(realWorldContext);

  const events = (realWorldContext?.events ?? []).map((event) => ({
    source_kind: 'event' as const,
    source_id: event.sourceId,
    title: event.title,
    description: event.description || event.category,
    suggested_date: event.date,
    suggested_time: event.startTime,
    venue_name: event.venueName,
    source_url: event.url,
    price_range: event.priceRange,
    weather_note: weatherNotes.get(event.date) ?? null,
    image_url: event.imageUrl,
  }));

  const venues = (realWorldContext?.venues ?? []).map((venue) => ({
    source_kind: 'venue' as const,
    source_id: venue.sourceId,
    title: venue.name,
    description: venue.category,
    suggested_date: null,
    suggested_time: null,
    venue_name: venue.name,
    source_url: venue.url,
    price_range: venue.priceLevel !== null ? '€'.repeat(venue.priceLevel + 1) : null,
    weather_note: null,
    image_url: venue.photoUrl,
  }));

  return { events, venues };
}

export function buildRuntimeState(
  benchmarks: TasteBenchmark[],
  participantAvailability: ParticipantAvailability[],
  eventContext?: EventContext,
  realWorldContext?: RealWorldContext
): AgentRuntimeState {
  return {
    eventContext,
    participantSummaries: benchmarks.map((benchmark, index) =>
      summarizeParticipant(benchmark, index)
    ),
    participantAvailability,
    overlaps: buildOverlapSlots(participantAvailability),
    groupPreferences: buildGroupPreferenceSummary(benchmarks),
    eventCandidates: buildCandidateRefs(realWorldContext).events,
    venueCandidates: buildCandidateRefs(realWorldContext).venues,
  };
}

function stringify(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function createAgentTools(runtime: AgentRuntimeState) {
  const getDateOverlaps = tool(
    async ({ limit }) =>
      stringify({
        overlaps: runtime.overlaps.slice(0, limit).map((slot) => ({
          date: slot.date,
          participant_count: slot.participant_count,
          participant_indices: slot.participant_indices,
          windows: slot.windows,
          priority: slot.priority,
        })),
      }),
    {
      name: 'get_date_overlaps',
      description:
        'Return ranked dates with exact valid common time windows. Always use this before choosing dates or times.',
      schema: listDateOverlapsInputSchema,
    }
  );

  const listRealWorldEvents = tool(
    async ({ date, limit }) =>
      stringify({
        events: runtime.eventCandidates
          .filter((candidate) => !date || candidate.suggested_date === date)
          .slice(0, limit),
      }),
    {
      name: 'list_real_world_events',
      description:
        'List ranked real-world event candidates. Use source_id values exactly as returned.',
      schema: listCandidatesInputSchema,
    }
  );

  const listRealWorldVenues = tool(
    async ({ date, limit }) =>
      stringify({
        venues: runtime.venueCandidates.slice(0, limit),
        weather_note_for_date:
          date &&
          runtime.eventCandidates.find((candidate) => candidate.suggested_date === date)?.weather_note
            ? runtime.eventCandidates.find((candidate) => candidate.suggested_date === date)?.weather_note
            : null,
      }),
    {
      name: 'list_real_world_venues',
      description:
        'List ranked venue candidates and optional weather context for a requested date. Use source_id values exactly as returned.',
      schema: listCandidatesInputSchema,
    }
  );

  const listGroupPreferences = tool(
    async () =>
      stringify({
        participant_summaries: runtime.participantSummaries,
        shared_preferences: runtime.groupPreferences.shared,
        conflicts: runtime.groupPreferences.conflicts,
      }),
    {
      name: 'list_group_preferences',
      description:
        'Return the normalized group preference summary, including shared preferences and conflicts.',
      schema: emptyToolInputSchema,
    }
  );

  return [
    getDateOverlaps,
    listRealWorldEvents,
    listRealWorldVenues,
    listGroupPreferences,
  ] as const;
}
