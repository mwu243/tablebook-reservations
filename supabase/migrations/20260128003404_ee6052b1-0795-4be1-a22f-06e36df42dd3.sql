-- =============================================
-- SECURITY FIX: Comprehensive security hardening
-- =============================================

-- 1. Add user_id column to bookings table for proper user association
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Drop the dangerous auto-admin trigger that grants admin to all new users
DROP TRIGGER IF EXISTS on_auth_user_created_assign_role ON auth.users;

-- 3. Replace the function to assign 'user' role instead of 'admin' to new signups
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Assign 'user' role by default (NOT admin)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$function$;

-- 4. Recreate the trigger with the safe function
CREATE TRIGGER on_auth_user_created_assign_role
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_role();

-- 5. Update get_admin_bookings to require admin authorization
CREATE OR REPLACE FUNCTION public.get_admin_bookings()
 RETURNS TABLE(id uuid, customer_name text, customer_email text, party_size integer, slot_id uuid, status text, created_at timestamp with time zone, user_id uuid, slot_date date, slot_time time without time zone, slot_end_time time without time zone, slot_name text, slot_booking_mode text, slot_total_tables integer, slot_booked_tables integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Authorization check: Only admins can access this function
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

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
$function$;

-- 6. Update admin_update_booking_status to require admin authorization
CREATE OR REPLACE FUNCTION public.admin_update_booking_status(booking_id uuid, new_status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Authorization check: Only admins can update booking status
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  UPDATE public.bookings
  SET status = new_status
  WHERE id = booking_id;
END;
$function$;

-- 7. Update admin_update_bookings_status to require admin authorization
CREATE OR REPLACE FUNCTION public.admin_update_bookings_status(booking_ids uuid[], new_status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Authorization check: Only admins can batch update booking status
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  UPDATE public.bookings
  SET status = new_status
  WHERE id = ANY(booking_ids);
END;
$function$;

-- 8. Drop the overly restrictive SELECT policy on bookings
DROP POLICY IF EXISTS "No public read access to bookings" ON public.bookings;

-- 9. Create policy allowing users to view their own bookings
CREATE POLICY "Users can view their own bookings"
ON public.bookings
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 10. Create policy allowing admins to view all bookings
CREATE POLICY "Admins can view all bookings"
ON public.bookings
FOR SELECT
TO authenticated
USING (is_admin());

-- 11. Drop the overly permissive INSERT policy
DROP POLICY IF EXISTS "Authenticated users can create bookings" ON public.bookings;

-- 12. Create secure INSERT policy that validates user ownership
CREATE POLICY "Users can create their own bookings"
ON public.bookings
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);