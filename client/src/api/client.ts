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

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  // Always send the Supabase JWT when available (used by the backend in production).
  // Always send x-user-id when available (used by the backend in dev mode when
  // SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY are not configured). Sending both is
  // safe: production ignores x-user-id, dev mode ignores the Bearer token.
  const {
    data: { session },
  } = await supabase.auth.getSession();
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
