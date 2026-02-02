-- Drop the existing function first (required to change return type)
DROP FUNCTION IF EXISTS public.get_participant_payment_info(uuid);

-- Recreate with dietary_restrictions in return type
CREATE OR REPLACE FUNCTION public.get_participant_payment_info(p_slot_id uuid)
 RETURNS TABLE(booking_id uuid, customer_name text, customer_email text, party_size integer, venmo_username text, zelle_identifier text, dietary_restrictions text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    up.zelle_identifier,
    b.dietary_restrictions
  FROM public.bookings b
  LEFT JOIN public.user_profiles up ON b.user_id = up.user_id
  WHERE b.slot_id = p_slot_id
    AND b.status = 'confirmed';
END;
$function$;