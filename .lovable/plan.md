

## Problem 1: Calendar not updating after editing an event date

The `useUpdateAvailabilitySlot` mutation invalidates some query caches on success, but it's missing two key ones:
- `upcoming-events-with-hosts` (used by the "Book a Table" upcoming events list)
- `upcoming-slots` (used by the all upcoming slots query)

This means when you change the date of an event, the "Book a Table" tab still shows stale data until the next automatic refetch (10-30 seconds later).

**Fix:** Add the missing cache invalidation keys to the `onSuccess` callback in `useUpdateAvailabilitySlot`.

## Problem 2: Notify participants when an event is changed

Currently, no notification is sent when a host edits an event. We need to:

1. **Extend the `send-booking-notification` edge function** to handle a new `bookingType: "event_update"` that:
   - Fetches all confirmed bookings and waitlist entries for the slot
   - Sends each participant an "Event Updated" email with the new details (date, time, location, etc.)
   - Sends updated .ics calendar files to confirmed participants

2. **Trigger the notification from `EditSlotModal`** after a successful update by calling the edge function with the slot ID and the new `event_update` type.

---

### Technical Details

**File: `src/hooks/useAvailabilitySlots.ts`**
- In `useUpdateAvailabilitySlot`'s `onSuccess`, add invalidation for `['upcoming-events-with-hosts']` and `['upcoming-slots']`

**File: `supabase/functions/send-booking-notification/index.ts`**
- Add `"event_update"` to the `bookingType` enum in the validation schema
- Make `customerName`, `customerEmail`, and `partySize` optional when `bookingType` is `"event_update"`
- Add a new code path for `event_update` that:
  - Fetches all confirmed bookings for the slot (using service role)
  - Fetches all waitlist entries for the slot
  - Sends each person an "Event Updated" email with the new event details and an updated .ics file for confirmed participants

**File: `src/components/admin/EditSlotModal.tsx`**
- After a successful `updateSlot.mutateAsync()`, fire-and-forget call to `supabase.functions.invoke('send-booking-notification', { body: { slotId, bookingType: 'event_update' } })` to notify all participants

