-- Add unique constraint to prevent duplicate bookings per user per slot
-- First, we need to handle potential existing duplicates
DELETE FROM public.bookings b1
USING public.bookings b2
WHERE b1.id > b2.id 
  AND b1.slot_id = b2.slot_id 
  AND b1.user_id = b2.user_id
  AND b1.user_id IS NOT NULL;

-- Add the unique constraint
ALTER TABLE public.bookings
ADD CONSTRAINT bookings_unique_user_per_slot UNIQUE (slot_id, user_id);

-- Create a function to check if user already has a booking for a slot
CREATE OR REPLACE FUNCTION public.user_has_booking_for_slot(p_slot_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.bookings
    WHERE slot_id = p_slot_id
      AND user_id = p_user_id
      AND status != 'cancelled'
  )
$$;