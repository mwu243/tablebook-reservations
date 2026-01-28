-- Update increment_booked_tables to accept an amount parameter
CREATE OR REPLACE FUNCTION public.increment_booked_tables(slot_id uuid, amount integer DEFAULT 1)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_slot RECORD;
BEGIN
  SELECT * INTO current_slot FROM public.availability_slots WHERE id = slot_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Slot not found';
  END IF;
  
  IF current_slot.booked_tables + amount > current_slot.total_tables THEN
    RAISE EXCEPTION 'Not enough spots available';
  END IF;
  
  UPDATE public.availability_slots
  SET booked_tables = booked_tables + amount
  WHERE id = slot_id;
END;
$$;