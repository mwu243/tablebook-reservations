
-- Fix increment_booked_tables: add authorization check
-- Both overloads need to be replaced

-- Drop the single-arg version first, then recreate both with auth checks
CREATE OR REPLACE FUNCTION public.increment_booked_tables(slot_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_slot RECORD;
BEGIN
  -- Authorization: Must be admin, slot owner, or have a booking for this slot
  IF NOT (
    is_admin() 
    OR is_slot_owner(slot_id)
    OR EXISTS (
      SELECT 1 FROM public.bookings 
      WHERE bookings.slot_id = increment_booked_tables.slot_id 
      AND bookings.user_id = auth.uid()
    )
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO current_slot FROM public.availability_slots WHERE id = slot_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Slot not found';
  END IF;
  
  IF current_slot.booked_tables >= current_slot.total_tables THEN
    RAISE EXCEPTION 'No tables available';
  END IF;
  
  UPDATE public.availability_slots
  SET booked_tables = booked_tables + 1
  WHERE id = increment_booked_tables.slot_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_booked_tables(slot_id uuid, amount integer DEFAULT 1)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_slot RECORD;
BEGIN
  -- Authorization: Must be admin or slot owner for bulk increments
  IF NOT (
    is_admin()
    OR is_slot_owner(slot_id)
    OR EXISTS (
      SELECT 1 FROM public.bookings 
      WHERE bookings.slot_id = increment_booked_tables.slot_id 
      AND bookings.user_id = auth.uid()
    )
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO current_slot FROM public.availability_slots WHERE id = slot_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Slot not found';
  END IF;
  
  IF current_slot.booked_tables + amount > current_slot.total_tables THEN
    RAISE EXCEPTION 'Not enough spots available';
  END IF;
  
  UPDATE public.availability_slots
  SET booked_tables = booked_tables + amount
  WHERE id = increment_booked_tables.slot_id;
END;
$$;
