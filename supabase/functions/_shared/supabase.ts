/**
 * Shared Supabase client for Edge Functions
 * Uses the built-in supabase-js from Deno
 */
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

/**
 * Get the authenticated user from the Authorization header
 * Returns null if no valid token provided
 */
export async function getAuthenticatedUser(
  req: Request
): Promise<{ id: string; email: string } | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return null;
  }

  return { id: user.id, email: user.email ?? '' };
}

/**
 * Require authentication - throws error if not authenticated
 */
export async function requireAuthenticatedUser(req: Request): Promise<{ id: string; email: string }> {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    throw new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return user;
}