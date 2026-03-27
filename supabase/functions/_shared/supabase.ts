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
 * Decode JWT token to extract payload
 */
function decodeJwt(token: string): { sub: string; email?: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    let payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (payload.length % 4) payload += '=';
    const decoded = JSON.parse(atob(payload));
    return { sub: decoded.sub, email: decoded.email };
  } catch {
    return null;
  }
}

/**
 * Get the authenticated user from the x-session-token header or x-user-id header
 * Returns null if no valid credentials provided
 * 
 * 4-layer fallback:
 * 1. Decode JWT → extract email → lookup by email
 * 2. Use Supabase auth.getUser() → get email → lookup by email  
 * 3. Use x-user-id header → lookup by local ID
 * 4. Use x-user-id header → return ID if not found
 */
export async function getAuthenticatedUser(
  req: Request
): Promise<{ id: string; email: string } | null> {
  const authHeader = req.headers.get('x-session-token');
  const userIdHeader = req.headers.get('x-user-id');

  // Layer 1: Decode JWT and look up by email
  if (authHeader) {
    const token = authHeader;
    
    // Try to decode JWT directly
    const decoded = decodeJwt(token);
    if (decoded && decoded.email) {
      const email = decoded.email.toLowerCase();
      const { data: userByEmail } = await supabase
        .from('user')
        .select('id, email')
        .eq('email', email)
        .single();
      if (userByEmail) {
        return { id: userByEmail.id, email: userByEmail.email };
      }
    }
    
    // Layer 2: Use Supabase auth to get user info and look up by email
    try {
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user && user.email) {
        const email = user.email.toLowerCase();
        const { data: userByEmail } = await supabase
          .from('user')
          .select('id, email')
          .eq('email', email)
          .single();
        if (userByEmail) {
          return { id: userByEmail.id, email: userByEmail.email };
        }
      }
    } catch (e) {
      console.error('Auth error:', e);
    }
  }

  // Layer 3: Use x-user-id header to look up by local ID
  if (userIdHeader) {
    const { data: userById } = await supabase
      .from('user')
      .select('id, email')
      .eq('id', userIdHeader)
      .single();
    if (userById) {
      return { id: userById.id, email: userById.email ?? '' };
    }
    // Layer 4: Return the ID anyway if provided (user might be in process of creation)
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