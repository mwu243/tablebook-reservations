import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Booking } from '@/lib/types';

export function useUpcomingBookings() {
  return useQuery({
    queryKey: ['bookings', 'upcoming'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          availability_slots (
            id,
            date,
            time,
            end_time,
            total_tables,
            booked_tables,
            name,
            description,
            booking_mode,
            created_at,
            user_id,
            waitlist_enabled
          )
        `)
        .eq('status', 'confirmed')
        .gte('availability_slots.date', today)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Booking[];
    },
    refetchInterval: 5000,
  });
}
