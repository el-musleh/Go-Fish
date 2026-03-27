/**
 * API Gateway Edge Function
 * Routes all /api/* requests to the appropriate function
 * 
 * This is the main entry point - deploy as `api` function
 * Then configure custom domain or use Supabase's default URL
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FUNCTION_MAP: Record<string, string> = {
  '/auth': 'auth',
  '/events': 'events',
  '/invite': 'invite',
  '/taste-benchmark': 'taste-benchmark',
};

// Map responses to events function
const RESPONSE_FUNCTION = 'responses';
const NOTIFICATIONS_FUNCTION = 'notifications';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api/, '');

  // Find which function to route to
  let functionName: string | null = null;
  let functionPath = path;

  // Check for notifications
  if (path.startsWith('/notifications')) {
    functionName = NOTIFICATIONS_FUNCTION;
    functionPath = path.replace(/^\/notifications/, '');
  }
  // Check for events/:eventId/responses
  else if (path.match(/^\/events\/[^/]+\/responses/)) {
    functionName = RESPONSE_FUNCTION;
    functionPath = path.replace(/^\/events\/[^/]+\/responses/, '');
  }
  // Check other routes
  else {
    for (const [route, fn] of Object.entries(FUNCTION_MAP)) {
      if (path.startsWith(route)) {
        functionName = fn;
        functionPath = path.replace(route, '');
        break;
      }
    }
  }

  if (!functionName) {
    return new Response(JSON.stringify({ error: 'not_found', message: 'API endpoint not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Build the function URL
  // In production, use your Supabase project URL
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const functionUrl = `${supabaseUrl}/functions/v1/${functionName}`;

  // Forward the request to the appropriate function
  const forwardedReq = new Request(functionUrl + functionPath, {
    method: req.method,
    headers: {
      ...Object.fromEntries(req.headers.entries()),
      'Content-Type': 'application/json',
    },
    body: req.method !== 'GET' && req.method !== 'HEAD' ? await req.text() : undefined,
  });

  try {
    const response = await fetch(forwardedReq);
    
    // Get response body
    const responseText = await response.text();
    
    return new Response(responseText, {
      status: response.status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Gateway error:', errorMessage);
    return new Response(JSON.stringify({ 
      error: 'internal_error', 
      message: 'Failed to route request',
      details: errorMessage,
      hint: 'Check Supabase function logs for details'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});