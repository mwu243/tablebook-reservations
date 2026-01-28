
# Payment Info & Event Editing Features

This plan implements three features: (1) collecting Venmo/Zelle usernames during signup, (2) allowing hosts to view participant payment information securely, and (3) enabling hosts to edit events without canceling them.

## Summary

**Feature 1 - Payment Info Collection:**
- Add Venmo/Zelle username fields to the signup form
- Create a secure `user_profiles` table to store payment info (separate from auth)
- RLS policies ensure users can only see their own payment info

**Feature 2 - Host Payment Info Access:**
- Create a secure database view that hides payment info from direct access
- Create an RPC function that only returns payment info for participants of events the host owns
- Display participant payment info in a dedicated section on the Admin Dashboard

**Feature 3 - Event Editing:**
- Add an "Edit" button to each slot in the SlotsManager
- Create an edit modal to update event details (name, description, date, time, waitlist settings)
- Create an update mutation in useAvailabilitySlots hook

---

## Security Architecture for Payment Info (Critical)

Payment usernames (Venmo/Zelle) are considered PII and require careful handling:

**Security Strategy:**
1. Store payment info in a separate `user_profiles` table (not in auth.users)
2. Base table has RLS that only allows users to read their OWN profile
3. Create a SECURITY DEFINER function `get_participant_payment_info(slot_id)` that:
   - Verifies the caller owns the slot using `is_slot_owner()`
   - Returns payment info ONLY for users who have bookings for that specific slot
   - Cannot be exploited to fetch arbitrary user payment info
4. Frontend never directly queries payment info - always uses the secure RPC

**Data Flow:**

```text
+------------------+     +-------------------+     +----------------------+
|  Host requests   | --> | get_participant_  | --> | Verify slot_owner    |
|  payment info    |     | payment_info()    |     | via is_slot_owner()  |
+------------------+     +-------------------+     +----------------------+
                                                            |
                                                            v
                                                   +----------------------+
                                                   | Join user_profiles   |
                                                   | with bookings WHERE  |
                                                   | slot_id matches      |
                                                   +----------------------+
                                                            |
                                                            v
                                                   +----------------------+
                                                   | Return ONLY matching |
                                                   | participant data     |
                                                   +----------------------+
```

---

## Implementation Steps

### 1. Database Changes

**Create `user_profiles` table:**

```sql
CREATE TABLE public.user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  display_name text,
  venmo_username text,
  zelle_identifier text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_profiles_user_id ON public.user_profiles(user_id);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Users can only see and update their own profile
CREATE POLICY "Users can view own profile"
ON public.user_profiles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
ON public.user_profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
ON public.user_profiles FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
```

**Create secure RPC function for hosts:**

```sql
CREATE OR REPLACE FUNCTION public.get_participant_payment_info(p_slot_id uuid)
RETURNS TABLE(
  booking_id uuid,
  customer_name text,
  customer_email text,
  party_size integer,
  venmo_username text,
  zelle_identifier text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Authorization check: Only slot owners can access this
  IF NOT is_slot_owner(p_slot_id) THEN
    RAISE EXCEPTION 'Unauthorized: Only the event host can view payment info';
  END IF;

  RETURN QUERY
  SELECT 
    b.id as booking_id,
    b.customer_name,
    b.customer_email,
    b.party_size,
    up.venmo_username,
    up.zelle_identifier
  FROM public.bookings b
  LEFT JOIN public.user_profiles up ON b.user_id = up.user_id
  WHERE b.slot_id = p_slot_id
    AND b.status = 'confirmed';
END;
$$;
```

**Add UPDATE policy to availability_slots for editing:**
(Already exists - "Users can update own availability slots")

### 2. Update Signup Flow

**Modify Auth.tsx:**
- Add fields for Venmo username and Zelle identifier during signup
- Make at least one payment method required
- After successful signup, create a user_profile record with payment info

**Modify AuthContext.tsx:**
- Update signUp function to accept payment info
- Create profile after auth signup succeeds

### 3. Create Hooks for Payment Info

**Create useUserProfile hook:**
- Query to fetch current user's profile
- Mutation to update profile

**Create useParticipantPaymentInfo hook:**
- RPC call to `get_participant_payment_info(slot_id)`
- Only callable by slot owners

### 4. Update Frontend Components

**Auth.tsx (Signup form):**
- Add Venmo username input field
- Add Zelle identifier input field
- Validate at least one is provided
- Show helper text explaining why payment info is needed

**ReservationsList.tsx:**
- Add "View Payment Info" button for each event
- Open modal showing participant payment details
- Copy-to-clipboard functionality for payment usernames

**Create ParticipantPaymentModal component:**
- Display list of participants with their payment info
- Show Venmo usernames with "@" prefix
- Show Zelle identifiers (email/phone)
- Option to copy all to clipboard

**SlotsManager.tsx:**
- Add "Edit" button next to each slot
- Open edit modal with current values pre-filled

