

# Plan: One-Click Booking with Auto-Populated Name

## Overview
Make the booking process seamless by capturing the user's full name during sign-up and auto-populating it when booking events. This creates a "one-click" reservation experience for returning users.

## Changes Required

### 1. Update Sign-Up Form to Capture Full Name
**File:** `src/pages/Auth.tsx`

Add a "Full Name" input field to the sign-up form. This will be a required field that captures the user's name during registration.

- Add new state variable for `fullName`
- Add validation to require the full name field
- Update the form UI to include the name input at the top of the sign-up form

### 2. Update AuthContext to Store Display Name
**File:** `src/contexts/AuthContext.tsx`

Modify the `signUp` function to accept and store the full name in the user profile:

- Extend the `PaymentInfo` interface to include `displayName`
- Update the profile creation to include `display_name` when inserting into `user_profiles`

### 3. Auto-Populate Booking Form from User Profile
**File:** `src/components/customer/BookingModal.tsx`

Fetch the user's profile and pre-fill both name and email fields:

- Import and use the `useUserProfile` hook
- Auto-populate the `name` field from `profile.display_name`
- Auto-populate the `email` field from `user.email` (already done)
- Simplify the UI to show pre-filled info as read-only or easily editable

### 4. Streamlined One-Click Booking UI
**File:** `src/components/customer/BookingModal.tsx`

When the user's profile is complete (has display name), show a simplified confirmation view:

- Display the pre-filled name and email as a summary (not editable inputs)
- Show a single "Confirm Booking" button for true one-click experience
- Optionally provide an "Edit" link if the user needs to change details

---

## Technical Details

### Database Schema
No changes needed - `user_profiles.display_name` column already exists.

### Validation Updates

**Auth.tsx Sign-Up Schema:**
```typescript
const signUpSchema = z.object({
  fullName: z.string().min(2, 'Please enter your full name'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  venmoUsername: z.string().optional(),
  zelleIdentifier: z.string().optional(),
});
```

### AuthContext Interface Update
```typescript
interface PaymentInfo {
  displayName?: string;
  venmoUsername?: string;
  zelleIdentifier?: string;
}
```

### BookingModal Flow Logic
```text
1. User clicks "Book" on an event
2. Modal checks if user is authenticated
   - Not authenticated: Show sign-in prompt (existing behavior)
   - Authenticated: Continue to booking
3. Fetch user profile using useUserProfile hook
4. If profile has display_name:
   - Show one-click confirmation view with pre-filled info
   - Single "Confirm Booking" button
5. If profile missing display_name:
   - Show editable form (fallback for legacy users)
```

---

## User Experience Flow

### New User Journey
1. User visits site and clicks to book an event
2. Prompted to sign in/create account
3. Sign-up form now includes "Full Name" field (required)
4. User completes registration
5. Returns to booking - name and email auto-filled
6. One click to confirm booking

### Existing User Journey
1. User logs in and clicks to book
2. If they have a display_name saved: One-click confirmation
3. If no display_name: Form allows them to enter it (and optionally save)

