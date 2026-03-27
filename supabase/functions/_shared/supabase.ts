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
 * Get the authenticated user from the x-session-token header or x-user-id header
 * Returns null if no valid credentials provided
 */
export async function getAuthenticatedUser(
  req: Request
): Promise<{ id: string; email: string } | null> {
  const authHeader = req.headers.get('x-session-token');
  const userIdHeader = req.headers.get('x-user-id');

  // Try session token first
  if (authHeader) {
    const token = authHeader;
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (!error && user) {
      return { id: user.id, email: user.email ?? '' };
    }
  }

  // Fallback: use x-user-id header if available
  if (userIdHeader) {
    const { data: user } = await supabase
      .from('user')
      .select('email')
      .eq('id', userIdHeader)
      .single();
    if (user) {
      return { id: userIdHeader, email: user.email ?? '' };
    }
    return { id: userIdHeader, email: '' };
  }

  return null;
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