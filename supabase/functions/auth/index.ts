/**
 * Auth Edge Function - handles all /auth/* endpoints
 * GET  /api/auth/me - Get current user profile
 * PATCH /api/auth/me - Update user profile
 * GET  /api/auth/storage-info - Get storage stats
 * POST /api/auth/email - Email login/registration
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function createSupabaseClient(req: Request): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

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
 * Get user from token with 4-layer fallback:
 * 1. Decode JWT → extract email → lookup by email
 * 2. Use Supabase auth.getUser() → get email → lookup by email
 * 3. Use x-user-id header → lookup by local ID
 * 4. Use x-user-id header → create user if not exists
 */
async function getUserFromToken(req: Request, supabase: SupabaseClient): Promise<{ id: string; email: string } | null> {
  const authHeader = req.headers.get('x-session-token');
  const userIdHeader = req.headers.get('x-user-id');
  
  // Layer 1: Decode JWT and look up by email
  if (authHeader) {
    const token = authHeader;
    
    // Try to decode JWT directly
    const decoded = decodeJwt(token);
    if (decoded && decoded.email) {
      const email = decoded.email.toLowerCase();
      // Look up user by email in our table
      const { data: userByEmail } = await supabase
        .from('user')
        .select('id, email')
        .eq('email', email)
        .single();
      if (userByEmail) {
        console.log('Layer 1 success: found user by email from JWT');
        return { id: userByEmail.id, email: userByEmail.email };
      }
    }
    
    // Layer 2: Use Supabase auth to get user info and look up by email
    try {
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user && user.email) {
        const email = user.email.toLowerCase();
        // Look up user by email in our table
        const { data: userByEmail } = await supabase
          .from('user')
          .select('id, email')
          .eq('email', email)
          .single();
        if (userByEmail) {
          console.log('Layer 2 success: found user by email from Supabase auth');
          return { id: userByEmail.id, email: userByEmail.email };
        }
      }
    } catch (e) {
      console.error('Layer 2 error:', e);
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
      console.log('Layer 3 success: found user by local ID');
      return { id: userById.id, email: userById.email ?? '' };
    }
    // If x-user-id provided but user doesn't exist, return the ID anyway
    // This handles the case where user was just created
    console.log('Layer 3: user ID provided but not found in table');
    return { id: userIdHeader, email: '' };
  }
  
  console.log('All auth layers failed: no valid credentials');
  return null;
}

/**
 * Get existing user or create new one with proper auth tracking
 */
