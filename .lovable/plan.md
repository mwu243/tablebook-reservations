

# Webhook Integration with Consent-Based Data Sharing

## Overview
Add a secure webhook system that lets event hosts manually send participant payment information (Name, Venmo/Zelle, Email) to a configurable bill-splitting app (e.g., Kanyon). Users must explicitly opt in during signup to allow their data to be shared.

---

## Part 1: Consent Checkbox During Signup

**What changes for users**: A new checkbox appears on the signup form saying something like:
> "I consent to sharing my name, email, and payment info (Venmo/Zelle) with event hosts for bill-splitting purposes."

The checkbox must be checked to create an account. This consent is stored securely in the database.

**Database change**: Add a `payment_sharing_consent` boolean column to the `user_profiles` table (default `false`).

**Files modified**:
- `src/pages/Auth.tsx` -- Add checkbox UI and validation (signup blocked if unchecked)
- `src/contexts/AuthContext.tsx` -- Pass consent flag through to profile creation

---

## Part 2: Webhook Configuration (Admin/Host Side)

**What changes for hosts**: A new "Webhook Settings" section in the host management area where they can:
1. Enter their Kanyon (or any) webhook URL
2. Save it securely

**Database change**: Add a `webhook_url` column to the `user_profiles` table (nullable text). This stores the host's configured webhook endpoint.

**RLS**: Already secured -- users can only update their own profile.

**Files modified**:
- `src/components/admin/ReservationsList.tsx` -- Add a "Webhook Settings" button/section
- New component: `src/components/admin/WebhookSettings.tsx` -- Modal/form for configuring webhook URL
- `src/hooks/useUserProfile.ts` -- Update types to include `webhook_url`

---

## Part 3: Manual Webhook Trigger

**What changes for hosts**: A "Send to Kanyon" (or "Send to Bill Splitter") button appears alongside the existing "Payment Info" button for each event. Clicking it sends participant data to the configured webhook URL.

**Security approach**: The webhook call is made from a backend function (Edge Function), NOT from the browser. This ensures:
- The webhook URL is never exposed to participants
- Only consented users' data is included
- The host's identity is verified server-side

**Data sent in the webhook** (JSON POST):
```json
{
  "event_name": "Dinner at Joe's",
  "event_date": "2026-02-20",
  "event_time": "6:00 PM",
  "participants": [
    {
      "name": "Jane Doe",
      "email": "jane@example.com",
      "venmo_username": "@janedoe",
      "zelle_identifier": null
    }
  ]
}
```
Only participants who have `payment_sharing_consent = true` are included. If a participant hasn't consented, they are excluded from the webhook payload (the host is informed).

**Files modified/created**:
- New Edge Function: `supabase/functions/send-webhook/index.ts`
- `supabase/config.toml` -- Register the new function
- `src/components/admin/ReservationsList.tsx` -- Add "Send to Bill Splitter" button
- New component: `src/components/admin/SendWebhookButton.tsx` -- Button with loading/success states

---

## Part 4: Security Measures

1. **Consent enforcement**: Only users who opted in have their data included in webhook payloads
2. **Server-side only**: The Edge Function fetches participant data using the service role key, verifies the caller owns the slot, and only then sends the webhook
3. **RLS on profiles**: Payment info columns are only readable by the user themselves (existing policy) and by the secure RPC function for slot owners
4. **Webhook URL validation**: Basic URL validation before saving
5. **No PII in logs**: The Edge Function avoids logging participant details

---

## Technical Details

### Database Migration
```sql
-- Add consent column to user_profiles
ALTER TABLE public.user_profiles
  ADD COLUMN payment_sharing_consent boolean NOT NULL DEFAULT false;

-- Add webhook_url column for hosts
ALTER TABLE public.user_profiles
  ADD COLUMN webhook_url text;
```

### New Edge Function: `send-webhook`
- Accepts: `{ slotId: string }` with auth header
- Verifies caller owns the slot via `is_slot_owner` check
- Fetches confirmed bookings for the slot
- Joins with `user_profiles` to get payment info and consent status
- Filters to only consented participants
- POSTs the payload to the host's configured `webhook_url`
- Returns success/failure and count of participants sent vs. excluded

### New RPC Function: `get_webhook_participant_data`
Similar to the existing `get_participant_payment_info` but also returns `payment_sharing_consent` so the Edge Function can filter appropriately. Alternatively, reuse the existing RPC and add the consent column to its return type.

### Auth.tsx Signup Changes
- New state: `const [consentChecked, setConsentChecked] = useState(false)`
- Validation: signup blocked if checkbox is unchecked
- Consent value passed through `signUp()` to profile creation

### File Summary

| File | Change |
|------|--------|
| Database migration | Add `payment_sharing_consent` and `webhook_url` columns to `user_profiles` |
| `src/pages/Auth.tsx` | Add consent checkbox to signup form |
| `src/contexts/AuthContext.tsx` | Pass `paymentSharingConsent` to profile insert |
| `src/hooks/useUserProfile.ts` | Update `UserProfile` type with new fields |
| `src/lib/types.ts` | Update `UserProfile` type with new fields |
| `supabase/functions/send-webhook/index.ts` | New Edge Function for secure webhook dispatch |
| `supabase/config.toml` | Register `send-webhook` function |
| `src/components/admin/WebhookSettings.tsx` | New modal for configuring webhook URL |
| `src/components/admin/SendWebhookButton.tsx` | New button component for triggering webhook |
| `src/components/admin/ReservationsList.tsx` | Add webhook button to each event card |

