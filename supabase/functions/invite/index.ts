/**
 * Invite Edge Function - handles /invite/:token endpoint (public, no auth)
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
  return createClient(supabaseUrl, supabaseServiceKey);
}

// GET /api/invite/:token - Resolve invitation token to event
async function handleResolveInvite(req: Request, supabase: ReturnType<typeof createSupabaseClient>, token: string): Promise<Response> {
  // Look up invitation link
  const { data: link, error } = await supabase
    .from('invitation_link')
    .select('event_id')
    .eq('token', token)
    .single();

  if (error || !link) {
    return new Response(JSON.stringify({ error: 'invalid_link', message: 'This invitation link is not valid.' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Get event details
  const { data: event, error: eventError } = await supabase
    .from('event')
    .select('id, title, description, status, inviter_id')
    .eq('id', link.event_id)
    .single();

  if (eventError || !event) {
    return new Response(JSON.stringify({ error: 'not_found', message: 'Event not found.' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Check for authenticated user via header
  const userId = req.headers.get('x-user-id');

  if (!userId) {
    return new Response(JSON.stringify({
      error: 'auth_required',
      message: 'Please log in to respond to this invitation.',
      redirect: `/?auth=1&returnTo=/invite/${token}`,
      eventId: event.id,
    }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({
    eventId: event.id,
    title: event.title,
    description: event.description,
    status: event.status,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createSupabaseClient(req);
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/invite\//, '');

  try {
    if (path) {
      return await handleResolveInvite(req, supabase, path);
    }

    return new Response(JSON.stringify({ error: 'Invalid endpoint' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Invite function error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});