
-- Add consent and webhook columns to user_profiles
ALTER TABLE public.user_profiles
  ADD COLUMN payment_sharing_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN webhook_url text;

-- Create RPC to get participant data with consent for webhook
CREATE OR REPLACE FUNCTION public.get_webhook_participant_data(p_slot_id uuid)
RETURNS TABLE(
  customer_name text,
  customer_email text,
  party_size integer,
  venmo_username text,
  zelle_identifier text,
  payment_sharing_consent boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT is_slot_owner(p_slot_id) THEN
    RAISE EXCEPTION 'Unauthorized: Only the event host can access this data';
  END IF;

  RETURN QUERY
  SELECT 
    b.customer_name,
    b.customer_email,
    b.party_size,
    up.venmo_username,
    up.zelle_identifier,
    COALESCE(up.payment_sharing_consent, false)
  FROM public.bookings b
  LEFT JOIN public.user_profiles up ON b.user_id = up.user_id
  WHERE b.slot_id = p_slot_id
    AND b.status = 'confirmed';
END;
$$;
