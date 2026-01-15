-- Drop the existing permissive policies on bookings
DROP POLICY IF EXISTS "Anyone can view bookings" ON public.bookings;
DROP POLICY IF EXISTS "Anyone can update bookings" ON public.bookings;
DROP POLICY IF EXISTS "Anyone can create bookings" ON public.bookings;

-- Create new INSERT-only policy for anon users (customers can still book)
CREATE POLICY "Customers can create bookings"
ON public.bookings
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Create UPDATE policy that only allows updates (for lottery status changes via RPC)
-- This is needed for the admin RPC functions to work
CREATE POLICY "Allow updates via service role only"
ON public.bookings
FOR UPDATE
USING (false)
WITH CHECK (false);

-- Create the admin RPC function to fetch all bookings with slot details
CREATE OR REPLACE FUNCTION public.get_admin_bookings()
RETURNS TABLE (
  id uuid,
  customer_name text,
  customer_email text,
  party_size integer,
  slot_id uuid,
  status text,
  created_at timestamptz,
  slot_date date,
  slot_time time,
  slot_end_time time,
  slot_name text,
  slot_booking_mode text,
  slot_total_tables integer,
  slot_booked_tables integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id,
    b.customer_name,
    b.customer_email,
    b.party_size,
    b.slot_id,
    b.status,
    b.created_at,
    s.date as slot_date,
    s.time as slot_time,
    s.end_time as slot_end_time,
    s.name as slot_name,
    s.booking_mode as slot_booking_mode,
    s.total_tables as slot_total_tables,
    s.booked_tables as slot_booked_tables
  FROM public.bookings b
  LEFT JOIN public.availability_slots s ON b.slot_id = s.id
  ORDER BY b.created_at DESC;
END;
$$;

-- Create admin function to update booking status (for lottery management)
CREATE OR REPLACE FUNCTION public.admin_update_booking_status(
  booking_id uuid,
  new_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.bookings
  SET status = new_status
  WHERE id = booking_id;
END;
$$;

-- Create admin function to update multiple bookings at once
CREATE OR REPLACE FUNCTION public.admin_update_bookings_status(
  booking_ids uuid[],
  new_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.bookings
  SET status = new_status
  WHERE id = ANY(booking_ids);
END;
$$;