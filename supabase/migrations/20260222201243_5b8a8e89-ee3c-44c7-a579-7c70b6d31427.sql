
-- Drop the overly permissive policy that exposes all columns including payment info
DROP POLICY IF EXISTS "Public can view host profiles via view" ON public.user_profiles;

-- Ensure the host_display_names view is accessible (it only exposes user_id and display_name)
GRANT SELECT ON public.host_display_names TO anon, authenticated;
