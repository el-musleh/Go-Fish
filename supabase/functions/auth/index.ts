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
    const payload = JSON.parse(atob(parts[1]));
    return { sub: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}

async function getUserFromToken(req: Request, supabase: SupabaseClient): Promise<{ id: string; email: string } | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  
  const token = authHeader.slice(7);
  
  // First try with Supabase auth
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    // Fallback: try to decode JWT manually
    const decoded = decodeJwt(token);
    if (decoded) {
      return { id: decoded.sub, email: decoded.email ?? '' };
    }
    return null;
  }
  
  return { id: user.id, email: user.email ?? '' };
}

async function getOrCreateUser(req: Request, supabase: SupabaseClient): Promise<{ id: string; email: string }> {
  const user = await getUserFromToken(req, supabase);
  if (user) return user;
  
  // For email-only login, get email from request body
  const body = await req.json().catch(() => ({}));
  const email = body.email?.toLowerCase();
  
  if (!email) {
    throw new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  // Look up or create user in our table
  const { data: existingUser } = await supabase
    .from('user')
    .select('*')
    .eq('email', email)
    .single();
  
  if (existingUser) {
    return { id: existingUser.id, email: existingUser.email };
  }
  
  // Create new user
  const { data: newUser, error: createError } = await supabase
    .from('user')
    .insert({ email, auth_provider: 'email' })
    .select()
    .single();
  
  if (createError) throw createError;
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
    console.error('Auth function error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});