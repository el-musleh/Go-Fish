/**
 * Taste Benchmark Edge Function - handles /taste-benchmark/* endpoints
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const REQUIRED_QUESTIONS = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10'];

function createSupabaseClient(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  return createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });
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

async function getUserFromToken(req: Request, supabase: ReturnType<typeof createSupabaseClient>): Promise<{ id: string; email: string } | null> {
  const authHeader = req.headers.get('x-session-token');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    const decoded = decodeJwt(token);
    if (decoded) return { id: decoded.sub, email: decoded.email ?? '' };
    return null;
  }
  return user ? { id: user.id, email: user.email ?? '' } : null;
}

async function requireAuth(req: Request, supabase: ReturnType<typeof createSupabaseClient>) {
  const user = await getUserFromToken(req, supabase);
  if (!user) {
    throw new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  return user;
}

// POST /api/taste-benchmark - Create taste benchmark
async function handleCreate(req: Request, supabase: ReturnType<typeof createSupabaseClient>, userId: string): Promise<Response> {
  const body = await req.json();
  const { answers } = body;

  if (!answers || typeof answers !== 'object') {
    return new Response(JSON.stringify({ error: 'incomplete_benchmark', missingQuestions: REQUIRED_QUESTIONS }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const missingQuestions = REQUIRED_QUESTIONS.filter(q => !answers[q] || !Array.isArray(answers[q]) || answers[q].length === 0);
  if (missingQuestions.length > 0) {
    return new Response(JSON.stringify({ error: 'incomplete_benchmark', missingQuestions }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Sanitize answers - keep only required questions
  const sanitizedAnswers: Record<string, string[]> = {};
  for (const q of REQUIRED_QUESTIONS) {
    sanitizedAnswers[q] = answers[q];
  }

  // Create benchmark
  const { data: benchmark, error } = await supabase
    .from('taste_benchmark')
    .insert({ user_id: userId, answers: sanitizedAnswers })
    .select()
    .single();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Update user has_taste_benchmark flag
  await supabase.from('user').update({ has_taste_benchmark: true }).eq('id', userId);

  return new Response(JSON.stringify(benchmark), {
    status: 201,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// GET /api/taste-benchmark - Get user's taste benchmark
async function handleGet(req: Request, supabase: ReturnType<typeof createSupabaseClient>, userId: string): Promise<Response> {
  const { data: benchmark, error } = await supabase
    .from('taste_benchmark')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !benchmark) {
    return new Response(JSON.stringify({ error: 'not_found', message: 'No taste benchmark found.' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(benchmark), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createSupabaseClient(req);
  const path = new URL(req.url).pathname.replace(/^\/taste-benchmark/, '');

  try {
    const user = await requireAuth(req, supabase);
    const userId = user.id;

    if (path === '' || path === '/') {
      if (req.method === 'POST') return await handleCreate(req, supabase, userId);
      if (req.method === 'GET') return await handleGet(req, supabase, userId);
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Taste benchmark function error:', errorMessage);
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