**Create EditSlotModal component:**
- Form to edit: name, description, date, time, end_time, waitlist_enabled
- Validation (end time after start time, date not in past)
- Submit calls update mutation

### 5. Create Update Mutation

**Add to useAvailabilitySlots.ts:**

```typescript
export function useUpdateAvailabilitySlot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      slotId, 
      updates 
    }: { 
      slotId: string; 
      updates: Partial<AvailabilitySlot> 
    }) => {
      const { data, error } = await supabase
        .from('availability_slots')
        .update(updates)
        .eq('id', slotId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability-slots'] });
      queryClient.invalidateQueries({ queryKey: ['user-owned-slots'] });
      queryClient.invalidateQueries({ queryKey: ['month-availability'] });
    },
  });
}
```

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/pages/Auth.tsx` | Modify | Add Venmo/Zelle fields to signup form |
| `src/contexts/AuthContext.tsx` | Modify | Update signUp to create profile |
| `src/hooks/useUserProfile.ts` | Create | Profile query and mutations |
| `src/hooks/useParticipantPaymentInfo.ts` | Create | RPC hook for hosts |
| `src/hooks/useAvailabilitySlots.ts` | Modify | Add update mutation |
| `src/components/admin/ReservationsList.tsx` | Modify | Add payment info button |
| `src/components/admin/ParticipantPaymentModal.tsx` | Create | Display payment info |
| `src/components/admin/SlotsManager.tsx` | Modify | Add edit button |
| `src/components/admin/EditSlotModal.tsx` | Create | Edit form modal |
| `src/lib/types.ts` | Modify | Add UserProfile type |
| Database migration | Create | user_profiles table + RPC function |

---

## User Experience Flows

### Signup with Payment Info
1. User clicks "Sign Up" tab
2. Enters email and password
3. Enters Venmo username OR Zelle identifier (or both)
4. Clicks "Create Account"
5. Account and profile created together

### Host Viewing Payment Info
1. Host goes to Admin Dashboard
2. Sees list of reservations for their events
3. Clicks "View Payment Info" on a reservation group
4. Modal shows all participants with their Venmo/Zelle usernames
5. Host can copy individual usernames or export list

### Host Editing Event
1. Host goes to Admin Dashboard > Your Upcoming Slots
2. Clicks "Edit" button on a slot
3. Modal opens with current values pre-filled
4. Host modifies desired fields
5. Clicks "Save Changes"
6. Event updated, existing bookings preserved

---

## Security Considerations

1. **Payment info isolation**: User profiles table is completely separate; users can only see their own data
2. **Host-only access**: The RPC function enforces slot ownership before returning any payment data
3. **No direct queries**: Frontend never queries user_profiles directly for other users
4. **Audit trail**: All RPC functions can be logged for security auditing
5. **Input validation**: Venmo usernames validated with regex (alphanumeric + underscores)
6. **Zelle flexibility**: Accepts email or phone format

---

## Validation Rules

**Venmo username:**
- Starts with alphanumeric
- Contains only letters, numbers, underscores, hyphens
- 5-30 characters
- Stored without "@" prefix (added on display)

**Zelle identifier:**
- Valid email OR valid phone number format
- Phone numbers normalized to consistent format

---

## Technical Details

### Database Migration SQL (Complete)

```sql
-- Create user_profiles table for payment info
CREATE TABLE public.user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  display_name text,
  venmo_username text,
  zelle_identifier text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_user_profiles_user_id ON public.user_profiles(user_id);

-- Enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS: Users can only see their own profile
CREATE POLICY "Users can view own profile"
ON public.user_profiles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- RLS: Users can create their own profile
CREATE POLICY "Users can insert own profile"
ON public.user_profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- RLS: Users can update their own profile
CREATE POLICY "Users can update own profile"
ON public.user_profiles FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Secure function for hosts to get participant payment info
CREATE OR REPLACE FUNCTION public.get_participant_payment_info(p_slot_id uuid)
RETURNS TABLE(
  booking_id uuid,
  customer_name text,
  customer_email text,
  party_size integer,
  venmo_username text,
  zelle_identifier text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Authorization check: Only slot owners can access this
  IF NOT is_slot_owner(p_slot_id) THEN
    RAISE EXCEPTION 'Unauthorized: Only the event host can view payment info';
  END IF;

  RETURN QUERY
  SELECT 
    b.id as booking_id,
    b.customer_name,
    b.customer_email,
    b.party_size,
    up.venmo_username,
    up.zelle_identifier
  FROM public.bookings b
  LEFT JOIN public.user_profiles up ON b.user_id = up.user_id
  WHERE b.slot_id = p_slot_id
    AND b.status = 'confirmed';
END;
$$;

-- Function to update profile timestamp
CREATE OR REPLACE FUNCTION public.handle_profile_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER set_profile_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_profile_updated_at();
```

### API Integrations Note

Since Venmo and Zelle don't provide public APIs for sending payment requests, the implementation provides the host with a list of participant payment usernames that they can use to manually send requests through the respective apps. This is the standard approach used by similar platforms.
