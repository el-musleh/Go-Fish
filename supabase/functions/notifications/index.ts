/**
 * Notifications Edge Function - handles /notifications/* endpoints
 * Note: SSE (real-time) is not supported in Edge Functions
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

async function getUserFromToken(req: Request, supabase: ReturnType<typeof createSupabaseClient>): Promise<{ id: string; email: string } | null> {
  const authHeader = req.headers.get('x-session-token');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  
  const decoded = decodeJwt(token);
  if (decoded && decoded.sub) {
    return { id: decoded.sub, email: decoded.email ?? '' };
  }
  
  try {
    const { data: { user } } = await supabase.auth.getUser(token);
    if (user) return { id: user.id, email: user.email ?? '' };
  } catch {
    // ignore
  }
  return null;
}

async function requireAuth(req: Request, supabase: ReturnType<typeof createSupabaseClient>) {
  const user = await getUserFromToken(req, supabase);
  if (!user) {
    throw new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  return user;
}

// GET /api/notifications - List notifications
async function handleGetNotifications(req: Request, supabase: ReturnType<typeof createSupabaseClient>, userId: string): Promise<Response> {
  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'));
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') ?? '10')));
  const offset = (page - 1) * limit;

  const { data: notifications, error } = await supabase
    .from('notification')
    .select('*')
    .eq('user_id', userId)
    .eq('expired', false)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const { count } = await supabase
    .from('notification')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('expired', false);

  return new Response(JSON.stringify({
    notifications: notifications ?? [],
    total: count ?? 0,
    page,
    limit,
    hasMore: (offset + (notifications?.length ?? 0)) < (count ?? 0),
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// GET /api/notifications/recent - Get recent unread
async function handleGetRecent(req: Request, supabase: ReturnType<typeof createSupabaseClient>, userId: string): Promise<Response> {
  const url = new URL(req.url);
  const limit = Math.min(5, Math.max(1, parseInt(url.searchParams.get('limit') ?? '5')));

  const { data: notifications } = await supabase
    .from('notification')
    .select('*')
    .eq('user_id', userId)
    .eq('read', false)
    .eq('expired', false)
    .order('created_at', { ascending: false })
    .limit(limit);

  const { count } = await supabase
    .from('notification')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false)
    .eq('expired', false);

  return new Response(JSON.stringify({
    notifications: notifications ?? [],
    unreadCount: count ?? 0,
    hasMore: (count ?? 0) > limit,
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// GET /api/notifications/unread-count
async function handleGetUnreadCount(req: Request, supabase: ReturnType<typeof createSupabaseClient>, userId: string): Promise<Response> {
  const { count } = await supabase
    .from('notification')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false)
    .eq('expired', false);

  return new Response(JSON.stringify({ count: count ?? 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// PATCH /api/notifications/:id/read
async function handleMarkRead(req: Request, supabase: ReturnType<typeof createSupabaseClient>, userId: string, id: string): Promise<Response> {
  const { data: notification } = await supabase.from('notification').select('user_id').eq('id', id).single();

  if (!notification || notification.user_id !== userId) {
    return new Response(JSON.stringify({ error: 'not_found', message: 'Notification not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const { error } = await supabase.from('notification').update({ read: true }).eq('id', id);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// POST /api/notifications/mark-all-read
async function handleMarkAllRead(req: Request, supabase: ReturnType<typeof createSupabaseClient>, userId: string): Promise<Response> {
  const { error } = await supabase.from('notification').update({ read: true }).eq('user_id', userId).eq('read', false);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// DELETE /api/notifications/:id
async function handleDelete(req: Request, supabase: ReturnType<typeof createSupabaseClient>, userId: string, id: string): Promise<Response> {
  const { error } = await supabase.from('notification').delete().eq('id', id).eq('user_id', userId);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// GET /api/notifications/preferences
async function handleGetPreferences(req: Request, supabase: ReturnType<typeof createSupabaseClient>, userId: string): Promise<Response> {
  const { data: prefs } = await supabase.from('user_preferences').select('*').eq('user_id', userId).single();

  return new Response(JSON.stringify({
    email_on_event_confirmed: prefs?.email_on_event_confirmed ?? true,
    email_on_new_rsvp: prefs?.email_on_new_rsvp ?? false,
    email_on_options_ready: prefs?.email_on_options_ready ?? false,
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// PATCH /api/notifications/preferences
async function handleUpdatePreferences(req: Request, supabase: ReturnType<typeof createSupabaseClient>, userId: string): Promise<Response> {
  const body = await req.json().catch(() => ({}));
  const updates: Record<string, boolean> = {};

  if (typeof body.email_on_event_confirmed === 'boolean') updates.email_on_event_confirmed = body.email_on_event_confirmed;
  if (typeof body.email_on_new_rsvp === 'boolean') updates.email_on_new_rsvp = body.email_on_new_rsvp;
  if (typeof body.email_on_options_ready === 'boolean') updates.email_on_options_ready = body.email_on_options_ready;

  // Upsert preferences
  const { data: prefs, error } = await supabase
    .from('user_preferences')
    .upsert({ user_id: userId, ...updates }, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({
    email_on_event_confirmed: prefs?.email_on_event_confirmed ?? true,
    email_on_new_rsvp: prefs?.email_on_new_rsvp ?? false,
    email_on_options_ready: prefs?.email_on_options_ready ?? false,
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createSupabaseClient(req);
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/notifications/, '');

  try {
    const user = await requireAuth(req, supabase);
    const userId = user.id;

    // Route: /stream - Not supported in Edge Functions
    if (path === '/stream') {
      return new Response(JSON.stringify({ error: 'SSE not supported in Edge Functions' }), { status: 501, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Route: /preferences
    if (path === '/preferences') {
      if (req.method === 'GET') return await handleGetPreferences(req, supabase, userId);
      if (req.method === 'PATCH') return await handleUpdatePreferences(req, supabase, userId);
    }

    // Route: /recent
    if (path === '/recent' && req.method === 'GET') {
      return await handleGetRecent(req, supabase, userId);
    }

    // Route: /unread-count
    if (path === '/unread-count' && req.method === 'GET') {
      return await handleGetUnreadCount(req, supabase, userId);
    }

    // Route: /mark-all-read
    if (path === '/mark-all-read' && req.method === 'POST') {
      return await handleMarkAllRead(req, supabase, userId);
    }

    // Route: /:id/read
    const readMatch = path.match(/^\/([^/]+)\/read$/);
    if (readMatch && req.method === 'PATCH') {
      return await handleMarkRead(req, supabase, userId, readMatch[1]);
    }

    // Route: /:id (DELETE)
    const deleteMatch = path.match(/^\/([^/]+)$/);
    if (deleteMatch && req.method === 'DELETE') {
      return await handleDelete(req, supabase, userId, deleteMatch[1]);
    }

    // Route: / (GET - list)
    if ((path === '' || path === '/') && req.method === 'GET') {
      return await handleGetNotifications(req, supabase, userId);
    }

    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Notifications function error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});