async function getOrCreateUser(req: Request, supabase: SupabaseClient): Promise<{ id: string; email: string }> {
  // First try to get user from token
  const user = await getUserFromToken(req, supabase);
  if (user && user.email) return user;
  
  // Get auth info from token for creating/updating user
  const authHeader = req.headers.get('x-session-token');
  const userIdHeader = req.headers.get('x-user-id');
  
  let authId: string | null = null;
  let authProvider: 'google' | 'email' = 'email';
  
  // Try to get auth_id and provider from Supabase auth
  if (authHeader) {
    try {
      const { data: { user: supabaseUser } } = await supabase.auth.getUser(authHeader);
      if (supabaseUser) {
        authId = supabaseUser.id;
        // Detect provider from app_metadata
        const provider = supabaseUser.app_metadata?.provider ?? 'email';
        authProvider = provider === 'google' ? 'google' : 'email';
        console.log('Detected auth provider:', authProvider, 'auth_id:', authId);
      }
    } catch (e) {
      console.error('Error getting user from auth:', e);
    }
  }
  
  // For email-only login, get email from request body
  const body = await req.json().catch(() => ({}));
  const email = body.email?.toLowerCase();
  
  if (!email) {
    throw new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  // Look up existing user by email
  const { data: existingUser } = await supabase
    .from('user')
    .select('*')
    .eq('email', email)
    .single();
  
  if (existingUser) {
    // Update auth_id if not set and we have it
    if (authId && !existingUser.auth_id) {
      await supabase
        .from('user')
        .update({ 
          auth_id: authId, 
          auth_provider: authProvider,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingUser.id);
      console.log('Updated user with auth_id:', authId);
    }
    return { id: existingUser.id, email: existingUser.email };
  }
  
  // Create new user with auth_id and proper provider
  const { data: newUser, error: createError } = await supabase
    .from('user')
    .insert({ 
      email, 
      auth_provider: authProvider,
      auth_id: authId,
      updated_at: new Date().toISOString()
    })
    .select()
    .single();
  
  if (createError) throw createError;
  console.log('Created new user with auth_provider:', authProvider, 'auth_id:', authId);
  return { id: newUser.id, email: newUser.email };
}

// GET /api/auth/me - Get current user
async function handleGetMe(req: Request, supabase: SupabaseClient): Promise<Response> {
  const user = await getUserFromToken(req, supabase);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  const { data: userData, error } = await supabase
    .from('user')
    .select('*')
    .eq('id', user.id)
    .single();
  
  if (error || !userData) {
    return new Response(JSON.stringify({ error: 'User not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  return new Response(JSON.stringify(userData), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// PATCH /api/auth/me - Update user profile
async function handlePatchMe(req: Request, supabase: SupabaseClient): Promise<Response> {
  const user = await getUserFromToken(req, supabase);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  const body = await req.json().catch(() => ({}));
  const { name, ai_api_key } = body;
  
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (ai_api_key !== undefined) updates.ai_api_key = ai_api_key;
  
  const { data: updatedUser, error } = await supabase
    .from('user')
    .update(updates)
    .eq('id', user.id)
    .select()
    .single();
  
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  return new Response(JSON.stringify(updatedUser), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// GET /api/auth/storage-info - Get storage stats
async function handleGetStorageInfo(req: Request, supabase: SupabaseClient): Promise<Response> {
  const user = await getUserFromToken(req, supabase);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  const [eventsResult, responsesResult, benchmarkResult] = await Promise.all([
    supabase.from('event').select('id', { count: 'exact', head: true }).eq('inviter_id', user.id),
    supabase.from('response').select('id', { count: 'exact', head: true }).eq('invitee_id', user.id),
    supabase.from('taste_benchmark').select('id').eq('user_id', user.id).single(),
  ]);
  
  return new Response(JSON.stringify({
    eventsCreated: eventsResult.count ?? 0,
    responsesSubmitted: responsesResult.count ?? 0,
    hasTasteBenchmark: !!benchmarkResult.data,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// POST /api/auth/email - Email login/registration
async function handleEmailAuth(req: Request, supabase: SupabaseClient): Promise<Response> {
  const body = await req.json().catch(() => ({}));
  const email = body.email?.toLowerCase();
  
  if (!email) {
    return new Response(JSON.stringify({ error: 'Email is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  // Look up or create user
  let { data: user } = await supabase
    .from('user')
    .select('*')
    .eq('email', email)
    .single();
  
  if (!user) {
    const { data: newUser, error } = await supabase
      .from('user')
      .insert({ email, auth_provider: 'email' })
      .select()
      .single();
    
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    user = newUser;
  }
  
  // Check if user has taste benchmark
  const { data: benchmark } = await supabase
    .from('taste_benchmark')
    .select('id')
    .eq('user_id', user.id)
    .single();
  
  return new Response(JSON.stringify({
    userId: user.id,
    email: user.email,
    isNew: !benchmark,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  const supabase = createSupabaseClient(req);
  const url = new URL(req.url);
  
  // Route based on path
  const path = url.pathname.replace('/auth', '');
  
  try {
    switch (path) {
      case '/me':
        if (req.method === 'GET') return await handleGetMe(req, supabase);
        if (req.method === 'PATCH') return await handlePatchMe(req, supabase);
        break;
      case '/storage-info':
        if (req.method === 'GET') return await handleGetStorageInfo(req, supabase);
        break;
      case '/email':
        if (req.method === 'POST') return await handleEmailAuth(req, supabase);
        break;
    }
    
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Auth function error:', errorMessage);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: errorMessage,
      hint: 'Check Supabase function logs for details'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});