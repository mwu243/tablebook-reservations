import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// Check if the current user already has a booking for a specific slot
export function useUserSlotBooking(slotId: string | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-slot-booking', slotId, user?.id],
    queryFn: async () => {
      if (!slotId || !user) return null;

      const { data, error } = await supabase
        .from('bookings')
        .select('id, status, party_size')
        .eq('slot_id', slotId)
        .eq('user_id', user.id)
        .neq('status', 'cancelled')
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!slotId && !!user,
  });
}
