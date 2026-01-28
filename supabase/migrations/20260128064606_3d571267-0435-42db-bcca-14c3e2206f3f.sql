-- Add waitlist_enabled to availability_slots
ALTER TABLE public.availability_slots 
ADD COLUMN waitlist_enabled boolean NOT NULL DEFAULT false;

-- Create waitlist_entries table
CREATE TABLE public.waitlist_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id uuid REFERENCES public.availability_slots(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_phone text,
  party_size integer NOT NULL,
  position integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  notified_at timestamptz
);

-- Index for efficient queries
CREATE INDEX idx_waitlist_entries_slot_id ON public.waitlist_entries(slot_id);
CREATE INDEX idx_waitlist_entries_user_id ON public.waitlist_entries(user_id);
CREATE INDEX idx_waitlist_entries_position ON public.waitlist_entries(slot_id, position);

-- Enable RLS
ALTER TABLE public.waitlist_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for waitlist_entries
CREATE POLICY "Users can view own waitlist entries"
ON public.waitlist_entries FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can join waitlist"
ON public.waitlist_entries FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave waitlist"
ON public.waitlist_entries FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Slot owners can view waitlist"
ON public.waitlist_entries FOR SELECT
TO authenticated
USING (is_slot_owner(slot_id));

CREATE POLICY "Slot owners can manage waitlist"
ON public.waitlist_entries FOR DELETE
TO authenticated
USING (is_slot_owner(slot_id));

-- Add DELETE policy to bookings for customer cancellation
CREATE POLICY "Users can cancel own bookings"
ON public.bookings FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Function to get next waitlist position
CREATE OR REPLACE FUNCTION public.get_next_waitlist_position(p_slot_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(MAX(position), 0) + 1
  FROM public.waitlist_entries
  WHERE slot_id = p_slot_id
$$;

-- Function to promote next waitlist entry (called after cancellation)
CREATE OR REPLACE FUNCTION public.promote_waitlist_entry(p_slot_id uuid)
RETURNS TABLE(
  entry_id uuid,
  promoted_customer_name text,
  promoted_customer_email text,
  promoted_customer_phone text,
  promoted_party_size integer,
  promoted_user_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_entry RECORD;
BEGIN
  -- Get the first person on the waitlist
  SELECT * INTO next_entry
  FROM public.waitlist_entries we
  WHERE we.slot_id = p_slot_id
  ORDER BY we.position ASC
  LIMIT 1;
  
  IF next_entry IS NULL THEN
    RETURN;
  END IF;
  
  -- Create booking for them
  INSERT INTO public.bookings (slot_id, user_id, customer_name, customer_email, party_size, status)
  VALUES (p_slot_id, next_entry.user_id, next_entry.customer_name, next_entry.customer_email, next_entry.party_size, 'confirmed');
  
  -- Increment booked_tables
  UPDATE public.availability_slots
  SET booked_tables = booked_tables + 1
  WHERE id = p_slot_id;
  
  -- Remove from waitlist
  DELETE FROM public.waitlist_entries WHERE id = next_entry.id;
  
  -- Reorder remaining positions
  UPDATE public.waitlist_entries
  SET position = position - 1
  WHERE slot_id = p_slot_id AND position > next_entry.position;
  
  RETURN QUERY SELECT 
    next_entry.id,
    next_entry.customer_name,
    next_entry.customer_email,
    next_entry.customer_phone,
    next_entry.party_size,
    next_entry.user_id;
END;
$$;

-- Function to cancel booking and trigger waitlist promotion
CREATE OR REPLACE FUNCTION public.cancel_booking_with_waitlist(p_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking RECORD;
  v_slot RECORD;
  v_promoted RECORD;
  v_result jsonb;
BEGIN
  -- Get the booking
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id;
  
  IF v_booking IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking not found');
  END IF;
  
  -- Verify the user owns the booking
  IF v_booking.user_id != auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;
  
  -- Get the slot
  SELECT * INTO v_slot FROM public.availability_slots WHERE id = v_booking.slot_id;
  
  -- Delete the booking
  DELETE FROM public.bookings WHERE id = p_booking_id;
  
  -- Decrement booked_tables
  UPDATE public.availability_slots
  SET booked_tables = GREATEST(booked_tables - 1, 0)
  WHERE id = v_booking.slot_id;
  
  -- Check if waitlist is enabled and promote next person
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
  
  RETURN jsonb_build_object('success', true, 'promoted', false);
END;
$$;