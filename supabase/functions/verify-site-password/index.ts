const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// In-memory rate limiting (per isolate instance)
const attemptTracker = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function getClientIP(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('cf-connecting-ip') ||
    'unknown';
}

function checkRateLimit(ip: string): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const record = attemptTracker.get(ip);

  if (record && now < record.resetAt) {
    if (record.count >= MAX_ATTEMPTS) {
      return { allowed: false, retryAfterSeconds: Math.ceil((record.resetAt - now) / 1000) };
    }
    record.count++;
    return { allowed: true };
  }

  // Reset or create new window
  attemptTracker.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  return { allowed: true };
}

function clearAttempts(ip: string) {
  attemptTracker.delete(ip);
}

const SITE_PASSWORD = Deno.env.get('SITE_PASSWORD');
if (!SITE_PASSWORD) {
  console.error('SITE_PASSWORD environment variable is not configured');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!SITE_PASSWORD) {
      return new Response(JSON.stringify({ success: false, error: 'Server configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const clientIP = getClientIP(req);
    const rateCheck = checkRateLimit(clientIP);

    if (!rateCheck.allowed) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: `Too many attempts. Try again in ${Math.ceil((rateCheck.retryAfterSeconds || 900) / 60)} minutes.` 
      }), {
        status: 429,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Retry-After': String(rateCheck.retryAfterSeconds || 900),
        },
      });
    }

    const { password } = await req.json();

    if (!password || typeof password !== 'string') {
      return new Response(JSON.stringify({ success: false, error: 'Password is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (password === SITE_PASSWORD) {
      clearAttempts(clientIP);
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.warn(`Failed site password attempt from IP: ${clientIP}`);

    return new Response(JSON.stringify({ success: false, error: 'Incorrect password' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ success: false, error: 'Invalid request' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
