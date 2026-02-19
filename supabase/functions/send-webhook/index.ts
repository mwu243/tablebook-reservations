import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const { slotId } = await req.json();
    if (!slotId) {
      return new Response(JSON.stringify({ error: 'slotId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

    // Get host's webhook URL
    const { data: hostProfile } = await adminClient
      .from('user_profiles')
      .select('webhook_url')
      .eq('user_id', user.id)
      .single();

    const webhookUrl = hostProfile?.webhook_url;
    if (!webhookUrl) {
      return new Response(JSON.stringify({ error: 'No webhook URL configured. Please set one in Webhook Settings.' }), {
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
      venmo_username: string | null;
      zelle_identifier: string | null;
    }> = [];
    let excludedCount = 0;

    for (const booking of (bookings || [])) {
      const profile = booking.user_id ? profilesMap[booking.user_id] : null;
      if (profile?.payment_sharing_consent) {
        consentedParticipants.push({
          name: booking.customer_name,
          email: booking.customer_email,
          venmo_username: profile.venmo_username,
          zelle_identifier: profile.zelle_identifier,
        });
      } else {
        excludedCount++;
      }
    }

    // Format time for payload
    const [hours, minutes] = slot.time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    const formattedTime = `${displayHour}:${minutes} ${ampm}`;

    const payload = {
      event_name: slot.name,
      event_date: slot.date,
      event_time: formattedTime,
      participants: consentedParticipants,
    };

    // Send webhook
    const webhookResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const success = webhookResponse.ok;

    return new Response(JSON.stringify({
      success,
      sent_count: consentedParticipants.length,
      excluded_count: excludedCount,
      webhook_status: webhookResponse.status,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
