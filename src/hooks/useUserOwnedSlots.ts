import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AvailabilitySlot } from '@/lib/types';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';

export function useUserOwnedSlots() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-owned-slots', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const today = format(new Date(), 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('availability_slots')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', today)
        .order('date', { ascending: true })
        .order('time', { ascending: true });

      if (error) throw error;
      return data as AvailabilitySlot[];
    },
    enabled: !!user,
    refetchInterval: 5000,
  });
}
