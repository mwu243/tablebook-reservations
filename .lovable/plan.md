
# User-Specific Availability Management

This plan transforms the system so that every authenticated user can create and manage their own availability slots (events), while only being able to administer the specific events they personally created.

## Summary

Currently, only users with the `admin` role can create/manage availability slots. This plan changes the model so:
- Any logged-in user can create availability slots
- Users can only edit/delete slots they created
- Users can only manage lottery drawings and view bookings for their own slots
- The "Manage Availability" tab becomes visible to all logged-in users

---

## Implementation Steps

### 1. Database Schema Changes

Add a `user_id` column to the `availability_slots` table to track who created each slot.

**Migration includes:**
- Add `user_id` column (UUID, references auth.users)
- Update existing slots to have a default owner (or set to NULL for legacy data)
- Update RLS policies:
  - **SELECT**: Anyone can view slots (for booking calendar)
  - **INSERT**: Authenticated users can create slots (automatically sets their user_id)
  - **UPDATE**: Users can only update their own slots
  - **DELETE**: Users can only delete their own slots

### 2. Create Helper Function for Slot Ownership

Create a security definer function `is_slot_owner(slot_id)` to safely check if the current user owns a specific availability slot.

### 3. Update RLS Policies for Bookings

Create new policies so users can manage bookings (lottery entries) for slots they own:
- Users can view bookings for slots they created
- Users can update booking status for their own slots

### 4. Create New RPC Functions for Slot Owner Operations

Replace admin-only RPC functions with owner-based versions:
- `get_owner_slot_bookings()` - Get all bookings for slots the current user owns
- `owner_update_booking_status()` - Update booking status for owned slots

### 5. Update Frontend Components

**CustomerView.tsx:**
- Show "Manage Availability" tab to ALL logged-in users (remove `isAdmin` check)
- Update tab grid to always show 3 columns for logged-in users

**AvailabilityManager.tsx:**
- Automatically include `user_id` when creating slots

**SlotsManager.tsx:**
- Filter to show only slots created by the current user
- Create new hook `useUserOwnedSlots()` to fetch user's own slots

**LotteryManager.tsx:**
- Filter lottery entries to only show bookings for user's own slots
- Create new hook `useOwnerLotteryBookings()` to fetch lottery entries for owned slots
- Update confirmation/rejection to use owner-based RPC functions

**ReservationsList.tsx (for owner view):**
- Show only bookings for slots the current user created
- Create new hook `useOwnerBookings()` for this purpose

### 6. Update TypeScript Types

Update `AvailabilitySlot` interface in `src/lib/types.ts` to include `user_id` field.

---

## Technical Details

### Database Migration SQL

```sql
-- Add user_id column to availability_slots
ALTER TABLE public.availability_slots 
ADD COLUMN user_id uuid REFERENCES auth.users(id);

-- Create index for performance
CREATE INDEX idx_availability_slots_user_id ON public.availability_slots(user_id);

-- Create function to check slot ownership
CREATE OR REPLACE FUNCTION public.is_slot_owner(slot_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.availability_slots
    WHERE id = slot_id
      AND user_id = auth.uid()
  )
$$;

-- Update RLS policies for availability_slots
DROP POLICY IF EXISTS "Admins can create availability slots" ON public.availability_slots;
DROP POLICY IF EXISTS "Admins can delete availability slots" ON public.availability_slots;
DROP POLICY IF EXISTS "Admins can update availability slots" ON public.availability_slots;

-- Authenticated users can create their own slots
CREATE POLICY "Users can create own availability slots"
ON public.availability_slots FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can only update their own slots
CREATE POLICY "Users can update own availability slots"
ON public.availability_slots FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Users can only delete their own slots
CREATE POLICY "Users can delete own availability slots"
ON public.availability_slots FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Add policy for slot owners to manage bookings
CREATE POLICY "Slot owners can view bookings for their slots"
ON public.bookings FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id 
  OR is_slot_owner(slot_id)
);

CREATE POLICY "Slot owners can update bookings for their slots"
ON public.bookings FOR UPDATE
TO authenticated
USING (is_slot_owner(slot_id));
```

### New Hooks to Create

1. **`useUserOwnedSlots()`** - Fetches upcoming slots where `user_id` matches current user
2. **`useOwnerLotteryBookings()`** - Fetches pending lottery bookings for user's slots
3. **`useOwnerBookings()`** - Fetches all bookings for user's slots

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/customer/CustomerView.tsx` | Remove `isAdmin` check for "Manage Availability" tab |
| `src/components/admin/AvailabilityManager.tsx` | Pass `user_id` when creating slots |
| `src/components/admin/SlotsManager.tsx` | Use new hook to filter by ownership |
| `src/components/admin/LotteryManager.tsx` | Filter lottery entries by slot ownership |
| `src/hooks/useAvailabilitySlots.ts` | Add `user_id` to create mutation, add owner-filtered hooks |
| `src/hooks/useLotteryBookings.ts` | Add owner-based lottery queries and mutations |
| `src/lib/types.ts` | Add `user_id` to `AvailabilitySlot` type |

---

## Security Considerations

- RLS ensures users can only modify their own slots at the database level
- The `is_slot_owner()` function uses `SECURITY DEFINER` to safely check ownership
- Bookings remain protected: users see their own bookings OR bookings for slots they own
- No client-side role checks for authorization - all enforced at database level

---

## User Experience Flow

1. User logs in
2. User sees 3 tabs: "Book a Table", "My Reservations", "Manage Availability"
3. In "Manage Availability":
   - User creates a new availability slot (automatically tied to their account)
   - User sees only their own upcoming slots
   - User can manage lottery drawings only for their own events
   - User can view/manage bookings only for their own events

