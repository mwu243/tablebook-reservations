import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Fallback for legacy users who don't yet have a user_profiles row:
 * use the most recent booking's customer_name as their "best known" full name.
 */
export function useLastCustomerName() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['last-customer-name', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('bookings')
        .select('customer_name')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data?.customer_name ?? null;
    },
  });
}
