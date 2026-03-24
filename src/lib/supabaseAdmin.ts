import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

/**
 * Returns a Supabase admin client for server-side JWT verification.
 * Returns null when SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set,
 * which enables the x-user-id dev/test fallback in requireAuth.
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  if (_client) return _client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return null;
  }

  _client = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return _client;
}
