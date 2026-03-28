# AI Activity Generation Pipeline

This document explains how Go Fish turns a group's availability and preferences into ranked activity suggestions.

---

## High-Level Flow

```
Organizer clicks "Generate suggestions"
          │
          ▼
  ┌───────────────────┐
  │  eventRouter.ts   │  POST /api/events/:id/generate
  │  triggerGeneration│  (responseWindowScheduler.ts)
  └────────┬──────────┘
           │ fetch responses, benchmarks, event details
           ▼
  ┌───────────────────────────────────────────────────┐
  │            Real-World Data Fetch (optional)        │
  │  Only when event has a location (lat/lng/city)    │
  │                                                   │
  │  ┌──────────────┐  ┌──────────────┐              │
  │  │ Ticketmaster │  │ Google Places│              │
  │  │  events API  │  │  venues API  │              │
  │  └──────────────┘  └──────────────┘              │
  │  ┌──────────────┐  ┌──────────────┐              │
  │  │  Foursquare  │  │OpenWeatherMap│              │
  │  │  venues API  │  │ forecast API │              │
  │  └──────────────┘  └──────────────┘              │
  │  All 4 run concurrently (Promise.allSettled)      │
  │  Results deduplicated, scored by relevance,       │
  │  capped at 15 events + 10 venues                  │
  └───────────────────┬───────────────────────────────┘
                      │
                      ▼
  ┌───────────────────────────────────────────────────┐
  │              Build Runtime State                   │
  │  (decisionAgent/tools.ts · buildRuntimeState)     │
  │                                                   │
  │  • overlaps       — intersected time windows      │
  │  • groupPrefs     — shared + conflicting prefs    │
  │  • participantSummaries — per-person benchmark    │
  │  • eventCandidates  — from Ticketmaster           │
  │  • venueCandidates  — from Google / Foursquare    │
  └───────────────────┬───────────────────────────────┘
                      │
           ┌──────────┴──────────┐
           │                     │
           ▼                     ▼
  ┌─────────────────┐   ┌─────────────────────────┐
  │  Stage 1        │   │  Stage 2                │
  │  Planning Agent │   │  Finalizer (LLM call)   │
  │  (ReAct loop)   │──▶│  Structures the output  │
  └─────────────────┘   └─────────────────────────┘
           │                     │
           ▼                     ▼
     Agent shortlist      Validated JSON
     (free-form text)     3 ranked options
```

---

## Stage 1 — Planning Agent (ReAct Loop)

