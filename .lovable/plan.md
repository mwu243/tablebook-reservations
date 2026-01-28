
# Waitlist & Customer Cancellation Features

This plan adds two key features: (1) optional waitlist functionality when creating events, with automatic promotion and notifications when someone cancels, and (2) the ability for customers to cancel their own reservations from "My Reservations".

## Summary

**Feature 1 - Waitlist:**
- Add a toggle when creating events to enable/disable waitlist
- When enabled and a slot is fully booked, customers can join the waitlist
- When a booking is cancelled, the first person on the waitlist is automatically promoted and notified

**Feature 2 - Customer Cancellation:**
- Add a "Cancel Reservation" button to each upcoming booking in "My Reservations"
- Show confirmation dialog before cancelling
- Trigger waitlist promotion logic when a booking is cancelled

---

## Implementation Steps

### 1. Database Schema Changes

**Add waitlist columns to `availability_slots`:**
- `waitlist_enabled` (boolean, default false) - Whether waitlist is active for this slot

**Create new `waitlist_entries` table:**
- `id` (uuid, primary key)
- `slot_id` (uuid, foreign key to availability_slots)
- `user_id` (uuid, references auth.users)
- `customer_name` (text)
- `customer_email` (text)
- `customer_phone` (text, nullable) - For SMS/WhatsApp notifications
- `party_size` (integer)
- `position` (integer) - Queue position
- `created_at` (timestamp)
- `notified_at` (timestamp, nullable) - When they were notified of promotion

**Add RLS policies for waitlist_entries:**
- Users can view their own waitlist entries
- Users can insert their own waitlist entries
- Slot owners can view waitlist entries for their slots
- Slot owners can delete/update waitlist entries for their slots

**Add DELETE policy to bookings table:**
- Users can cancel (delete) their own bookings

### 2. Create Edge Function for Notifications

Create `notify-waitlist-promotion` edge function that:
- Accepts a booking ID and slot ID
- Fetches the next person on the waitlist
- Creates a confirmed booking for them
- Removes them from the waitlist
- Sends notification via email (using Resend)
- Optionally sends SMS/WhatsApp (future enhancement)

### 3. Create Database Function for Cancellation + Waitlist Promotion

Create `cancel_booking_with_waitlist` RPC function that:
- Verifies the user owns the booking
- Deletes the booking
- Decrements booked_tables on the slot
- If waitlist is enabled and has entries, calls promotion logic
- Returns success/failure status

### 4. Update Frontend Components

**AvailabilityManager.tsx:**
- Add "Enable Waitlist" toggle switch
- Pass `waitlist_enabled` when creating slots

**MyReservations.tsx:**
- Add "Cancel Reservation" button to each upcoming confirmed booking
- Show confirmation dialog with warning
- Call cancellation mutation
- Show success toast after cancellation

**BookingModal.tsx:**
- When slot is full but waitlist is enabled, show "Join Waitlist" option
- Different UI/messaging for joining waitlist vs booking

**SlotChip.tsx / AvailableSlots.tsx:**
- Show waitlist indicator when slot is full but waitlist is available
- Update button text: "Join Waitlist" instead of "Sold Out"

### 5. Create New Hooks

**useCancelBooking:**
- Mutation to cancel a booking
- Triggers waitlist promotion via edge function
- Invalidates relevant query caches

**useJoinWaitlist:**
- Mutation to add user to waitlist
- Creates entry with proper position

**useUserWaitlistEntries:**
- Query to fetch user's waitlist entries
- Display in "My Reservations" section

---

## Technical Details

### Database Migration SQL

