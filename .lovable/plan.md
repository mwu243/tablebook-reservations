

# Plan: UI Improvements for Booking Experience

## Overview
Three targeted changes to improve the user experience:
1. Rename the "Manage Availability" tab to "Create & Manage SGD"
2. Display the event description in the booking modal
3. Ensure Full Name auto-populates correctly (investigation shows the code exists but may need adjustment)

---

## Change 1: Rename Tab

**File:** `src/components/customer/CustomerView.tsx`

Update line 52 to change the tab label from "Manage Availability" to "Create & Manage SGD".

---

## Change 2: Add Event Description to Booking Modal

**File:** `src/components/customer/BookingModal.tsx`

The booking modal currently shows the event name, date, time, and party size in the summary card. We need to add the event description below the event name when it exists.

**Location:** Inside the summary card (around line 247), after displaying the slot name, add a conditional rendering of the description:

```text
<p className="font-medium">{slot.name}</p>
{slot.description && (
  <p className="mt-1 text-sm text-muted-foreground">{slot.description}</p>
)}
```

This will also be added to the "Sign In Required" dialog summary card (around line 173) for consistency.

---

## Change 3: Full Name Auto-Population

**File:** `src/components/customer/BookingModal.tsx`

The current code has logic to auto-populate from `userProfile.display_name`, but based on the network requests, the user's profile is empty. The issue is that:
1. The `useEffect` only sets the name when `!name` is true, which prevents re-population on subsequent opens
2. When the modal opens fresh, it should always try to populate from the profile

**Fix:** Update the `useEffect` to be smarter about when to set the name:
- When the slot changes (modal opens), reset and re-populate from profile
- This ensures fresh population each time the modal opens

Updated logic:
```typescript
useEffect(() => {
  if (slot) {
    // Always try to populate from profile/auth when modal opens
    if (user?.email) {
      setEmail(user.email);
    }
    if (userProfile?.display_name) {
      setName(userProfile.display_name);
    }
  }
}, [slot, user, userProfile]);
```

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/customer/CustomerView.tsx` | Rename tab from "Manage Availability" to "Create & Manage SGD" |
| `src/components/customer/BookingModal.tsx` | Add event description display in both the authenticated and unauthenticated summary cards |
| `src/components/customer/BookingModal.tsx` | Update useEffect to properly reset and populate name when modal opens |

---

## User Experience After Changes

1. **Tab Name**: Users will see "Create & Manage SGD" instead of "Manage Availability"
2. **Event Description**: When clicking on an event to book, users will see the event description (e.g., "chefs table type shit") in the summary card before confirming
3. **Full Name**: The Full Name field will be auto-populated from the user's profile, matching the behavior of the Email Address field

