-- Add user_id column to availability_slots
ALTER TABLE public.availability_slots 
ADD COLUMN user_id uuid REFERENCES auth.users(id);

-- Create index for performance
CREATE INDEX idx_availability_slots_user_id ON public.availability_slots(user_id);

-- Create function to check slot ownership
CREATE OR REPLACE FUNCTION public.is_slot_owner(_slot_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.availability_slots
    WHERE id = _slot_id
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

-- Drop existing booking SELECT policies and recreate to include slot owner access
DROP POLICY IF EXISTS "Users can view their own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Admins can view all bookings" ON public.bookings;
DROP POLICY IF EXISTS "Slot owners can view bookings for their slots" ON public.bookings;
DROP POLICY IF EXISTS "Slot owners can update bookings for their slots" ON public.bookings;

-- Users can view their own bookings OR bookings for slots they own
CREATE POLICY "Users can view own bookings or owned slot bookings"
ON public.bookings FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id 
  OR is_slot_owner(slot_id)
);

-- Drop and recreate update policy
DROP POLICY IF EXISTS "Admins can update bookings" ON public.bookings;

-- Slot owners can update bookings for their slots
CREATE POLICY "Slot owners can update bookings for their slots"
ON public.bookings FOR UPDATE
TO authenticated
USING (is_slot_owner(slot_id));