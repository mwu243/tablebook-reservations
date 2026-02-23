

# Fix: Date Display Timezone Bug Across Entire Application

## Root Cause

Every component that displays a slot date uses `new Date("2026-02-25")`, which JavaScript interprets as **UTC midnight**. In US timezones (CST, EST, PST, etc.), this shifts the date **one day back** when displayed with `format()` (which uses local time).

This means:
- The database stores "2026-02-25"
- The UI displays "Feb 24" (wrong)
- The edit modal (already fixed) shows "Feb 25" (correct)
- The user sees a mismatch and cannot effectively change dates

## Solution

Create a shared utility function for timezone-safe date parsing, then replace all `new Date(slot.date)` calls across the codebase.

### Step 1: Add utility function to `src/lib/utils.ts`

Add a `parseLocalDate(dateStr: string): Date` function that splits "YYYY-MM-DD" and constructs a local-midnight Date object:
```typescript
export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}
```

### Step 2: Update all affected files

Replace every `new Date(slot.date)` / `new Date(event.date)` / `new Date(booking.availability_slots.date)` with `parseLocalDate(...)`:

**Files to update (6 files, ~14 occurrences total):**

1. **`src/components/admin/SlotsManager.tsx`** (2 occurrences)
   - Line 113: slot date display in list
   - Line 174: slot date in delete dialog

2. **`src/components/admin/ReservationsList.tsx`** (2 occurrences)
   - Line 322: group date display
   - Line 503: slot date in delete dialog

3. **`src/components/admin/LotteryManager.tsx`** (1 occurrence)
   - Line 302: slot date display

4. **`src/components/customer/EventCard.tsx`** (1 occurrence)
   - Line 91: event date display in discovery bar

5. **`src/components/customer/MyReservations.tsx`** (3 occurrences)
   - Line 166: confirmed booking date
   - Line 245: waitlist entry date
   - Line 299: lottery entry date

6. **`src/components/customer/BookingModal.tsx`** (2 occurrences)
   - Line 298: slot date in booking confirmation
   - Line 381: slot date in waitlist confirmation

Each file will import `parseLocalDate` from `@/lib/utils` and replace `new Date(dateString)` with `parseLocalDate(dateString)`.

## Expected Outcome

- All dates display correctly regardless of user timezone
- The edit modal and list view show the same date (no mismatch)
- Date changes via the edit modal will work correctly since the user sees the true date and can change it to a genuinely different value

