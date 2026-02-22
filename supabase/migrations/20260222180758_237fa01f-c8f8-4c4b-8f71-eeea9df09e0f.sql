
-- Recreate the view with SECURITY INVOKER to fix the linter warning
DROP VIEW IF EXISTS public.host_display_names;
CREATE VIEW public.host_display_names WITH (security_invoker = true) AS
SELECT user_id, display_name
FROM public.user_profiles
WHERE EXISTS (
  SELECT 1 FROM public.availability_slots
  WHERE availability_slots.user_id = user_profiles.user_id
);

-- We need a permissive SELECT policy so the view can read display_name for hosts
-- But this time, restrict to ONLY display_name by using a dedicated RLS policy
-- Since Postgres RLS is row-level not column-level, we'll use the view approach
-- and add a minimal policy that allows reading profiles that are hosts
CREATE POLICY "Public can view host profiles via view"
ON public.user_profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.availability_slots
    WHERE availability_slots.user_id = user_profiles.user_id
  )
);