```sql
-- Add waitlist_enabled to availability_slots
ALTER TABLE public.availability_slots 
ADD COLUMN waitlist_enabled boolean NOT NULL DEFAULT false;

-- Create waitlist_entries table
CREATE TABLE public.waitlist_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id uuid REFERENCES public.availability_slots(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_phone text,
  party_size integer NOT NULL,
  position integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  notified_at timestamptz
);

-- Index for efficient queries
CREATE INDEX idx_waitlist_entries_slot_id ON public.waitlist_entries(slot_id);
CREATE INDEX idx_waitlist_entries_user_id ON public.waitlist_entries(user_id);
CREATE INDEX idx_waitlist_entries_position ON public.waitlist_entries(slot_id, position);

-- Enable RLS
ALTER TABLE public.waitlist_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for waitlist_entries
CREATE POLICY "Users can view own waitlist entries"
ON public.waitlist_entries FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can join waitlist"
ON public.waitlist_entries FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave waitlist"
ON public.waitlist_entries FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Slot owners can view waitlist"
ON public.waitlist_entries FOR SELECT
TO authenticated
USING (is_slot_owner(slot_id));

CREATE POLICY "Slot owners can manage waitlist"
ON public.waitlist_entries FOR DELETE
TO authenticated
USING (is_slot_owner(slot_id));

-- Add DELETE policy to bookings for customer cancellation
CREATE POLICY "Users can cancel own bookings"
ON public.bookings FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Function to get next waitlist position
CREATE OR REPLACE FUNCTION public.get_next_waitlist_position(p_slot_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(MAX(position), 0) + 1
  FROM public.waitlist_entries
  WHERE slot_id = p_slot_id
$$;

-- Function to promote next waitlist entry
CREATE OR REPLACE FUNCTION public.promote_waitlist_entry(p_slot_id uuid)
RETURNS TABLE(
  entry_id uuid,
  customer_name text,
  customer_email text,
  customer_phone text,
  party_size integer,
  user_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_entry RECORD;
BEGIN
  -- Get the first person on the waitlist
  SELECT * INTO next_entry
  FROM public.waitlist_entries we
  WHERE we.slot_id = p_slot_id
  ORDER BY we.position ASC
  LIMIT 1;
  
  IF next_entry IS NULL THEN
    RETURN;
  END IF;
  
  -- Create booking for them
  INSERT INTO public.bookings (slot_id, user_id, customer_name, customer_email, party_size, status)
  VALUES (p_slot_id, next_entry.user_id, next_entry.customer_name, next_entry.customer_email, next_entry.party_size, 'confirmed');
  
  -- Remove from waitlist
  DELETE FROM public.waitlist_entries WHERE id = next_entry.id;
  
  -- Reorder remaining positions
  UPDATE public.waitlist_entries
  SET position = position - 1
  WHERE slot_id = p_slot_id AND position > next_entry.position;
  
  RETURN QUERY SELECT 
    next_entry.id,
    next_entry.customer_name,
    next_entry.customer_email,
    next_entry.customer_phone,
    next_entry.party_size,
    next_entry.user_id;
END;
$$;
```

### Edge Function: notify-waitlist-promotion

```typescript
// supabase/functions/notify-waitlist-promotion/index.ts
// Sends email notification when user is promoted from waitlist
// Uses Resend API for email delivery
// Future: Can add Twilio for SMS or WhatsApp
```

### Files to Create/Modify

| File | Changes |
|------|---------|
| `src/lib/types.ts` | Add `waitlist_enabled` to AvailabilitySlot, add WaitlistEntry type |
| `src/components/admin/AvailabilityManager.tsx` | Add waitlist toggle switch |
| `src/components/customer/MyReservations.tsx` | Add cancel button and confirmation dialog |
| `src/components/customer/BookingModal.tsx` | Add "Join Waitlist" flow when slot is full |
| `src/components/customer/SlotChip.tsx` | Update UI for waitlist-enabled full slots |
| `src/hooks/useAvailabilitySlots.ts` | Add `waitlist_enabled` to slot creation |
| `src/hooks/useUserBookings.ts` | Add cancellation mutation |
| `src/hooks/useWaitlist.ts` (new) | Waitlist join/leave/query hooks |
| `supabase/functions/notify-waitlist-promotion/index.ts` (new) | Notification edge function |

---

## User Experience Flow

### Creating an Event with Waitlist
1. User fills out event details
2. User toggles "Enable Waitlist" switch
3. Event is created with `waitlist_enabled: true`

### Customer Joining Waitlist
1. Customer selects a sold-out slot that has waitlist enabled
2. Sees "Join Waitlist" button instead of "Sold Out"
3. Fills out name/email/party size
4. Receives confirmation they're on the waitlist with their position

### Customer Cancelling Reservation
1. Customer goes to "My Reservations"
2. Clicks "Cancel" on an upcoming reservation
3. Sees confirmation dialog: "Are you sure you want to cancel?"
4. Confirms cancellation
5. Booking is removed, next waitlist person is promoted and notified

### Waitlist Promotion
1. When a booking is cancelled for a waitlist-enabled slot
2. System automatically promotes the first waitlist entry to confirmed
3. Sends email notification to the promoted customer
4. Other waitlist entries move up in position

---

## Notification Options

For the initial implementation, email notifications will be sent via Resend. The database stores `customer_phone` for future SMS/WhatsApp integration.

**Email notification includes:**
- Event name and details
- Confirmation that they've been promoted from the waitlist
- Date, time, and party size
- Link to view their reservation

**Future enhancements:**
- SMS notifications via Twilio
- WhatsApp notifications via Twilio WhatsApp API
- User preference for notification channel

---

## Security Considerations

- RLS ensures users can only cancel their own bookings
- `is_slot_owner()` function protects slot owner operations
- Waitlist entries are scoped to authenticated users
- Edge function validates requests and uses service role for promotions
- All database functions use `SECURITY DEFINER` with explicit `search_path`