**What it is:** A [LangGraph `createReactAgent`](https://langchain-ai.github.io/langgraphjs/reference/functions/langgraph_prebuilt.createReactAgent.html) — a loop that alternates between an LLM call and tool execution until the model decides it has enough information to write an answer.

**Why LangChain/LangGraph here:** The agent needs to query multiple data sources (dates, preferences, real-world events/venues) before it can reason about what to suggest. A plain single LLM call would require stuffing all data into one giant prompt. The ReAct loop lets the model choose *which* data to inspect and *when*, keeping the context focused.

### How the loop works

```
  ┌──────────────────────────────────────────────────────────┐
  │                    LangGraph ReAct loop                   │
  │                                                          │
  │  ┌──────────┐    tool_calls?    ┌───────────────────┐   │
  │  │          │──────yes─────────▶│  Tool Executor    │   │
  │  │   LLM    │                   │  (runs 1+ tools)  │   │
  │  │  (agent) │◀──tool results────│                   │   │
  │  │          │                   └───────────────────┘   │
  │  │          │──────no──────────▶  Final text answer      │
  │  └──────────┘   (no tool calls)                          │
  │                                                          │
  │  Each LLM↔tools round-trip = 2 graph steps              │
  │  recursionLimit: 25  (≈12 tool calls max)               │
  └──────────────────────────────────────────────────────────┘
```

Each round-trip between the LLM and the tool executor counts as **2 recursion steps** in LangGraph. The limit is set to **25**, giving the model room to call all tools and revisit one or two without risk of infinite loops. A 60-second timeout acts as an independent safety cap.

### Tools available to the agent

| Tool | Purpose |
|------|---------|
| `get_date_overlaps` | Returns intersected time windows across all participant availability. Always called first — the model is instructed to use only dates from this tool. |
| `list_group_preferences` | Returns shared preferences (majority-voted) and conflicts from taste benchmarks. |
| `list_real_world_events` | Lists Ticketmaster event candidates, optionally filtered by date. |
| `list_real_world_venues` | Lists Google Places / Foursquare venue candidates with optional weather context. |

All tools are **read-only** — they read from the pre-built `AgentRuntimeState` and return JSON strings.

### System prompt (key rules given to the model)

- Call `get_date_overlaps` first.
- Use **only** dates and times returned by that tool — never invent them.
- Never fabricate URLs, venue names, price ranges, or source IDs.
- When real-world candidates exist, at least one shortlisted option must use a real `source_id`.
- Produce a shortlist of 3 options with reasoning, chosen date/time, and explicit source references (`event:<id>`, `venue:<id>`, or `custom`).

### Output of Stage 1

Free-form text — a planning shortlist with reasoning. This is **not** the final output; it feeds Stage 2.

---

## Stage 2 — Finalizer (Structured Output)

A second, separate LLM call with temperature 0.1 (more deterministic). It receives:

- The full overlap data
- The full event and venue candidates
- The group preferences
- The agent shortlist from Stage 1

Its only job is to convert the shortlist into a strict JSON object matching this schema:

```typescript
{
  options: [
    {
      title: string,
      description: string,
      suggested_date: "YYYY-MM-DD",
      suggested_time: "HH:MM",
      rank: 1 | 2 | 3,
      source_kind: "event" | "venue" | "custom",
      source_id: string | null,
      weather_note: string | null
    },
    // × 3
  ]
}
```

Why two stages instead of one? Models that don't support `response_format: json_schema` (DeepSeek, many OpenRouter models) are unreliable at producing structured JSON in a multi-turn tool-using context. Splitting into a free reasoning pass and a constrained formatting pass produces much more consistent output.

---

## Stage 3 — Validation & Hydration

`validateAndHydrateOptions` in `runner.ts` runs deterministic checks **after** the LLM:

1. Ranks must be exactly 1, 2, 3.
2. Each `suggested_date` must appear in the computed overlaps.
3. Each `suggested_time` must fall inside the valid overlap window for that date.
4. If `source_kind` is `event` or `venue`, the `source_id` must match a real candidate — no hallucinated IDs accepted.
5. Event sources cannot be moved to a different date or time than their real-world schedule.

If any check fails, the whole attempt is retried (up to 3 times with exponential back-off).

Hydration attaches fields the model never sees (source URLs, image URLs, price ranges) by looking up the validated `source_id` in the runtime state — so the model can never fabricate them.

---

## Which API / Model

```
User setting          → Provider used
─────────────────────────────────────────────────────
provider = openrouter → @langchain/openrouter  (ChatOpenRouter)
                        routes to any model on openrouter.ai
                        default model: deepseek/deepseek-chat
                        fallback model: deepseek/deepseek-reasoner

provider = deepseek   → @langchain/openai  (ChatOpenAI)
                        baseURL: https://api.deepseek.com/v1
                        user's DeepSeek API key used directly

provider = openai     → @langchain/openai  (ChatOpenAI)
                        model prefix "openai/" stripped automatically
                        user's OpenAI API key used directly
```

The API key and model are stored per-user in the database (`user.ai_api_key`, `user.ai_model`, `user.ai_provider`) and are set in **Settings → Infrastructure**.

Model fallback: if the primary model returns an error containing "not found", "unsupported", or "unavailable", the agent automatically retries with `deepseek-reasoner`.

---

## Real-World Data Providers

All four providers run **concurrently** via `Promise.allSettled` — a failure in one does not block the others. Results are cached to avoid redundant API calls.

| Provider | Data | Cache TTL | API key env var |
|----------|------|-----------|-----------------|
| Ticketmaster | Live events (concerts, sports, theatre…) within 50 km | 4 hours | `TICKETMASTER_API_KEY` |
| Google Places | Venues (restaurants, bars, museums…) | 24 hours | `GOOGLE_PLACES_API_KEY` |
| Foursquare | Venues (alternative/fallback to Google) | 24 hours | `FOURSQUARE_API_KEY` |
| OpenWeatherMap | 5-day hourly forecast, outdoor-friendliness flag | 1 hour | `OPENWEATHERMAP_API_KEY` |

Relevance scoring (`relevanceScorer.ts`) ranks results against keywords extracted from the group's taste benchmarks before passing them to the agent — the agent only sees the top 15 events and 10 venues.

All API keys are **optional**. If none are set the real-world fetch is skipped and the agent works with group preferences and availability only.

---

## Retry Strategy

```
generateActivityOptions (index.ts)
│
├── attempt 1: runPlanningAgent(primary model)
│     ├── success → return options
│     └── model-not-found error → switch to fallback model, retry immediately
│
├── attempt 2: runPlanningAgent (after 5s)
│     └── failure → wait 10s
│
└── attempt 3: runPlanningAgent (after 10s)
      └── failure → throw "Activity generation failed after 3 attempts"
```

On failure the event status is reverted from `generating` back to `collecting` so the organizer can try again.

---

## Data Flow Summary

```
PostgreSQL
  responses (available_dates)  ──────────────────────┐
  taste_benchmark (answers)    ──────────────────────┤
  event (title, description,   ──────────────────────┤
         location_lat/lng/city)                       │
                                                      ▼
                                            buildRuntimeState()
                                                      │
         ┌────────────────────────────────────────────┤
         │                                            │
         ▼                                            ▼
  Real-world APIs                           overlap windows
  (Ticketmaster, Google,                    group preferences
   Foursquare, Weather)                     participant summaries
         │                                            │
         └────────────────────┬───────────────────────┘
                              │
                              ▼
                    Planning Agent (LLM + tools)
                              │
                     agent shortlist (text)
                              │
                              ▼
                    Finalizer LLM call
                              │
                     raw JSON (3 options)
                              │
                              ▼
                    validateAndHydrateOptions()
                              │
                     GeneratedOption[] (3 items)
                              │
                              ▼
                    activity_option table (PostgreSQL)
                    event.status → options_ready
                    notification → organizer
```
