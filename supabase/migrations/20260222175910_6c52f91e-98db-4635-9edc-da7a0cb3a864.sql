
-- Create a restricted view that only exposes display_name for hosts
CREATE VIEW public.host_display_names AS
SELECT user_id, display_name
FROM public.user_profiles
WHERE EXISTS (
  SELECT 1 FROM public.availability_slots
  WHERE availability_slots.user_id = user_profiles.user_id
);

-- Drop the overly permissive policy that exposes all columns
DROP POLICY IF EXISTS "Public can view host display names" ON public.user_profiles;
