import type {
  AvailabilitySubmit,
  BenchmarkSubmission,
  DashboardResponse,
  EventCreate,
  EventInvitees,
  GenerateOptionsResponse,
  JoinEventResponse,
  PreferencesResponse,
  SelectOptionPayload,
} from "@go-fish/contracts";

const baseURL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

export class ApiError extends Error {
  constructor(message: string, public readonly statusCode: number) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseURL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    let message = "Something went wrong.";
    try {
      const data = (await response.json()) as { error?: string };
      message = data.error ?? message;
    } catch {
      // Ignore JSON parsing errors for non-JSON responses.
    }
    throw new ApiError(message, response.status);
  }

  return response.json() as Promise<T>;
}

export const api = {
  getDashboard: () => request<DashboardResponse>("/v1/dashboard"),
  getPreferences: () => request<PreferencesResponse>("/v1/me/preferences"),
  updatePreferences: (payload: BenchmarkSubmission) =>
    request<PreferencesResponse>("/v1/me/preferences", {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  createEvent: (payload: EventCreate) =>
    request<{ event: DashboardResponse["events"][number] }>("/v1/events", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  addInvitees: (eventId: string, payload: EventInvitees) =>
    request<{ event: DashboardResponse["events"][number] }>(`/v1/events/${eventId}/invitees`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getEvent: (eventId: string) =>
    request<{
      event: DashboardResponse["events"][number];
      invitees: JoinEventResponse["event"]["invitees"];
      inviter: DashboardResponse["user"];
    }>(`/v1/events/${eventId}`),
  getJoinEvent: (slug: string) => request<JoinEventResponse>(`/v1/events/slug/${slug}`),
  submitBenchmark: (eventId: string, payload: object) =>
    request<PreferencesResponse>(`/v1/events/${eventId}/benchmark`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  submitAvailability: (eventId: string, payload: AvailabilitySubmit) =>
    request<JoinEventResponse>(`/v1/events/${eventId}/availability`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  retryGeneration: (eventId: string) =>
    request<{ eventId: string; requeued: boolean }>(`/v1/events/${eventId}/generate-options`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
  selectOption: (eventId: string, payload: SelectOptionPayload) =>
    request<{ event: DashboardResponse["events"][number] }>(`/v1/events/${eventId}/select-option`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  deleteEvent: (eventId: string) =>
    request<{ deleted: boolean }>(`/v1/events/${eventId}`, { method: "DELETE" }),
  getEvents: () => request<{ events: DashboardResponse["events"] }>("/v1/events"),
  getGeneratedOptions: (_eventId: string) => Promise.resolve(null as GenerateOptionsResponse | null),
};
