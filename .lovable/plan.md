

## Email Notification System for Reservations

This plan implements automatic email notifications for two scenarios:
1. **Customer Confirmation**: When a user books a reservation, they receive a confirmation email
2. **Host Notification**: When someone books an event, the host receives an email alerting them

---

### Overview

We'll create a secure Edge Function that sends emails using **Resend** (an email delivery service). The function will be called after a successful booking or waitlist join.

---

### Prerequisites

Before implementation, you'll need to:
1. Sign up at [resend.com](https://resend.com) (free tier available)
2. Verify your email domain at [resend.com/domains](https://resend.com/domains)
3. Create an API key at [resend.com/api-keys](https://resend.com/api-keys)

---

### How It Works

```text
┌──────────────────┐
│  User Books Slot │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Frontend calls   │
│ Edge Function    │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Edge Function:   │
│ 1. Fetch slot    │
│    details       │
│ 2. Get host info │
│ 3. Send emails   │
│    via Resend    │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│ Email to Customer:                       │
│ "Your reservation is confirmed!"         │
│                                          │
│ Email to Host:                           │
│ "New booking for your event!"            │
└──────────────────────────────────────────┘
```

---

### What You'll See

**As a Customer:**
- After booking, you'll receive an email confirming your reservation with event details (name, date, time, party size)

**As a Host:**
- When someone books your event, you'll receive an email with the guest's name, email, and party size

---

### Technical Implementation

#### 1. Create Edge Function: `send-booking-notification`

A new backend function at `supabase/functions/send-booking-notification/index.ts` that:
- Accepts booking details (slot ID, customer info, booking type)
- Fetches the slot and host information from the database
- Sends two emails via Resend:
  - Confirmation to the customer
  - Notification to the host

#### 2. Update Booking Flow

Modify `src/hooks/useAvailabilitySlots.ts` (`useBookSlot`) to call the edge function after a successful booking.

Modify `src/hooks/useWaitlist.ts` (`useJoinWaitlist`) to call the edge function when someone joins a waitlist.

#### 3. Database Query for Host Email

The edge function will use the service role to:
- Join `availability_slots` → `auth.users` to get the host's email
- This is secure because edge functions run server-side with elevated permissions

---

### Email Templates

**Customer Confirmation Email:**
```
Subject: Reservation Confirmed - [Event Name]

Hi [Customer Name],

Your reservation has been confirmed!

Event: [Event Name]
Date: [Date]
Time: [Time]
Party Size: [Number] guests

We look forward to seeing you!
```

**Host Notification Email:**
```
Subject: New Reservation - [Event Name]

Hi,

You have a new reservation for your event!

Event: [Event Name]
Date: [Date]
Time: [Time]

Guest Details:
- Name: [Customer Name]
- Email: [Customer Email]
- Party Size: [Number] guests
```

---

### Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `supabase/functions/send-booking-notification/index.ts` | Create | Edge function to send emails |
| `supabase/config.toml` | Update | Register the new edge function |
| `src/hooks/useAvailabilitySlots.ts` | Update | Call edge function after booking |
| `src/hooks/useWaitlist.ts` | Update | Call edge function after waitlist join |

---

### Security Considerations

- The edge function uses the **service role** to access host email (stored in `auth.users`, not accessible from frontend)
- Customer email is passed from the frontend (already known to the user)
- The function validates the booking exists before sending
- CORS headers are properly configured

