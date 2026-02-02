-- Allow public read access to host display names for event discovery
CREATE POLICY "Public can view host display names"
ON public.user_profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.availability_slots
    WHERE availability_slots.user_id = user_profiles.user_id
  )
);