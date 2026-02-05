

# Implementation Plan: Four Feature Updates

## Overview
This plan addresses four feature requests to improve the reservation system's usability and functionality.

---

## Feature 1: Default Party Size to 1 (Not 2)

**Current Behavior**: The party size defaults to 2 guests when opening the booking flow.

**Change Required**: Update the initial state in `CustomerView.tsx` from `useState(2)` to `useState(1)`.

**File**: `src/components/customer/CustomerView.tsx`
- Line 22: Change `const [partySize, setPartySize] = useState(2);` to `useState(1)`

---

## Feature 2: Add Calendar Invite (.ics) to Confirmation Emails

**Current Behavior**: Confirmation emails are sent without calendar attachments. Users can manually download .ics files from the "My Reservations" page.

**Change Required**: Generate and attach an .ics file directly in the confirmation email so users can add events to their calendar with one click.

**Technical Approach**:
1. Add ICS generation logic to the Edge Function (port the logic from `src/lib/icsGenerator.ts`)
2. Attach the .ics file to the customer confirmation email using Resend's attachment API

**File**: `supabase/functions/send-booking-notification/index.ts`
- Add ICS generation functions (`formatICSDate`, `escapeICSText`, `generateICSContent`)
- Modify the customer email send call to include an attachment:
  ```typescript
  attachments: [{
    filename: 'event.ics',
    content: Buffer.from(icsContent).toString('base64'),
    contentType: 'text/calendar',
  }]
  ```

**Note**: The .ics attachment will only be added for confirmed bookings (not waitlist entries).

---

## Feature 3: Ensure Waitlist Promotion Notifications Are Sent

**Current Behavior**: When a booking is cancelled and someone is promoted from the waitlist, the database function `cancel_booking_with_waitlist` returns the promoted customer's details. However, there is no client-side code to trigger a notification email for the promoted person.

**Change Required**: After a successful cancellation that results in a waitlist promotion, trigger the notification Edge Function to email the promoted customer.

**Technical Approach**:
1. Update the `useCancelBooking` hook in `src/hooks/useWaitlist.ts` to check the RPC result
2. If `result.promoted === true`, call the Edge Function with the promoted customer's details

**File**: `src/hooks/useWaitlist.ts`
- In `useCancelBooking`, after the RPC call succeeds:
  ```typescript
  if (result.promoted && result.promoted_customer && result.slot_id) {
    supabase.functions.invoke('send-booking-notification', {
      body: {
        slotId: result.slot_id,
        customerName: result.promoted_customer.name,
        customerEmail: result.promoted_customer.email,
        partySize: 1, // Could also be included in the promoted result
        bookingType: 'promotion', // New booking type for special messaging
      },
    });
  }
  ```

**Edge Function Update**: `supabase/functions/send-booking-notification/index.ts`
- Add handling for `bookingType: 'promotion'` with a special email template:
  - Subject: "Good News! You've Got a Spot - [Event Name]"
  - Content: Congratulates the user on being promoted from the waitlist, includes event details and the .ics attachment

---

## Feature 4: Remove Duplicative "Your Upcoming Slots" Section

**Analysis of the Duplication**:
- **"Your Upcoming Slots" (SlotsManager.tsx)**: Lists the host's created events with edit/delete controls and booking counts
- **"Reservations for Your Events" (ReservationsList.tsx)**: Lists the same events but shows detailed guest lists, payment info access, and confirmed/waitlist sub-tabs

**Why Both Exist**: The SlotsManager focuses on event management (editing/deleting), while ReservationsList focuses on guest management.

**Recommendation**: Merge the edit/delete controls into ReservationsList so hosts have a single unified view. This eliminates the need for SlotsManager in the "Create & Manage SGD" tab.

**Changes Required**:
1. **Remove SlotsManager from the UI** in `src/components/customer/CustomerView.tsx` (line 151)
2. **Add edit/delete buttons to ReservationsList.tsx** in the slot header area
3. **Update ReservationsList to show slots even with 0 bookings** (currently it only shows slots that have bookings or waitlist entries)

**Files to Modify**:
- `src/components/customer/CustomerView.tsx` - Remove `<SlotsManager />` import and usage
- `src/components/admin/AdminView.tsx` - Remove `<SlotsManager />` import and usage  
- `src/components/admin/ReservationsList.tsx` - Add edit/delete controls and show all user slots

**ReservationsList Enhancements**:
- Import `EditSlotModal`, `useDeleteAvailabilitySlot`, and `useUserOwnedSlots`
- Merge user-owned slots with booking data so events with 0 reservations still appear
- Add Pencil/Trash buttons in the slot header (similar to SlotsManager)

---

## Summary of Changes

| File | Change |
|------|--------|
| `src/components/customer/CustomerView.tsx` | Change default partySize from 2 to 1; Remove SlotsManager |
| `src/components/admin/AdminView.tsx` | Remove SlotsManager |
| `supabase/functions/send-booking-notification/index.ts` | Add ICS generation and email attachment; Add promotion email template |
| `src/hooks/useWaitlist.ts` | Trigger promotion notification on successful waitlist bump |
| `src/components/admin/ReservationsList.tsx` | Add edit/delete controls; Show all user slots (even with 0 bookings) |
| `src/components/admin/SlotsManager.tsx` | (No changes - will no longer be used in main UI but file remains for potential future use) |

---

## Technical Details

### ICS Content for Edge Function
```typescript
function generateICSContent(slot: any, bookingId: string, partySize: number): string {
  const formatICSDate = (date: string, time: string) => {
    const [hours, minutes] = time.split(':');
    const dateObj = new Date(`${date}T${hours}:${minutes}:00`);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${dateObj.getFullYear()}${pad(dateObj.getMonth()+1)}${pad(dateObj.getDate())}T${pad(dateObj.getHours())}${pad(dateObj.getMinutes())}00`;
  };
  
  const dtStart = formatICSDate(slot.date, slot.time);
  const dtEnd = slot.end_time 
    ? formatICSDate(slot.date, slot.end_time)
    : formatICSDate(slot.date, `${(parseInt(slot.time.split(':')[0]) + 2).toString().padStart(2, '0')}:${slot.time.split(':')[1]}`);
  
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SGD Reservations//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:booking-${bookingId}@sgd.app`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${slot.name}`,
    `DESCRIPTION:Party of ${partySize} guests. Hosted SGD event.`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}
```

### Resend Attachment Format
```typescript
import { encode } from "https://deno.land/std@0.190.0/encoding/base64.ts";

// In the email send call:
attachments: [{
  filename: `${slot.name.replace(/[^a-zA-Z0-9]/g, '-')}.ics`,
  content: encode(new TextEncoder().encode(icsContent)),
}]
```

