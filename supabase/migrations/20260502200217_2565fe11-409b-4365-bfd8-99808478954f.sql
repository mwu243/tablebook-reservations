
CREATE OR REPLACE FUNCTION public.admin_add_booking(
  p_slot_id uuid,
  p_customer_name text,
  p_customer_email text,
  p_party_size integer,
  p_dietary_restrictions text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slot RECORD;
  v_new_id uuid;
BEGIN
  -- Authorization: only slot owner or admin
  IF NOT (is_admin() OR is_slot_owner(p_slot_id)) THEN
    RAISE EXCEPTION 'Unauthorized: Only the event host or admin can add guests';
  END IF;

  IF p_customer_name IS NULL OR length(trim(p_customer_name)) = 0 THEN
    RAISE EXCEPTION 'Customer name is required';
  END IF;

  IF p_customer_email IS NULL OR length(trim(p_customer_email)) = 0 THEN
    RAISE EXCEPTION 'Customer email is required';
  END IF;

  IF p_party_size IS NULL OR p_party_size < 1 OR p_party_size > 2 THEN
    RAISE EXCEPTION 'Party size must be 1 or 2';
  END IF;

  SELECT * INTO v_slot FROM public.availability_slots WHERE id = p_slot_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Slot not found';
  END IF;

  IF v_slot.booked_tables + 1 > v_slot.total_tables THEN
    RAISE EXCEPTION 'Not enough spots available';
  END IF;

  INSERT INTO public.bookings (
    slot_id, user_id, customer_name, customer_email,
    party_size, status, dietary_restrictions
  ) VALUES (
    p_slot_id, NULL, trim(p_customer_name), trim(p_customer_email),
    p_party_size, 'confirmed', NULLIF(trim(COALESCE(p_dietary_restrictions, '')), '')
  )
  RETURNING id INTO v_new_id;

  UPDATE public.availability_slots
  SET booked_tables = booked_tables + 1
  WHERE id = p_slot_id;

  RETURN jsonb_build_object('success', true, 'booking_id', v_new_id);
END;
$$;
