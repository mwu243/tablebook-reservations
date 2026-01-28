-- Create user_profiles table for payment info
CREATE TABLE public.user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  display_name text,
  venmo_username text,
  zelle_identifier text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_user_profiles_user_id ON public.user_profiles(user_id);

-- Enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS: Users can only see their own profile
CREATE POLICY "Users can view own profile"
ON public.user_profiles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- RLS: Users can create their own profile
CREATE POLICY "Users can insert own profile"
ON public.user_profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- RLS: Users can update their own profile
CREATE POLICY "Users can update own profile"
ON public.user_profiles FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Secure function for hosts to get participant payment info
CREATE OR REPLACE FUNCTION public.get_participant_payment_info(p_slot_id uuid)
RETURNS TABLE(
  booking_id uuid,
  customer_name text,
  customer_email text,
  party_size integer,
  venmo_username text,
  zelle_identifier text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    up.zelle_identifier
  FROM public.bookings b
  LEFT JOIN public.user_profiles up ON b.user_id = up.user_id
  WHERE b.slot_id = p_slot_id
    AND b.status = 'confirmed';
END;
$$;

-- Function to update profile timestamp
CREATE OR REPLACE FUNCTION public.handle_profile_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER set_profile_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_profile_updated_at();