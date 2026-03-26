/**
 * Responses Edge Function - handles POST/GET /api/events/:eventId/responses
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function createSupabaseClient(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  return createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });
}

async function getUserFromToken(req: Request, supabase: ReturnType<typeof createSupabaseClient>): Promise<{ id: string; email: string } | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const { data: { user } } = await supabase.auth.getUser(token);
  return user ? { id: user.id, email: user.email ?? '' } : null;
}

async function requireAuth(req: Request, supabase: ReturnType<typeof createSupabaseClient>) {
  const user = await getUserFromToken(req, supabase);
  if (!user) {
    throw new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  return user;
}

// POST /api/events/:eventId/responses - Submit response
async function handleCreateResponse(req: Request, supabase: ReturnType<typeof createSupabaseClient>, eventId: string): Promise<Response> {
  const user = await requireAuth(req, supabase);
  const body = await req.json();
  const { available_dates } = body;

  // Validate dates
  if (!available_dates || !Array.isArray(available_dates) || available_dates.length === 0) {
    return new Response(JSON.stringify({ error: 'invalid_dates', message: 'At least one available date is required.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  for (const entry of available_dates) {
    if (typeof entry !== 'object' || !entry.date || !entry.start_time || !entry.end_time) {
      return new Response(JSON.stringify({ error: 'invalid_dates', message: 'Each date must include date, start_time, and end_time.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!dateRegex.test(entry.date) || !timeRegex.test(entry.start_time) || !timeRegex.test(entry.end_time)) {
      return new Response(JSON.stringify({ error: 'invalid_dates', message: 'Date must be YYYY-MM-DD, times must be HH:MM.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (entry.start_time >= entry.end_time) {
      return new Response(JSON.stringify({ error: 'invalid_dates', message: 'start_time must be before end_time.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  // Check event exists
  const { data: event } = await supabase.from('event').select('*').eq('id', eventId).single();
  if (!event) {
    return new Response(JSON.stringify({ error: 'not_found', message: 'Event not found.' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Check response window
  if (new Date() > new Date(event.response_window_end)) {
    return new Response(JSON.stringify({ error: 'window_closed', message: 'The response period for this event has ended.' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Check existing response
  const { data: existing } = await supabase.from('response').select('*').eq('event_id', eventId).eq('invitee_id', user.id).single();
  if (existing) {
    return new Response(JSON.stringify({ error: 'duplicate_response', message: 'You have already submitted a response for this event.' }), {
      status: 409,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Check taste benchmark
  const { data: benchmark } = await supabase.from('taste_benchmark').select('id').eq('user_id', user.id).single();
  if (!benchmark) {
    return new Response(JSON.stringify({ error: 'taste_benchmark_required', message: 'Please complete taste benchmark first.' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Create response
  const { data: response, error } = await supabase
    .from('response')
    .insert({ event_id: eventId, invitee_id: user.id, available_dates })
    .select()
    .single();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(response), {
    status: 201,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// GET /api/events/:eventId/responses - Get all responses (inviter only)
async function handleGetResponses(req: Request, supabase: ReturnType<typeof createSupabaseClient>, eventId: string): Promise<Response> {
  const user = await requireAuth(req, supabase);

  const { data: event } = await supabase.from('event').select('inviter_id').eq('id', eventId).single();
  if (!event) {
    return new Response(JSON.stringify({ error: 'not_found', message: 'Event not found.' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (event.inviter_id !== user.id) {
    return new Response(JSON.stringify({ error: 'forbidden', message: 'Only the event inviter can view responses.' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: responses, error } = await supabase.from('response').select('*').eq('event_id', eventId);
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(responses ?? []), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createSupabaseClient(req);
  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);

  // Expect: /responses or /events/{eventId}/responses
  let eventId: string | null = null;
  if (pathParts[0] === 'events' && pathParts[2] === 'responses') {
    eventId = pathParts[1];
  }

  if (!eventId) {
    return new Response(JSON.stringify({ error: 'Invalid endpoint' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    if (req.method === 'POST') return await handleCreateResponse(req, supabase, eventId);
    if (req.method === 'GET') return await handleGetResponses(req, supabase, eventId);

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Responses function error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});