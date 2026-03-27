/**
 * Events Edge Function - handles all /events/* endpoints
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const KNOWN_CITIES: Record<string, { lat: number; lng: number }> = {
  berlin: { lat: 52.52, lng: 13.405 },
  hamburg: { lat: 53.5511, lng: 9.9937 },
  münchen: { lat: 48.1351, lng: 11.582 },
  munich: { lat: 48.1351, lng: 11.582 },
  köln: { lat: 50.9375, lng: 6.9603 },
  cologne: { lat: 50.9375, lng: 6.9603 },
  frankfurt: { lat: 50.1109, lng: 8.6821 },
  wien: { lat: 48.2082, lng: 16.3738 },
  vienna: { lat: 48.2082, lng: 16.3738 },
  zürich: { lat: 47.3769, lng: 8.5417 },
  zurich: { lat: 47.3769, lng: 8.5417 },
};

function createSupabaseClient(req: Request): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function getUserFromToken(req: Request, supabase: SupabaseClient): Promise<{ id: string; email: string } | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const { data: { user } } = await supabase.auth.getUser(token);
  return user ? { id: user.id, email: user.email ?? '' } : null;
}

async function requireAuth(req: Request, supabase: SupabaseClient) {
  const user = await getUserFromToken(req, supabase);
  if (!user) {
    throw new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  return user;
}

// POST /api/events - Create event
async function handleCreateEvent(req: Request, supabase: SupabaseClient): Promise<Response> {
  const user = await requireAuth(req, supabase);
  const body = await req.json();
  
  const { title, description, location_city, location_country, location_lat, location_lng, timeout_hours, preferred_date, preferred_time, duration_minutes } = body;
  
  if (!title?.trim()) {
    return new Response(JSON.stringify({ error: 'missing_fields', fields: ['title'] }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  const hours = typeof timeout_hours === 'number' && timeout_hours > 0 ? timeout_hours : 24;
  const now = new Date();
  const responseWindowEnd = new Date(now.getTime() + hours * 60 * 60 * 1000);
  
  // Auto-geocode
  let lat = location_lat ?? null;
  let lng = location_lng ?? null;
  if (!lat && !lng && location_city) {
    const known = KNOWN_CITIES[location_city.toLowerCase().trim()];
    if (known) { lat = known.lat; lng = known.lng; }
  }
  
  const { data: event, error } = await supabase
    .from('event')
    .insert({
      inviter_id: user.id,
      title: title.trim(),
      description: description?.trim() ?? '',
      response_window_end: responseWindowEnd.toISOString(),
      location_city: location_city ?? null,
      location_country: location_country ?? null,
      location_lat: lat,
      location_lng: lng,
      preferred_date: preferred_date ?? null,
      preferred_time: preferred_time ?? null,
      duration_minutes: duration_minutes ?? null,
    })
    .select()
    .single();
  
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  return new Response(JSON.stringify(event), {
    status: 201,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// GET /api/events - List user's events
async function handleGetEvents(req: Request, supabase: SupabaseClient): Promise<Response> {
  const user = await requireAuth(req, supabase);
  
  const { data: created } = await supabase
    .from('event')
    .select('*')
    .eq('inviter_id', user.id)
    .order('created_at', { ascending: false });
  
  const { data: responses } = await supabase
    .from('response')
    .select('event_id')
    .eq('invitee_id', user.id);
  
  const joinedIds = [...new Set((responses ?? []).map(r => r.event_id).filter(id => !created?.some(e => e.id === id)))];
  
  let joined: any[] = [];
  if (joinedIds.length > 0) {
    const { data } = await supabase.from('event').select('*').in('id', joinedIds).order('created_at', { ascending: false });
    joined = data ?? [];
  }
  
  // Get responses count for created events
  const eventIds = [...new Set([...(created ?? []).map(e => e.id), ...joined.map(e => e.id)])];
  let responsesMap: Record<string, number> = {};
  if (eventIds.length > 0) {
    const { data: responsesData } = await supabase.from('response').select('event_id').in('event_id', eventIds);
    responsesData?.forEach(r => { responsesMap[r.event_id] = (responsesMap[r.event_id] ?? 0) + 1; });
  }
  
  // Get inviter emails
  const inviterIds = [...new Set([...(created ?? []), ...joined].map(e => e.inviter_id))];
  const { data: users } = await supabase.from('user').select('id, email').in('id', inviterIds);
  const userMap = new Map((users ?? []).map(u => [u.id, u.email]));
  
  const formatEvent = (e: any) => ({
    ...e,
    respondent_count: responsesMap[e.id] ?? 0,
    selected_activity: e.status === 'finalized' ? null : null,
    inviter_email: userMap.get(e.inviter_id),
  });
  
  return new Response(JSON.stringify({
    created: (created ?? []).map(formatEvent),
    joined: joined.map(formatEvent),
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

// GET /api/events/:eventId
async function handleGetEvent(req: Request, supabase: SupabaseClient, eventId: string): Promise<Response> {
  const { data: event, error } = await supabase.from('event').select('*').eq('id', eventId).single();
  
  if (error || !event) {
    return new Response(JSON.stringify({ error: 'not_found', message: 'Event not found.' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  const { data: inviter } = await supabase.from('user').select('email').eq('id', event.inviter_id).single();
  
  return new Response(JSON.stringify({ ...event, inviter_email: inviter?.email }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

// POST /api/events/:eventId/link
async function handleCreateLink(req: Request, supabase: SupabaseClient, eventId: string): Promise<Response> {
  const user = await requireAuth(req, supabase);
  
  const { data: event } = await supabase.from('event').select('*').eq('id', eventId).single();
  
  if (!event) {
    return new Response(JSON.stringify({ error: 'not_found', message: 'Event not found.' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  if (event.inviter_id !== user.id) {
    return new Response(JSON.stringify({ error: 'forbidden', message: 'Only the organizer can create links.' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  // Check for existing link
  const { data: existing } = await supabase.from('invitation_link').select('*').eq('event_id', eventId).single();
  if (existing) {
    return new Response(JSON.stringify({ token: existing.token, link: `/api/invite/${existing.token}` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  const token = crypto.randomUUID();
  const { data: link, error } = await supabase
    .from('invitation_link')
    .insert({ event_id: eventId, token })
    .select()
    .single();
  
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  return new Response(JSON.stringify({ token: link.token, link: `/api/invite/${link.token}` }), {
    status: 201,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// DELETE /api/events/:eventId
async function handleDeleteEvent(req: Request, supabase: SupabaseClient, eventId: string): Promise<Response> {
  const user = await requireAuth(req, supabase);
  
  const { data: event } = await supabase.from('event').select('*').eq('id', eventId).single();
  
  if (!event) {
    return new Response(JSON.stringify({ error: 'not_found', message: 'Event not found.' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  if (event.inviter_id !== user.id) {
    return new Response(JSON.stringify({ error: 'forbidden', message: 'Only the inviter can delete this event.' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  const { error } = await supabase.from('event').delete().eq('id', eventId);
  
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  return new Response(JSON.stringify({ deleted: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// GET /api/events/:eventId/options
async function handleGetOptions(req: Request, supabase: SupabaseClient, eventId: string): Promise<Response> {
  const { data: options, error } = await supabase
    .from('activity_option')
    .select('*')
    .eq('event_id', eventId)
    .order('rank');
  
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  const unique = options?.filter((o, i, arr) => arr.findIndex(x => x.rank === o.rank) === i).slice(0, 3) ?? [];
  
  return new Response(JSON.stringify({ options: unique }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// POST /api/events/:eventId/select
async function handleSelectOption(req: Request, supabase: SupabaseClient, eventId: string): Promise<Response> {
  const user = await requireAuth(req, supabase);
  const body = await req.json();
  const { activityOptionId } = body;
  
  if (!activityOptionId) {
    return new Response(JSON.stringify({ error: 'missing_fields', message: 'activityOptionId is required.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  const { data: event } = await supabase.from('event').select('*').eq('id', eventId).single();
  
  if (!event) {
    return new Response(JSON.stringify({ error: 'not_found', message: 'Event not found.' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  if (event.inviter_id !== user.id) {
    return new Response(JSON.stringify({ error: 'forbidden', message: 'Only the inviter can select an activity.' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  if (event.status === 'finalized') {
    return new Response(JSON.stringify({ error: 'already_finalized', message: 'An activity has already been selected.' }), {
      status: 409,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  // Update option as selected and finalize event
  await supabase.from('activity_option').update({ is_selected: true }).eq('id', activityOptionId);
  const { data: updatedEvent } = await supabase.from('event').update({ status: 'finalized' }).eq('id', eventId).select().single();
  
  return new Response(JSON.stringify({ event: updatedEvent }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  const supabase = createSupabaseClient(req);
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/events/, '');
  const eventIdMatch = path.match(/^\/([^/]+)/);
  const eventId = eventIdMatch ? eventIdMatch[1] : null;
  
  try {
    // Routes without eventId
    if (path === '' || path === '/') {
      if (req.method === 'GET') return await handleGetEvents(req, supabase);
      if (req.method === 'POST') return await handleCreateEvent(req, supabase);
    }
    
    // Routes with eventId
    if (eventId) {
      const basePath = path.replace(`/${eventId}`, '');
      
      if (basePath === '' || basePath === '/') {
        if (req.method === 'GET') return await handleGetEvent(req, supabase, eventId);
        if (req.method === 'DELETE') return await handleDeleteEvent(req, supabase, eventId);
      }
      
      if (basePath === '/link' && req.method === 'POST') {
        return await handleCreateLink(req, supabase, eventId);
      }
      
      if (basePath === '/options' && req.method === 'GET') {
        return await handleGetOptions(req, supabase, eventId);
      }
      
      if (basePath === '/select' && req.method === 'POST') {
        return await handleSelectOption(req, supabase, eventId);
      }
    }
    
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Events function error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});