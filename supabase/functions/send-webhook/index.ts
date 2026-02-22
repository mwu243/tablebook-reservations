import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

function isPrivateOrLocalHost(hostname: string): boolean {
  if (['localhost', '0.0.0.0', '::1'].includes(hostname)) return true;
  if (hostname.startsWith('127.')) return true;
  const ipv4Match = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipv4Match) {
    const [, a, b] = ipv4Match.map(Number);
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
  }
  if (hostname.startsWith('fc') || hostname.startsWith('fd') || hostname.startsWith('fe80')) return true;
  return false;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SendWebhookSchema = z.object({
  slotId: z.string().uuid(),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // User client to verify identity
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Input validation
    const rawBody = await req.json();
    const validation = SendWebhookSchema.safeParse(rawBody);
    if (!validation.success) {
      return new Response(JSON.stringify({ error: 'Invalid input' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { slotId } = validation.data;

    // Service client for privileged queries
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Verify slot ownership
    const { data: slot, error: slotError } = await adminClient
      .from('availability_slots')
      .select('id, name, date, time, user_id')
      .eq('id', slotId)
      .single();

    if (slotError || !slot) {
      return new Response(JSON.stringify({ error: 'Slot not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (slot.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized: not slot owner' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get host's webhook URL and profile info
    const { data: hostProfile } = await adminClient
      .from('user_profiles')
      .select('webhook_url, venmo_username, zelle_identifier, display_name')
      .eq('user_id', user.id)
      .single();

    const webhookUrl = hostProfile?.webhook_url;
    if (!webhookUrl) {
      return new Response(JSON.stringify({ error: 'No webhook URL configured. Please set one in Webhook Settings.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate webhook URL to prevent SSRF
    try {
      const parsed = new URL(webhookUrl);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return new Response(JSON.stringify({ error: 'Invalid webhook URL protocol' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (isPrivateOrLocalHost(parsed.hostname)) {
        return new Response(JSON.stringify({ error: 'Invalid webhook URL' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid webhook URL format' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get confirmed bookings with payment info and consent
    const { data: bookings, error: bookingsError } = await adminClient
      .from('bookings')
      .select('customer_name, customer_email, party_size, user_id')
      .eq('slot_id', slotId)
      .eq('status', 'confirmed');

    if (bookingsError) {
      return new Response(JSON.stringify({ error: 'Failed to fetch bookings' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get profiles for all booked users
    const userIds = (bookings || []).map(b => b.user_id).filter(Boolean);
    let profilesMap: Record<string, { venmo_username: string | null; zelle_identifier: string | null; payment_sharing_consent: boolean }> = {};

    if (userIds.length > 0) {
      const { data: profiles } = await adminClient
        .from('user_profiles')
        .select('user_id, venmo_username, zelle_identifier, payment_sharing_consent')
        .in('user_id', userIds);

      if (profiles) {
        profiles.forEach(p => {
          profilesMap[p.user_id] = {
            venmo_username: p.venmo_username,
            zelle_identifier: p.zelle_identifier,
            payment_sharing_consent: p.payment_sharing_consent ?? false,
          };
        });
      }
    }

    // Build payload — only include consented participants
    const consentedParticipants: Array<{
      name: string;
      email: string;
      venmo: string | null;
      zelle: string | null;
    }> = [];
    let excludedCount = 0;

    for (const booking of (bookings || [])) {
      const profile = booking.user_id ? profilesMap[booking.user_id] : null;
      if (profile?.payment_sharing_consent) {
        consentedParticipants.push({
          name: booking.customer_name,
          email: booking.customer_email,
          venmo: profile.venmo_username,
          zelle: profile.zelle_identifier,
        });
      } else {
        excludedCount++;
      }
    }

    const payload = {
      host: {
        email: user.email,
        name: hostProfile?.display_name || user.user_metadata?.display_name || undefined,
        venmo: hostProfile?.venmo_username || undefined,
        zelle: hostProfile?.zelle_identifier || undefined,
      },
      participants: consentedParticipants.map(p => ({
        email: p.email,
        name: p.name || undefined,
        venmo: p.venmo || undefined,
        zelle: p.zelle || undefined,
      })),
      restaurant_name: slot.name,
    };

    // Send webhook with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const webhookSecret = Deno.env.get('KANYON_WEBHOOK_SECRET');

    console.log('Sending webhook to:', webhookUrl);
    console.log('Payload:', JSON.stringify(payload));

    let webhookResponse: Response;
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (webhookSecret) {
        headers['X-Webhook-Secret'] = webhookSecret;
      }

      webhookResponse = await fetch(webhookUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (fetchErr) {
      console.error('Webhook fetch failed:', fetchErr);
      return new Response(JSON.stringify({ 
        error: `Webhook request failed: ${fetchErr instanceof Error ? fetchErr.message : 'Unknown error'}` 
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    clearTimeout(timeoutId);

    const responseBody = await webhookResponse.text();
    console.log('Webhook response status:', webhookResponse.status);
    console.log('Webhook response body:', responseBody);

    const success = webhookResponse.ok;

    return new Response(JSON.stringify({
      success,
      sent_count: consentedParticipants.length,
      excluded_count: excludedCount,
      webhook_status: webhookResponse.status,
      webhook_response: success ? undefined : responseBody,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Send-webhook error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
