-- Drop the existing function first
DROP FUNCTION IF EXISTS public.get_admin_bookings();

-- Recreate with the updated return type including user_id
CREATE OR REPLACE FUNCTION public.get_admin_bookings()
RETURNS TABLE (
  id uuid,
  customer_name text,
  customer_email text,
  party_size integer,
  slot_id uuid,
  status text,
  created_at timestamptz,
  user_id uuid,
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
    b.user_id,
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