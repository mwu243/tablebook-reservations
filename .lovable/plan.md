## Goal

Make sure every user finds out the outcome of their reservation request via email — with a calendar invite (.ics file, which opens in Gmail/Outlook/Apple Calendar) whenever they get a confirmed spot, and a clear "sorry" email when they don't.

## What already works (no change)

- **FCFS booking confirmed** → confirmation email + `.ics` calendar invite sent ✅
- **Waitlist join** → confirmation email sent (no invite, since they don't have a spot) ✅
- **Promoted from waitlist** (someone cancels → next person promoted) → confirmation email + `.ics` calendar invite sent ✅
- **Event details edited** → updated email + refreshed `.ics` to all confirmed guests ✅

## Gaps to fix

1. **Lottery winner selected** by admin → currently no email is sent. Should receive "You won! Reservation confirmed" email with `.ics` calendar invite.
2. **Lottery loser** (admin picked winners and rejected the rest) → currently no email is sent. Should receive a polite "Unfortunately, you weren't selected" email (no calendar invite).
3. **Lottery entry submitted** by customer → currently sends a "Reservation Confirmed" email with `.ics` immediately, which is misleading because they haven't won yet. Should instead send a "Lottery entry received, we'll let you know" email (no invite).

## Implementation

### 1. Extend the existing `send-booking-notification` edge function

Add two new `bookingType` values to the Zod schema:
- `lottery_entry` — entry received, awaiting drawing (no ICS)
- `lottery_won` — winner selected (same template as `promotion`, with ICS)
- `lottery_lost` — not selected (no ICS, friendly copy)

Reuse the existing email layout/styling. The ICS generator and Resend wiring already exist — just route the new types through them with the right subject/heading/copy.

### 2. Wire up the lottery flow (`src/components/admin/LotteryManager.tsx` + `src/hooks/useLotteryBookings.ts` / `useAdminBookings.ts`)

In the existing `confirmMultipleWinners` and `pickRandomWinner` mutations:
- After winners' status is updated to `confirmed` and `booked_tables` is incremented, loop through winners and invoke `send-booking-notification` with `bookingType: 'lottery_won'` for each.
- If `rejectOthers` is true, loop through the rejected losers and invoke `send-booking-notification` with `bookingType: 'lottery_lost'` for each.

All invocations are fire-and-forget (errors logged, not surfaced) — consistent with how booking emails are sent today.

### 3. Fix the misleading email on lottery entry (`src/hooks/useAvailabilitySlots.ts`)

In `useBookSlot`, when `isLottery === true`, switch the notification call from `bookingType: 'booking'` to `bookingType: 'lottery_entry'` so the user gets a correct "entry received" message instead of a premature "reservation confirmed" email + invite.

## Files to touch

- `supabase/functions/send-booking-notification/index.ts` — add 3 new booking types with copy + correct ICS handling.
- `src/hooks/useAvailabilitySlots.ts` — fix lottery-entry email type.
- `src/components/admin/LotteryManager.tsx` (or the underlying lottery mutations in `src/hooks/useLotteryBookings.ts` / `useAdminBookings.ts` — will pick whichever is the single source of truth) — invoke notifications for winners and losers.

## Calendar compatibility note

The `.ics` (iCalendar) attachment already produced is the industry-standard format that Gmail, Outlook (Outlook.com + desktop), Apple Calendar, and Google Calendar all recognize natively — users just open the attachment and click "Add to calendar". No separate Outlook/Gmail integration is needed for end users to add events to their calendars.
