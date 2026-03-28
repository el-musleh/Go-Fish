import { supabase } from '../lib/supabase';

const API_BASE = '/api';
const USER_ID_STORAGE_KEY = 'gofish_user_id';
const USER_EMAIL_STORAGE_KEY = 'gofish_user_email';
const AUTH_CHANGE_EVENT = 'gofish:auth-change';

let currentUserId: string | null = localStorage.getItem(USER_ID_STORAGE_KEY);
let currentUserEmail: string | null = localStorage.getItem(USER_EMAIL_STORAGE_KEY);

function notifyAuthChange() {
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
}

export function setCurrentUserId(id: string) {
  currentUserId = id;
  localStorage.setItem(USER_ID_STORAGE_KEY, id);
  notifyAuthChange();
}

export function getCurrentUserId(): string | null {
  return currentUserId;
}

export function setCurrentUserEmail(email: string) {
  currentUserEmail = email;
  localStorage.setItem(USER_EMAIL_STORAGE_KEY, email);
  notifyAuthChange();
}

export function getCurrentUserEmail(): string | null {
  return currentUserEmail;
}

export function clearCurrentUser() {
  currentUserId = null;
  currentUserEmail = null;
  localStorage.removeItem(USER_ID_STORAGE_KEY);
  localStorage.removeItem(USER_EMAIL_STORAGE_KEY);
  notifyAuthChange();
}

export function subscribeToAuthChange(listener: () => void): () => void {
  const handleAuthChange = () => {
    currentUserId = localStorage.getItem(USER_ID_STORAGE_KEY);
    currentUserEmail = localStorage.getItem(USER_EMAIL_STORAGE_KEY);
    listener();
  };

  window.addEventListener(AUTH_CHANGE_EVENT, handleAuthChange);
  window.addEventListener('storage', handleAuthChange);

  return () => {
    window.removeEventListener(AUTH_CHANGE_EVENT, handleAuthChange);
    window.removeEventListener('storage', handleAuthChange);
  };
}

const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
  };

  let session = (await supabase.auth.getSession()).data.session;
  if (!session) {
    await new Promise((r) => setTimeout(r, 100));
    session = (await supabase.auth.getSession()).data.session;
  }
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }
  if (currentUserId) {
    headers['x-user-id'] = currentUserId;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    headers,
    ...options,
  });

  if (!res.ok) {
    if (res.status === 401) {
      clearCurrentUser();
    }
    const body = await res.json().catch(() => ({ error: res.statusText }));
    const error = new ApiError(res.status, body, path, options?.method || 'GET');
    console.error(`[API Error] ${options?.method || 'GET'} ${path}`, {
      status: res.status,
      body,
    });
    throw error;
  }

  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  status: number;
  body: unknown;
  path: string;
  method: string;

  constructor(status: number, body: unknown, path: string, method: string) {
    const bodyObj =
      typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
    const message =
      (bodyObj.message as string | undefined) ||
      (bodyObj.error as string | undefined) ||
      `API error ${status}`;
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
    this.path = path;
    this.method = method;
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path),

  post: <T>(path: string, data?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }),

  patch: <T>(path: string, data?: unknown) =>
    request<T>(path, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    }),

  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  auth_provider: 'google' | 'email';
  ai_api_key: string | null;
  ai_model: string | null;
  ai_provider: string | null;
  created_at: string;
}

export interface StorageInfo {
  eventsCreated: number;
  responsesSubmitted: number;
  hasTasteBenchmark: boolean;
}

export interface UserPreferences {
  notifications: {
    invite_received: boolean;
    event_reminder: boolean;
    event_results: boolean;
    weekly_digest: boolean;
  };
  accessibility: {
    font_size: 'small' | 'medium' | 'large';
    reduced_motion: boolean;
    compact_mode: boolean;
    high_contrast: boolean;
    screen_reader: boolean;
  };
  regional: {
    timezone: string;
    date_format: string;
  };
  privacy: {
    profile_visible: boolean;
    show_activity: boolean;
  };
}

export const defaultPreferences: UserPreferences = {
  notifications: {
    invite_received: true,
    event_reminder: true,
    event_results: true,
    weekly_digest: false,
  },
  accessibility: {
    font_size: 'medium',
    reduced_motion: false,
    compact_mode: false,
    high_contrast: false,
    screen_reader: false,
  },
  regional: {
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    date_format: 'MM/DD/YYYY',
  },
  privacy: {
    profile_visible: true,
    show_activity: true,
  },
};

// ── Notification Types ──────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  user_id: string;
  type: 'rsvp_received' | 'event_finalized' | 'event_invited' | 'options_ready';
  title: string;
  description: string | null;
  event_id: string | null;
  link: string | null;
  read: boolean;
  expired: boolean;
  created_at: string;
}

export interface NotificationListResponse {
  notifications: Notification[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface RecentNotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
  hasMore: boolean;
}

export interface NotificationPreferences {
  email_on_event_confirmed: boolean;
  email_on_new_rsvp: boolean;
  email_on_options_ready: boolean;
}

// ── Notification API Methods ───────────────────────────────────────────────────

export async function getNotifications(
  page: number = 1,
  limit: number = 10
): Promise<NotificationListResponse> {
  return api.get<NotificationListResponse>(`/notifications?page=${page}&limit=${limit}`);
}

export async function getRecentNotifications(
  limit: number = 5
): Promise<RecentNotificationsResponse> {
  return api.get<RecentNotificationsResponse>(`/notifications/recent?limit=${limit}`);
}

export async function getUnreadNotificationCount(): Promise<number> {
  const response = await api.get<{ count: number }>('/notifications/unread-count');
  return response.count;
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  await api.patch(`/notifications/${notificationId}/read`);
}

export async function markAllNotificationsRead(): Promise<number> {
  const response = await api.post<{ success: boolean; count: number }>(
    '/notifications/mark-all-read'
  );
  return response.count;
}

export async function deleteNotification(notificationId: string): Promise<void> {
  await api.delete(`/notifications/${notificationId}`);
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  return api.get<NotificationPreferences>('/notifications/preferences');
}

export async function updateNotificationPreferences(
  preferences: Partial<NotificationPreferences>
): Promise<NotificationPreferences> {
  return api.patch<NotificationPreferences>('/notifications/preferences', preferences);
}
