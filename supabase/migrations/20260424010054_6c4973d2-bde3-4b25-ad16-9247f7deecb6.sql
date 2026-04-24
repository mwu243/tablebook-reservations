DROP FUNCTION IF EXISTS public.increment_booked_tables(slot_id uuid);
NOTIFY pgrst, 'reload schema';