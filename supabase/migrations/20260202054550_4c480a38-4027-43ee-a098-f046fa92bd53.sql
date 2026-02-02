-- Fix booking failures caused by missing dietary_restrictions column / schema cache mismatch

ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS dietary_restrictions text;

ALTER TABLE public.waitlist_entries
ADD COLUMN IF NOT EXISTS dietary_restrictions text;

-- Ask the REST layer to reload its schema cache (helps avoid PGRST204 after DDL)
NOTIFY pgrst, 'reload schema';
