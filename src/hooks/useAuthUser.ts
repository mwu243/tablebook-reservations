import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Returns the authoritative authenticated user record from the backend.
 * This is more reliable than relying solely on the session user object
 * when you need fresh user_metadata (e.g., full_name) for auto-fill.
 */
export function useAuthUser() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['auth-user', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data.user ?? null;
    },
    staleTime: 30_000,
  });
}
