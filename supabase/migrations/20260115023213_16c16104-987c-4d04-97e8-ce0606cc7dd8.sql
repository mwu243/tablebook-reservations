-- Add explicit SELECT policy that denies public access to bookings
-- Only service role (via RPC functions) can read booking data
CREATE POLICY "No public read access to bookings" 
ON public.bookings 
FOR SELECT 
USING (false);