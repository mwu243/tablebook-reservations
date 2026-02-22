import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "resend";
import { encode } from "https://deno.land/std@0.190.0/encoding/base64.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BookingNotificationSchema = z.object({
  slotId: z.string().uuid(),
  customerName: z.string().min(1).max(200),
  customerEmail: z.string().email().max(255),
  partySize: z.number().int().positive().max(100),
  bookingType: z.enum(["booking", "waitlist", "promotion"]),
  bookingId: z.string().uuid().optional(),
});

// --- Date formatting and ICS generation ---
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

const formatICSDate = (dateStr: string, timeStr: string): string => {
  const [hours, minutes] = timeStr.split(":");
  const dateObj = new Date(`${dateStr}T${hours}:${minutes}:00`);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${dateObj.getFullYear()}${pad(dateObj.getMonth() + 1)}${pad(dateObj.getDate())}T${pad(dateObj.getHours())}${pad(dateObj.getMinutes())}00`;
};

const escapeICSText = (text: string): string => {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
};

const generateICSContent = (
  slot: { name: string; date: string; time: string; end_time?: string | null; description?: string | null; location?: string | null },
  bookingId: string,
  partySize: number
): string => {
  const dtStart = formatICSDate(slot.date, slot.time);
  
  let dtEnd: string;
  if (slot.end_time) {
    dtEnd = formatICSDate(slot.date, slot.end_time);
  } else {
    const [hours, minutes] = slot.time.split(":");
    const endHour = (parseInt(hours) + 2).toString().padStart(2, "0");
    dtEnd = formatICSDate(slot.date, `${endHour}:${minutes}`);
  }

  const now = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  
  const description = slot.description 
    ? `${escapeICSText(slot.description)}\\n\\nParty of ${partySize} guest${partySize === 1 ? "" : "s"}.`
    : `Party of ${partySize} guest${partySize === 1 ? "" : "s"}. Hosted SGD event.`;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SGD Reservations//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:booking-${bookingId}@sgd.app`,
    `DTSTAMP:${now}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeICSText(slot.name)}`,
    `DESCRIPTION:${description}`,
  ];

  if (slot.location) {
    lines.push(`LOCATION:${escapeICSText(slot.location)}`);
  }

  lines.push("STATUS:CONFIRMED", "END:VEVENT", "END:VCALENDAR");

  return lines.join("\r\n");
};

const handler = async (req: Request): Promise<Response> => {
  console.log("send-booking-notification: Received request");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- Authentication check ---
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- Input validation ---
    const rawBody = await req.json();
    const validation = BookingNotificationSchema.safeParse(rawBody);
    if (!validation.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid input' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { slotId, customerName, customerEmail, partySize, bookingType, bookingId } = validation.data;

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase environment variables not configured");
    }

    const resend = new Resend(resendApiKey);
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
    const isPromotion = bookingType === "promotion";

    // Generate ICS for confirmed bookings and promotions
    let icsAttachment: { filename: string; content: string }[] = [];
    
    if (!isWaitlist) {
      const eventId = bookingId || `${slotId}-${Date.now()}`;
      const icsContent = generateICSContent(slot, eventId, partySize);
      const safeFilename = slot.name.replace(/[^a-zA-Z0-9\s-]/g, "").replace(/\s+/g, "-");
      icsAttachment = [{
        filename: `${safeFilename}.ics`,
        content: encode(new TextEncoder().encode(icsContent)),
      }];
    }

    let customerSubject: string;
    let customerHeading: string;
    let customerMessage: string;

    if (isPromotion) {
      customerSubject = `Good News! You've Got a Spot - ${slot.name}`;
      customerHeading = "You've Been Upgraded!";
      customerMessage = "Great news! A spot has opened up and you've been moved from the waitlist to a confirmed reservation. Here are your details:";
    } else if (isWaitlist) {
      customerSubject = `Waitlist Confirmed - ${slot.name}`;
      customerHeading = "You're on the Waitlist!";
      customerMessage = "You've been added to the waitlist. We'll notify you if a spot becomes available!";
    } else {
      customerSubject = `Reservation Confirmed - ${slot.name}`;
      customerHeading = "Reservation Confirmed!";
      customerMessage = "Your reservation has been confirmed! Here are the details:";
    }

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
            .calendar-note { background: #e0e7ff; padding: 15px; border-radius: 8px; margin-top: 20px; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">${customerHeading}</h1>
            </div>
            <div class="content">
              <p>Hi ${customerName},</p>
              <p>${customerMessage}</p>
              
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
              
              ${!isWaitlist ? `
              <div class="calendar-note">
                <p style="margin: 0;"><strong>📅 Calendar Invite Attached</strong></p>
                <p style="margin: 5px 0 0 0; font-size: 14px;">Open the attached .ics file to add this event to your calendar.</p>
              </div>
              ` : ""}
              
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
    
    const emailPayload: {
      from: string;
      to: string[];
      subject: string;
      html: string;
      attachments?: { filename: string; content: string }[];
    } = {
      from: "Reservations <onboarding@resend.dev>",
      to: [customerEmail],
      subject: customerSubject,
      html: customerEmailHtml,
    };

    if (icsAttachment.length > 0) {
      emailPayload.attachments = icsAttachment;
    }

    const { error: customerEmailError } = await resend.emails.send(emailPayload);

    if (customerEmailError) {
      console.error("send-booking-notification: Customer email failed", customerEmailError);
    } else {
      console.log("send-booking-notification: Customer email sent successfully");
    }

    // Send host notification email (skip for promotions since the host already knows)
    if (hostEmail && !isPromotion) {
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
    } else if (!hostEmail) {
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
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
