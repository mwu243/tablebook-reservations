import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "resend";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface BookingNotificationRequest {
  slotId: string;
  customerName: string;
  customerEmail: string;
  partySize: number;
  bookingType: "booking" | "waitlist";
}

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const formatTime = (timeStr: string): string => {
  const [hours, minutes] = timeStr.split(":");
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
};

const handler = async (req: Request): Promise<Response> => {
  console.log("send-booking-notification: Received request");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase environment variables not configured");
    }

    const resend = new Resend(resendApiKey);
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { slotId, customerName, customerEmail, partySize, bookingType }: BookingNotificationRequest =
      await req.json();

    console.log("send-booking-notification: Processing", { slotId, customerEmail, bookingType });

    // Fetch slot details
    const { data: slot, error: slotError } = await supabase
      .from("availability_slots")
      .select("*")
      .eq("id", slotId)
      .single();

    if (slotError || !slot) {
      console.error("send-booking-notification: Slot not found", slotError);
      throw new Error("Slot not found");
    }

    console.log("send-booking-notification: Found slot", slot.name);

    // Fetch host email from auth.users using slot.user_id
    let hostEmail: string | null = null;
    if (slot.user_id) {
      const { data: hostUser, error: hostError } = await supabase.auth.admin.getUserById(slot.user_id);
      if (hostError) {
        console.error("send-booking-notification: Error fetching host", hostError);
      } else if (hostUser?.user) {
        hostEmail = hostUser.user.email || null;
        console.log("send-booking-notification: Found host email");
      }
    }

    const formattedDate = formatDate(slot.date);
    const formattedTime = formatTime(slot.time);
    const endTimeFormatted = slot.end_time ? ` - ${formatTime(slot.end_time)}` : "";

    const isWaitlist = bookingType === "waitlist";
    const customerSubject = isWaitlist
      ? `Waitlist Confirmed - ${slot.name}`
      : `Reservation Confirmed - ${slot.name}`;

    // Send customer confirmation email
    const customerEmailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
            .detail-row:last-child { border-bottom: none; }
            .label { color: #666; }
            .value { font-weight: 600; }
            .footer { text-align: center; color: #666; font-size: 14px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">${isWaitlist ? "You're on the Waitlist!" : "Reservation Confirmed!"}</h1>
            </div>
            <div class="content">
              <p>Hi ${customerName},</p>
              <p>${isWaitlist 
                ? "You've been added to the waitlist. We'll notify you if a spot becomes available!" 
                : "Your reservation has been confirmed! Here are the details:"}</p>
              
              <div class="details">
                <div class="detail-row">
                  <span class="label">Event</span>
                  <span class="value">${slot.name}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Date</span>
                  <span class="value">${formattedDate}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Time</span>
                  <span class="value">${formattedTime}${endTimeFormatted}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Party Size</span>
                  <span class="value">${partySize} ${partySize === 1 ? "guest" : "guests"}</span>
                </div>
              </div>
              
              <p>We look forward to seeing you!</p>
              
              <div class="footer">
                <p>If you need to cancel or modify your reservation, please contact the host.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    console.log("send-booking-notification: Sending customer email to", customerEmail);
    
    const { error: customerEmailError } = await resend.emails.send({
      from: "Reservations <onboarding@resend.dev>",
      to: [customerEmail],
      subject: customerSubject,
      html: customerEmailHtml,
    });

    if (customerEmailError) {
      console.error("send-booking-notification: Customer email failed", customerEmailError);
    } else {
      console.log("send-booking-notification: Customer email sent successfully");
    }

    // Send host notification email
    if (hostEmail) {
      const hostSubject = isWaitlist
        ? `New Waitlist Entry - ${slot.name}`
        : `New Reservation - ${slot.name}`;

      const hostEmailHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
              .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
              .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
              .detail-row:last-child { border-bottom: none; }
              .label { color: #666; }
              .value { font-weight: 600; }
              .guest-info { background: #e0e7ff; padding: 15px; border-radius: 8px; margin-top: 15px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">${isWaitlist ? "New Waitlist Entry" : "New Reservation"}</h1>
              </div>
              <div class="content">
                <p>Hi,</p>
                <p>You have a new ${isWaitlist ? "waitlist entry" : "reservation"} for your event!</p>
                
                <div class="details">
                  <div class="detail-row">
                    <span class="label">Event</span>
                    <span class="value">${slot.name}</span>
                  </div>
                  <div class="detail-row">
                    <span class="label">Date</span>
                    <span class="value">${formattedDate}</span>
                  </div>
                  <div class="detail-row">
                    <span class="label">Time</span>
                    <span class="value">${formattedTime}${endTimeFormatted}</span>
                  </div>
                </div>
                
                <div class="guest-info">
                  <h3 style="margin-top: 0;">Guest Details</h3>
                  <p><strong>Name:</strong> ${customerName}</p>
                  <p><strong>Email:</strong> ${customerEmail}</p>
                  <p style="margin-bottom: 0;"><strong>Party Size:</strong> ${partySize} ${partySize === 1 ? "guest" : "guests"}</p>
                </div>
              </div>
            </div>
          </body>
        </html>
      `;

      console.log("send-booking-notification: Sending host email");

      const { error: hostEmailError } = await resend.emails.send({
        from: "Reservations <onboarding@resend.dev>",
        to: [hostEmail],
        subject: hostSubject,
        html: hostEmailHtml,
      });

      if (hostEmailError) {
        console.error("send-booking-notification: Host email failed", hostEmailError);
      } else {
        console.log("send-booking-notification: Host email sent successfully");
      }
    } else {
      console.log("send-booking-notification: No host email found, skipping host notification");
    }

    return new Response(
      JSON.stringify({ success: true, message: "Notification emails sent" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    console.error("send-booking-notification: Error", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
