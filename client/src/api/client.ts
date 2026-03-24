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

  // Prefer the Supabase JWT for verified auth; fall back to x-user-id for local
  // dev environments where Supabase is not configured on the backend.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  } else if (currentUserId) {
    headers['x-user-id'] = currentUserId;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    headers,
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, body);
  }

  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown) {
    super(`API error ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
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
  created_at: string;
}

export interface StorageInfo {
  eventsCreated: number;
  responsesSubmitted: number;
  hasTasteBenchmark: boolean;
}
