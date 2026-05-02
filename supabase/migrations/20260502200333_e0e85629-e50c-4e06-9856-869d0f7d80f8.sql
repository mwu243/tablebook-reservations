
CREATE OR REPLACE FUNCTION public.admin_remove_booking(p_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking RECORD;
  v_slot RECORD;
  v_promoted RECORD;
BEGIN
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  IF NOT (is_admin() OR is_slot_owner(v_booking.slot_id)) THEN
    RAISE EXCEPTION 'Unauthorized: Only the event host or admin can remove guests';
  END IF;

  SELECT * INTO v_slot FROM public.availability_slots WHERE id = v_booking.slot_id;

  DELETE FROM public.bookings WHERE id = p_booking_id;

  -- Only decrement for confirmed bookings (lottery/cancelled don't count)
  IF v_booking.status = 'confirmed' THEN
    UPDATE public.availability_slots
    SET booked_tables = GREATEST(booked_tables - 1, 0)
    WHERE id = v_booking.slot_id;

    IF v_slot.waitlist_enabled THEN
      SELECT * INTO v_promoted FROM public.promote_waitlist_entry(v_booking.slot_id);
      IF v_promoted.entry_id IS NOT NULL THEN
        RETURN jsonb_build_object(
          'success', true,
          'promoted', true,
          'promoted_customer', jsonb_build_object(
            'name', v_promoted.promoted_customer_name,
            'email', v_promoted.promoted_customer_email,
            'phone', v_promoted.promoted_customer_phone
          ),
          'slot_id', v_booking.slot_id
        );
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true, 'promoted', false);
END;
$$;
